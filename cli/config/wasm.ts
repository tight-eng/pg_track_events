import { join } from "path";
import "../wasm/wasm_exec.js";

declare global {
  class Go {
    constructor();
    importObject: Record<string, any>;
    run(instance: WebAssembly.Instance): void;
  }

  function wasmlibValidateCELs(input: {
    cels: Array<{
      table: string;
      operation: string;
      exprKind: string;
      expr: string;
    }>;
  }): Promise<any>;

  function wasmlibSetSchema(schema: any[] | null): Promise<void>;
}

let wasmInitialized = false;

export async function initWasm() {
  if (wasmInitialized) {
    return { wasmlibValidateCELs, wasmlibSetSchema };
  }

  const go = new Go(); // Provided by wasm_exec.js

  const wasmBytes = await Bun.file(
    new URL("../wasm/bin.wasm", import.meta.url)
  ).arrayBuffer();

  const result = await WebAssembly.instantiate(wasmBytes, go.importObject);

  go.run(result.instance);

  wasmInitialized = true;
  return { wasmlibValidateCELs, wasmlibSetSchema };
}
