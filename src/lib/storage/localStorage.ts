import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStorage } from "@/lib/storage/storage";
import { assertSafeKey } from "@/lib/storage/storageKey";

export function createLocalStorage(rootDir?: string): FileStorage {
  const root = path.resolve(rootDir ?? path.join(process.cwd(), "storage"));

  // Defense in depth on top of `assertSafeKey`: the resolved path must still
  // sit inside the root.
  function resolve(key: string): string {
    assertSafeKey(key);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) {
      throw new Error(`Clave de almacenamiento fuera de la raíz: ${key}`);
    }
    return full;
  }

  return {
    async put(key, bytes) {
      const full = resolve(key);
      await mkdir(path.dirname(full), { recursive: true });
      // `wx`: never overwrite — every key is unique (uuid prefix), so an
      // existing file means something is wrong, not a re-upload.
      await writeFile(full, bytes, { flag: "wx" });
    },
    async get(key) {
      return new Uint8Array(await readFile(resolve(key)));
    },
  };
}
