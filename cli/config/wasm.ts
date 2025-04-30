import { readFile } from "fs/promises";
import { join } from "path";
import "../wasm/wasm_exec.js";

declare global {
  class Go {
    constructor();
    importObject: Record<string, any>;
    run(instance: WebAssembly.Instance): void;
  }

  function wasmlibValidateCELs(input: {
    schema: any;
    cels: Array<{
      table: string;
      operation: string;
      exprKind: string;
      expr: string;
    }>;
  }): any;
}

let wasmInitialized = false;

export async function initWasm() {
  if (wasmInitialized) {
    return wasmlibValidateCELs
  }

  const go = new Go(); // Provided by wasm_exec.js

  const wasmPath = join(import.meta.dir, "../wasm/bin.wasm");
  const wasmBytes = await readFile(wasmPath);

  const result = await WebAssembly.instantiate(wasmBytes, go.importObject);

  go.run(result.instance);

  wasmInitialized = true;
  return wasmlibValidateCELs
} 