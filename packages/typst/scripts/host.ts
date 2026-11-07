/**
 * Runs a Typst plugin in Node, for the build and the tests (ADR 0026):
 * Node's WebAssembly with the two functions of `wasm-minimal-protocol` that
 * Typst provides under `typst_env`.
 */

/** An instance of a plugin, with its own memory. */
export interface PluginInstance {
  /**
   * Calls an exported function with byte buffers and returns its result.
   * @throws Error with the plugin's message when it reports an error.
   */
  call(name: string, ...args: readonly Uint8Array[]): Uint8Array;
  readonly memory: WebAssembly.Memory;
}

/** Instantiates a plugin as Typst does. */
export async function instantiatePlugin(
  wasm: Uint8Array<ArrayBuffer>,
): Promise<PluginInstance> {
  let args: readonly Uint8Array[] = [];
  let result: Uint8Array | undefined;
  // Called only once the instance below exists.
  const bytes = () => new Uint8Array(memory.buffer);
  const typst_env = {
    wasm_minimal_protocol_write_args_to_buffer(pointer: number) {
      let at = pointer;
      for (const arg of args) {
        bytes().set(arg, at);
        at += arg.length;
      }
    },
    wasm_minimal_protocol_send_result_to_host(pointer: number, length: number) {
      result = bytes().slice(pointer, pointer + length);
    },
  };
  const { instance } = await WebAssembly.instantiate(wasm, { typst_env });
  const memory = instance.exports['memory'] as WebAssembly.Memory;
  return {
    memory,
    call(name, ...given) {
      const fn = instance.exports[name];
      if (typeof fn !== 'function') throw new Error(`No function ${name}`);
      args = given;
      result = undefined;
      let code: number;
      try {
        code = (fn as (...lengths: number[]) => number)(
          ...given.map((arg) => arg.length),
        );
      } finally {
        args = [];
      }
      const output = result ?? new Uint8Array();
      if (code === 1) throw new Error(new TextDecoder().decode(output));
      if (code !== 0) throw new Error(`${name} returned ${code}`);
      return output;
    },
  };
}
