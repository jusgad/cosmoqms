import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// Keeps docs/api/openapi.yaml honest: every public HTTP route is documented
// with exactly the methods its route.ts exports, and every documented path
// exists. Internal routes (tRPC, offline sync, Clerk webhook) are excluded.

const ROOT = process.cwd();
const API_DIR = join(ROOT, "src", "app", "api");
const INTERNAL = ["trpc", "sync", "webhooks"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type Spec = { openapi: string; paths: Record<string, Record<string, unknown>> };
const spec = parse(readFileSync(join(ROOT, "docs", "api", "openapi.yaml"), "utf8")) as Spec;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "__tests__" ? [] : routeFiles(full);
    return entry === "route.ts" ? [full] : [];
  });
}

// src/app/api/v1/materias-primas/[id]/route.ts -> /api/v1/materias-primas/{id}
function toPath(file: string): string {
  const segments = relative(join(ROOT, "src", "app"), file).split(sep).slice(0, -1);
  return `/${segments.map((segment) => segment.replace(/^\[(.+)\]$/, "{$1}")).join("/")}`;
}

const routes = routeFiles(API_DIR)
  .filter((file) => !INTERNAL.includes(relative(API_DIR, file).split(sep)[0]))
  .map((file) => ({
    path: toPath(file),
    methods: METHODS.filter((method) => new RegExp(`export (async )?function ${method}\\b`).test(readFileSync(file, "utf8"))),
  }));

describe("docs/api/openapi.yaml", () => {
  it("is an OpenAPI 3.1 document", () => {
    expect(spec.openapi).toBe("3.1.0");
  });

  it("documents every public route with exactly its methods", () => {
    for (const route of routes) {
      const documented = spec.paths[route.path];
      expect(documented, `${route.path} no está en openapi.yaml`).toBeDefined();
      const documentedMethods = Object.keys(documented)
        .filter((key) => METHODS.includes(key.toUpperCase() as (typeof METHODS)[number]))
        .map((key) => key.toUpperCase())
        .sort();
      expect(documentedMethods, route.path).toEqual([...route.methods].sort());
    }
  });

  it("documents no route that does not exist", () => {
    const real = new Set(routes.map((route) => route.path));
    for (const path of Object.keys(spec.paths)) expect(real.has(path), `${path} no existe`).toBe(true);
  });

  it("resolves every $ref", () => {
    const refs = JSON.stringify(spec).match(/"\$ref":"#\/[^"]+"/g) ?? [];
    for (const ref of refs) {
      const pointer = ref.slice(10, -1).split("/"); // after "$ref":"#/
      let node: unknown = spec;
      for (const key of pointer) node = (node as Record<string, unknown>)?.[key];
      expect(node, ref).toBeDefined();
    }
  });
});
