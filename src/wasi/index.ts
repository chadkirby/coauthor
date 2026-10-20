/**
 * @ckirby/coauthor/wasi
 *
 * Minimal WASI preview-1 in-memory runner for Cloudflare Workers (workerd).
 * Executes pure wasm32-wasip1 binaries (compiled from Swift, Rust, or Zig)
 * using in-memory stdin and stdout buffers.
 */

export interface WasiExecutionOptions {
  stdin?: Uint8Array;
  args?: string[];
  env?: Record<string, string>;
}

export interface WasiExecutionResult {
  stdout: Uint8Array;
  exitCode: number;
}

/**
 * Executes a compiled WASI module in-memory within Cloudflare Workers.
 */
export async function runWasiModule(
  wasmModule: WebAssembly.Module,
  options: WasiExecutionOptions = {}
): Promise<WasiExecutionResult> {
  const stdinBytes = options.stdin ?? new Uint8Array(0);
  let stdinOffset = 0;
  const stdoutChunks: Uint8Array[] = [];
  let exitCode = 0;

  let memory: WebAssembly.Memory;

  const wasiPreview1 = {
    fd_read(fd: number, iovs: number, iovs_len: number, nread: number): number {
      if (fd !== 0) return 8; // Bad file descriptor
      const view = new DataView(memory.buffer);
      let bytesReadTotal = 0;

      for (let i = 0; i < iovs_len; i++) {
        const ptr = view.getUint32(iovs + i * 8, true);
        const len = view.getUint32(iovs + i * 8 + 4, true);
        const available = Math.min(len, stdinBytes.length - stdinOffset);
        if (available > 0) {
          new Uint8Array(memory.buffer, ptr, available).set(
            stdinBytes.subarray(stdinOffset, stdinOffset + available)
          );
          stdinOffset += available;
          bytesReadTotal += available;
        }
      }
      view.setUint32(nread, bytesReadTotal, true);
      return 0; // Success
    },

    fd_write(fd: number, iovs: number, iovs_len: number, nwritten: number): number {
      const view = new DataView(memory.buffer);
      let bytesWrittenTotal = 0;

      for (let i = 0; i < iovs_len; i++) {
        const ptr = view.getUint32(iovs + i * 8, true);
        const len = view.getUint32(iovs + i * 8 + 4, true);
        if (len > 0) {
          const chunk = new Uint8Array(memory.buffer, ptr, len).slice();
          stdoutChunks.push(chunk);
          bytesWrittenTotal += len;
        }
      }
      view.setUint32(nwritten, bytesWrittenTotal, true);
      return 0; // Success
    },

    clock_time_get(id: number, precision: bigint, time: number): number {
      const view = new DataView(memory.buffer);
      const nowNanos = BigInt(Date.now()) * 1_000_000n;
      view.setBigUint64(time, nowNanos, true);
      return 0;
    },

    proc_exit(code: number): never {
      exitCode = code;
      throw new Error(`WASI_EXIT_${code}`);
    },

    environ_sizes_get(count: number, bufSize: number): number {
      const view = new DataView(memory.buffer);
      view.setUint32(count, 0, true);
      view.setUint32(bufSize, 0, true);
      return 0;
    },

    environ_get(): number {
      return 0;
    },

    fd_close(): number {
      return 0;
    },

    fd_seek(): number {
      return 0;
    },
  };

  try {
    const instance = await WebAssembly.instantiate(wasmModule, {
      wasi_snapshot_preview1: wasiPreview1,
    });
    memory = instance.exports.memory as WebAssembly.Memory;

    const start = instance.exports._start as (() => void) | undefined;
    if (typeof start === "function") {
      start();
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("WASI_EXIT_")) {
      // Normal process exit
    } else {
      throw err;
    }
  }

  // Concatenate stdout chunks
  const totalLength = stdoutChunks.reduce((acc, c) => acc + c.length, 0);
  const stdout = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of stdoutChunks) {
    stdout.set(chunk, offset);
    offset += chunk.length;
  }

  return { stdout, exitCode };
}
