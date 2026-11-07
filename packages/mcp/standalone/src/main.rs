//! The standalone `algoviz` command (ADR 0027): the CLI of `@algoviz/mcp`,
//! bundled and compiled to QuickJS bytecode, run by QuickJS-ng with a few
//! functions for files and output. No Node.js is needed.
//!
//! The JavaScript side (`js/`) finds these functions on the global
//! `__host` and uses them in place of `node:fs` and `process`:
//!
//! - `argv`: the arguments after the program's name;
//! - `write(fd, text)`: text to standard output (1) or standard error (2);
//! - `readFile(path)`: a file's text, or standard input's for `0`;
//! - `writeFile(path, text)`, `mkdir(path)` (with its parents) and
//!   `remove(path)` (nothing if it is missing);
//! - `exit(code)`: the exit code once the CLI returns.
//!
//! An exception that escapes the CLI is a bug: it is printed with its stack
//! and the command exits with 70 (`EX_SOFTWARE`).

use std::{
    cell::Cell,
    io::{self, Read, Write},
    process::ExitCode,
    rc::Rc,
};

use rquickjs::{Context, Ctx, Error, Exception, Function, Module, Object, Runtime, Value};

/// The CLI, compiled by `build.rs`.
static BYTECODE: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/algoviz.bc"));

/// Beyond this, QuickJS throws "out of memory" instead of growing.
const MEMORY_LIMIT: usize = 4 << 30;
/// Room for deep recursion in long documents; the main thread has 8 MiB.
const STACK_LIMIT: usize = 6 << 20;
/// The exit code of a bug in algoviz (`EX_SOFTWARE` in sysexits.h).
const INTERNAL_ERROR: u8 = 70;

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

/// An I/O error as a JavaScript exception that names the path.
fn thrown<T>(ctx: &Ctx<'_>, result: io::Result<T>, path: &str) -> rquickjs::Result<T> {
    result.map_err(|e| Exception::throw_message(ctx, &format!("{path}: {e}")))
}

/// The global `__host` object of the JavaScript side.
fn host<'js>(ctx: &Ctx<'js>, args: Vec<String>, code: Rc<Cell<i32>>) -> rquickjs::Result<Object<'js>> {
    let host = Object::new(ctx.clone())?;
    host.set("argv", args)?;
    host.set(
        "write",
        Function::new(ctx.clone(), |fd: i32, text: String| {
            // A closed pipe is not worth a crash.
            let _ = if fd == 2 {
                io::stderr().write_all(text.as_bytes())
            } else {
                io::stdout().write_all(text.as_bytes())
            };
        })?,
    )?;
    host.set(
        "readFile",
        Function::new(ctx.clone(), |ctx: Ctx<'_>, file: Value<'_>| -> rquickjs::Result<String> {
            if file.as_int() == Some(0) {
                let mut text = String::new();
                thrown(&ctx, io::stdin().read_to_string(&mut text), "standard input")?;
                return Ok(text);
            }
            let path: String = file.get()?;
            thrown(&ctx, std::fs::read_to_string(&path), &path)
        })?,
    )?;
    host.set(
        "writeFile",
        Function::new(ctx.clone(), |ctx: Ctx<'_>, path: String, text: String| -> rquickjs::Result<()> {
            thrown(&ctx, std::fs::write(&path, text), &path)
        })?,
    )?;
    host.set(
        "mkdir",
        Function::new(ctx.clone(), |ctx: Ctx<'_>, path: String| -> rquickjs::Result<()> {
            thrown(&ctx, std::fs::create_dir_all(&path), &path)
        })?,
    )?;
    host.set(
        "remove",
        Function::new(ctx.clone(), |ctx: Ctx<'_>, path: String| -> rquickjs::Result<()> {
            match std::fs::remove_file(&path) {
                Err(e) if e.kind() != io::ErrorKind::NotFound => thrown(&ctx, Err(e), &path),
                _ => Ok(()),
            }
        })?,
    )?;
    host.set("exit", Function::new(ctx.clone(), move |n: i32| code.set(n))?)?;
    Ok(host)
}

/// Runs the CLI with `args` and returns its exit code.
fn run(args: Vec<String>) -> Result<i32, String> {
    let runtime = Runtime::new().map_err(|e| e.to_string())?;
    runtime.set_memory_limit(MEMORY_LIMIT);
    runtime.set_max_stack_size(STACK_LIMIT);
    let context = Context::full(&runtime).map_err(|e| e.to_string())?;
    let code = Rc::new(Cell::new(0));
    context.with(|ctx| {
        let host = host(&ctx, args, code.clone()).map_err(|e| describe(&ctx, e))?;
        ctx.globals().set("__host", host).map_err(|e| describe(&ctx, e))?;
        // SAFETY: the bytecode was compiled by build.rs with this crate's
        // QuickJS, and QuickJS checks its version.
        let module = unsafe { Module::load(ctx.clone(), BYTECODE) }.map_err(|e| describe(&ctx, e))?;
        let (_module, promise) = module.eval().map_err(|e| describe(&ctx, e))?;
        promise.finish::<()>().map_err(|e| describe(&ctx, e))
    })?;
    Ok(code.get())
}

fn main() -> ExitCode {
    let args = std::env::args().skip(1).collect();
    let result = run(args);
    let _ = io::stdout().flush();
    match result {
        Ok(code) => ExitCode::from(u8::try_from(code).unwrap_or(1)),
        Err(message) => {
            eprintln!("Internal error in algoviz: {message}");
            ExitCode::from(INTERNAL_ERROR)
        }
    }
}
