// The clock rquickjs-sys's wasm shim imports for `Date`. Defined here, the
// import never reaches Typst, and the plugin does not export it as Rust
// would: the time always reads 0, so no figure can depend on it.
double __rquickjs_host_now_us(void) { return 0.0; }
