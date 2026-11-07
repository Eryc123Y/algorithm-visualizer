//! The algoviz Typst plugin (ADR 0026): QuickJS-ng running the algoviz
//! engine, behind the functions of `wasm-minimal-protocol`.
//!
//! - `compile(source)` returns QuickJS bytecode of the engine bundle. The
//!   package build calls it, never Typst.
//! - `load(bytecode)` evaluates the engine. Typst calls it once, through
//!   `plugin.transition`, so every later instance starts with it loaded.
//! - `render(request)` passes a JSON request to the engine and returns its
//!   JSON response.
//!
//! The plugin imports only the two functions of the protocol. QuickJS asks
//! the host for the time; `src/clock.c` answers 0, so nothing the engine
//! draws can depend on it.

use std::cell::RefCell;

use rquickjs::{Context, Ctx, Error, Function, Module, Runtime, module::WriteOptions};
use wasm_minimal_protocol::{initiate_protocol, wasm_func};

initiate_protocol!();

/// The global function the engine bundle defines (`src/main.ts`).
const ENTRY: &str = "renderRequest";
/// Beyond this, QuickJS throws "out of memory" instead of growing.
const MEMORY_LIMIT: usize = 1 << 30;
/// QuickJS's own stack limit. Typst's wasmi allows 1,000 nested WebAssembly
/// calls, which JavaScript recursion reaches at about 750 levels; a level
/// takes about 300 bytes of stack, so this limit stops recursion at about
/// 600 levels with a `RangeError`, before wasmi traps.
const STACK_LIMIT: usize = 192 * 1024;

/// The loaded engine. The context goes before the runtime it lives in.
struct Engine {
    context: Context,
    _runtime: Runtime,
}

thread_local! {
    static ENGINE: RefCell<Option<Engine>> = const { RefCell::new(None) };
}

fn new_context() -> Result<(Runtime, Context), String> {
    let runtime = Runtime::new().map_err(|e| e.to_string())?;
    runtime.set_memory_limit(MEMORY_LIMIT);
    runtime.set_max_stack_size(STACK_LIMIT);
    let context = Context::full(&runtime).map_err(|e| e.to_string())?;
    Ok((runtime, context))
}

/// The message of a JavaScript exception, with its stack when it has one.
fn describe(ctx: &Ctx<'_>, error: Error) -> String {
    if !matches!(error, Error::Exception) {
        return error.to_string();
    }
    let thrown = ctx.catch();
    match thrown.as_exception() {
        Some(exception) => {
            let message = exception.message().unwrap_or_default();
            match exception.stack() {
                Some(stack) if !stack.is_empty() => format!("{message}\n{stack}"),
                _ => message,
            }
        }
        None => format!("{thrown:?}"),
    }
}

/// Compiles the engine bundle, an ES module, to QuickJS bytecode.
#[wasm_func]
pub fn compile(source: &[u8]) -> Result<Vec<u8>, String> {
    let (_runtime, context) = new_context()?;
    context.with(|ctx| {
        let module =
            Module::declare(ctx.clone(), "engine", source).map_err(|e| describe(&ctx, e))?;
        module
            .write(WriteOptions { strip_source: true, ..WriteOptions::default() })
            .map_err(|e| describe(&ctx, e))
    })
}

/// Evaluates the engine from its bytecode, replacing any engine loaded before.
#[wasm_func]
pub fn load(bytecode: &[u8]) -> Result<Vec<u8>, String> {
    let (runtime, context) = new_context()?;
    context.with(|ctx| {
        // SAFETY: QuickJS checks the bytecode's version, and the package
        // ships bytecode this plugin compiled. Hostile bytecode could break
        // only this instance, inside the WebAssembly sandbox.
        let module = unsafe { Module::load(ctx.clone(), bytecode) }.map_err(|e| describe(&ctx, e))?;
        let (_module, promise) = module.eval().map_err(|e| describe(&ctx, e))?;
        promise.finish::<()>().map_err(|e| describe(&ctx, e))?;
        ctx.globals()
            .get::<_, Function>(ENTRY)
            .map(|_| ())
            .map_err(|_| format!("the engine defines no function `{ENTRY}`"))
    })?;
    ENGINE.with(|cell| *cell.borrow_mut() = Some(Engine { context, _runtime: runtime }));
    Ok(Vec::new())
}

/// Passes a request, JSON text, to the engine and returns its JSON answer.
#[wasm_func]
pub fn render(request: &[u8]) -> Result<Vec<u8>, String> {
    let text = std::str::from_utf8(request).map_err(|e| format!("the request is not UTF-8: {e}"))?;
    ENGINE.with(|cell| {
        let slot = cell.borrow();
        let engine = slot.as_ref().ok_or("the engine is not loaded: call `load` first")?;
        engine.context.with(|ctx| {
            let entry: Function = ctx.globals().get(ENTRY).map_err(|e| describe(&ctx, e))?;
            let response: String = entry.call((text,)).map_err(|e| describe(&ctx, e))?;
            Ok(response.into_bytes())
        })
    })
}
