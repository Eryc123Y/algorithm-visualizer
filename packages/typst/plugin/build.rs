//! Compiles the clock QuickJS imports (see `src/clock.c`).
fn main() {
    println!("cargo:rerun-if-changed=src/clock.c");
    cc::Build::new().file("src/clock.c").compile("clock");
}
