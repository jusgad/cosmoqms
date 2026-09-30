import { describe, it, expect } from "vitest";
import type { Prisma, PrismaClient } from "@prisma/client";
import { withAuditLog } from "../audit";

// Zero-`any` precedent (Tasks 6-16): the brief's literal test used `any`
// throughout (`created: any[]`, `args: any`, fake prisma cast `as any`) — this
// adapts it to the same "type against the real shape, narrow with `unknown`
// where the shape is generic" approach used in every prior router test.
type AuditLogCreateArgs = Prisma.AuditLogCreateArgs;

describe("withAuditLog", () => {
  it("writes an audit_log row for every write on a regulated model", async () => {
    const created: AuditLogCreateArgs["data"][] = [];
    const basePrisma = {
      $extends: (config: unknown) => config,
      auditLog: { create: async (args: AuditLogCreateArgs) => created.push(args.data) },
      productionOrder: { update: async (args: Prisma.ProductionOrderUpdateArgs) => ({ id: "po1", ...args.data }) },
    } as unknown as PrismaClient;

    const ext = withAuditLog(basePrisma, "actor-1", "tenant-1") as unknown as {
      query: {
        $allModels: {
          $allOperations: (params: {
            model?: string;
            operation: string;
            args: Record<string, unknown>;
            query: (args: Record<string, unknown>) => Promise<unknown>;
          }) => Promise<unknown>;
        };
      };
    };
    const query = ext.query.$allModels.$allOperations;
    await query({
      model: "ProductionOrder",
      operation: "update",
      args: { where: { id: "po1" }, data: { status: "pesado" } },
      query: async (args: Record<string, unknown>) => ({
        id: "po1",
        status: (args.data as { status: string }).status,
      }),
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      tableName: "ProductionOrder",
      action: "update",
      actorUserId: "actor-1",
      tenantId: "tenant-1",
      recordId: "po1",
    });
  });

  it("does not audit reads or non-regulated models", async () => {
    const created: AuditLogCreateArgs["data"][] = [];
    const basePrisma = {
      $extends: (config: unknown) => config,
      auditLog: { create: async (args: AuditLogCreateArgs) => created.push(args.data) },
    } as unknown as PrismaClient;
    const ext = withAuditLog(basePrisma, "actor-1", "tenant-1") as unknown as {
      query: {
        $allModels: {
          $allOperations: (params: {
            model?: string;
            operation: string;
            args: Record<string, unknown>;
            query: (args: Record<string, unknown>) => Promise<unknown>;
          }) => Promise<unknown>;
        };
      };
    };
    const query = ext.query.$allModels.$allOperations;
    await query({ model: "RawMaterial", operation: "findMany", args: {}, query: async () => [] });
    expect(created).toHaveLength(0);
  });

  it("falls back to the where-clause id when the result has no id (e.g. updateMany)", async () => {
    const created: AuditLogCreateArgs["data"][] = [];
    const basePrisma = {
      $extends: (config: unknown) => config,
      auditLog: { create: async (args: AuditLogCreateArgs) => created.push(args.data) },
    } as unknown as PrismaClient;
    const ext = withAuditLog(basePrisma, "actor-1", "tenant-1") as unknown as {
      query: {
        $allModels: {
          $allOperations: (params: {
            model?: string;
            operation: string;
            args: Record<string, unknown>;
            query: (args: Record<string, unknown>) => Promise<unknown>;
          }) => Promise<unknown>;
        };
      };
    };
    const query = ext.query.$allModels.$allOperations;
    await query({
      model: "Deviation",
      operation: "updateMany",
      args: { where: { id: "dev1", status: "abierta" }, data: { status: "en_investigacion" } },
      query: async () => ({ count: 1 }),
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ tableName: "Deviation", action: "updateMany", recordId: "dev1" });
  });

  it("records recordId as \"unknown\" when neither the result nor the where clause carries an id", async () => {
    const created: AuditLogCreateArgs["data"][] = [];
    const basePrisma = {
      $extends: (config: unknown) => config,
      auditLog: { create: async (args: AuditLogCreateArgs) => created.push(args.data) },
    } as unknown as PrismaClient;
    const ext = withAuditLog(basePrisma, "actor-1", "tenant-1") as unknown as {
      query: {
        $allModels: {
          $allOperations: (params: {
            model?: string;
            operation: string;
            args: Record<string, unknown>;
            query: (args: Record<string, unknown>) => Promise<unknown>;
          }) => Promise<unknown>;
        };
      };
    };
    const query = ext.query.$allModels.$allOperations;
    await query({
      model: "QcResult",
      operation: "createMany",
      args: { data: [{ result: "pass" }] },
      query: async () => ({ count: 1 }),
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ tableName: "QcResult", action: "createMany", recordId: "unknown" });
  });
});
