//! Compiles the CLI bundle to QuickJS bytecode, which `src/main.rs`
//! includes, so the executable loads the CLI without parsing it.
//!
//! `npm run build:standalone -w @algoviz/mcp` bundles the CLI with Vite and
//! names the bundle in `ALGOVIZ_BUNDLE`. QuickJS bytecode depends on the
//! QuickJS version, which `Cargo.lock` pins for both copies of rquickjs,
//! not on the platform, so it also serves a binary built for another
//! target.

use std::{env, fs, path::PathBuf};

use rquickjs::{Context, Module, Runtime, module::WriteOptions};

fn main() {
    println!("cargo:rerun-if-env-changed=ALGOVIZ_BUNDLE");
    let bundle = env::var("ALGOVIZ_BUNDLE").unwrap_or_else(|_| {
        panic!("ALGOVIZ_BUNDLE names no bundle: build with npm run build:standalone -w @algoviz/mcp")
    });
    println!("cargo:rerun-if-changed={bundle}");
    let source = fs::read(&bundle).unwrap_or_else(|e| panic!("cannot read {bundle}: {e}"));

    let runtime = Runtime::new().expect("a QuickJS runtime");
    let context = Context::full(&runtime).expect("a QuickJS context");
    let bytecode = context.with(|ctx| {
        let module = Module::declare(ctx.clone(), "algoviz", source)
            .unwrap_or_else(|e| panic!("the bundle does not compile: {e}: {:?}", ctx.catch()));
        module
            .write(WriteOptions { strip_source: true, ..WriteOptions::default() })
            .expect("bytecode of the bundle")
    });
    let out = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR")).join("algoviz.bc");
    fs::write(&out, bytecode).unwrap_or_else(|e| panic!("cannot write {}: {e}", out.display()));
}
