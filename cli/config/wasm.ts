import { join } from "path";
import "../wasm/wasm_exec.js";
import { embeddedFiles } from "bun";

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

  let wasmBytes: ArrayBuffer;
  // @todo figure out why this is the only way to get it to load from embedded files.
  // docs say it should work both ways, as long as we compile the asset into the binary
  try {
    const embeddedFile = (embeddedFiles as unknown as { name: string; arrayBuffer(): Promise<ArrayBuffer> }[]).find(
      i => i.name === "bin.wasm"
    );
    if (embeddedFile) {
      wasmBytes = await embeddedFile.arrayBuffer();
    } else {
      throw new Error("Embedded file not found");
    }
  } catch (error) {
    try {
      wasmBytes = await Bun.file(new URL("../wasm/bin.wasm", import.meta.url)).arrayBuffer();
    } catch (error) {
      throw new Error("Failed to load WASM from both embedded files and file system");
    }
  }

  const result = await WebAssembly.instantiate(wasmBytes, go.importObject);

  go.run(result.instance);

  wasmInitialized = true;
  return { wasmlibValidateCELs, wasmlibSetSchema };
}
