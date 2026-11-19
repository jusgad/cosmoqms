import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLocalStorage } from "../localStorage";
import { assertSafeKey } from "../storageKey";

describe("assertSafeKey", () => {
  it.each(["t1/raw_material_lot/abc/uuid-coa.pdf", "a.b-c_d"])("accepts %s", (key) => {
    expect(() => assertSafeKey(key)).not.toThrow();
  });

  it.each(["../escape.pdf", "t1/../../x", "/abs/path", "t1//double", "t1/with space.pdf", "t1/./x", ""])(
    "rejects %s",
    (key) => {
      expect(() => assertSafeKey(key)).toThrow();
    },
  );
});

describe("local storage driver", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cosmoqms-storage-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("round-trips bytes under nested keys", async () => {
    const storage = createLocalStorage(root);
    const content = new TextEncoder().encode("%PDF-1.7 certificado");
    await storage.put("t1/raw_material_lot/l1/u-coa.pdf", content, "application/pdf");
    expect(Buffer.from(await storage.get("t1/raw_material_lot/l1/u-coa.pdf"))).toEqual(Buffer.from(content));
  });

  it("never overwrites an existing object", async () => {
    const storage = createLocalStorage(root);
    await storage.put("t1/a.pdf", new Uint8Array([1]), "application/pdf");
    await expect(storage.put("t1/a.pdf", new Uint8Array([2]), "application/pdf")).rejects.toThrow();
  });

  it("refuses keys that would escape the root", async () => {
    const storage = createLocalStorage(root);
    await expect(storage.put("../outside.pdf", new Uint8Array([1]), "application/pdf")).rejects.toThrow();
    await expect(storage.get("../../etc/hosts")).rejects.toThrow();
  });
});
