import type { Prisma } from "@prisma/client";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { auditSearchInput } from "@/lib/validation/audit";

// Both `search` and `export` need the exact same tenant-scoped `where`
// clause built from the same filters, so it's factored out once rather than
// duplicated (the brief's own procedures share this shape).
function buildWhere(tenantId: string, input: { tableName?: string; actorUserId?: string; dateFrom?: string; dateTo?: string }): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = { tenantId };
  if (input.tableName) where.tableName = input.tableName;
  if (input.actorUserId) where.actorUserId = input.actorUserId;
  if (input.dateFrom || input.dateTo) {
    where.occurredAt = {
      ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
      ...(input.dateTo ? { lte: new Date(input.dateTo) } : {}),
    };
  }
  return where;
}

function toCsvField(value: string): string {
  // Minimal RFC 4180-style escaping: quote any field containing a comma,
  // quote, or newline, doubling embedded quotes. No external CSV library
  // needed for this row shape (brief's own note).
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const CSV_HEADER = ["occurredAt", "tableName", "recordId", "action", "actorUserId", "afterData"];

export const auditRouter = router({
  // Regulated audit trail for a BPM/INVIMA system is inherently sensitive —
  // gated to admin/director_tecnico, same role set the brief specifies.
  search: roleProcedure("admin", "director_tecnico")
    .input(auditSearchInput)
    .query(({ ctx, input }) =>
      tenantTx(ctx, (tx) =>
        tx.auditLog.findMany({
          where: buildWhere(ctx.user.tenantId, input),
          orderBy: { occurredAt: "desc" },
        }),
      ),
    ),

  export: roleProcedure("admin", "director_tecnico")
    .input(auditSearchInput)
    .query(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const rows = await tx.auditLog.findMany({
          where: buildWhere(ctx.user.tenantId, input),
          orderBy: { occurredAt: "desc" },
        });
        const lines = rows.map((row) =>
          [
            row.occurredAt.toISOString(),
            row.tableName,
            row.recordId,
            row.action,
            row.actorUserId,
            row.afterData === null ? "" : JSON.stringify(row.afterData),
          ]
            .map(toCsvField)
            .join(","),
        );
        return [CSV_HEADER.join(","), ...lines].join("\n");
      }),
    ),
});
