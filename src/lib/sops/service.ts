import { Prisma } from "@prisma/client";
import type { Role, Sop } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { SOP_VIEW_ROLES, type ApproveSopInput, type CreateSopInput } from "@/lib/validation/sops";

// BPM document control for SOPs. Every function runs inside the caller's
// `withTenant` transaction and filters by `tenantId` explicitly (RLS is the
// second wall). `sops` is not one of the five regulated tables of CLAUDE.md
// rule 2, but a controlled document's lifecycle is audited the same way:
// every create/approve/obsolete writes `audit_log` in the same transaction.

const FLOOR_ROLES: Role[] = [...SOP_VIEW_ROLES];

async function audit(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; actorUserId: string; recordId: string; action: string; before?: object; after: object },
) {
  await tx.auditLog.create({
    data: {
      tenantId: params.tenantId,
      tableName: "Sop",
      recordId: params.recordId,
      action: params.action,
      beforeData: params.before as Prisma.InputJsonValue | undefined,
      afterData: params.after as Prisma.InputJsonValue,
      actorUserId: params.actorUserId,
      occurredAt: new Date(),
    },
  });
}

function snapshot(sop: Sop) {
  return { code: sop.code, version: sop.version, title: sop.title, status: sop.status };
}

async function findSop(tx: Prisma.TransactionClient, tenantId: string, id: string): Promise<Sop> {
  const sop = await tx.sop.findFirst({ where: { id, tenantId } });
  if (!sop) throw new TRPCError({ code: "NOT_FOUND", message: "Procedimiento no encontrado" });
  return sop;
}

// A new code starts at version 1; an existing code gets the next version.
// Only one draft per code at a time, so two people never edit rival drafts.
export async function createSopDraft(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; actorUserId: string; input: CreateSopInput },
) {
  const { tenantId, actorUserId, input } = params;
  const versions = await tx.sop.findMany({
    where: { tenantId, code: input.code },
    orderBy: { version: "desc" },
    select: { version: true, status: true },
  });
  const draft = versions.find((version) => version.status === "borrador");
  if (draft) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Ya existe un borrador de ${input.code} (versión ${draft.version}); termínelo o apruébelo primero`,
    });
  }

  try {
    const sop = await tx.sop.create({
      data: {
        tenantId,
        code: input.code,
        title: input.title,
        changeSummary: input.changeSummary || null,
        version: (versions[0]?.version ?? 0) + 1,
        createdBy: actorUserId,
      },
    });
    await audit(tx, { tenantId, actorUserId, recordId: sop.id, action: "create", after: snapshot(sop) });
    return sop;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new TRPCError({ code: "CONFLICT", message: "Otra persona acaba de crear esta versión; recargue la página" });
    }
    throw error;
  }
}

// Approval is the document's electronic signature: the caller must have
// re-verified with Clerk (checked by the router) and the meaning statement
// is stored with it (CLAUDE.md rule 3). The previous vigente version of the
// same code becomes obsoleto in the same transaction.
export async function approveSop(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; actorUserId: string; input: ApproveSopInput },
) {
  const { tenantId, actorUserId, input } = params;
  const sop = await findSop(tx, tenantId, input.id);
  if (sop.status !== "borrador") {
    throw new TRPCError({ code: "CONFLICT", message: "Solo un borrador se puede aprobar" });
  }
  if (input.reviewDue <= input.effectiveDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "La fecha de revisión debe ser posterior a la de vigencia" });
  }
  const documents = await tx.attachment.count({ where: { tenantId, entityType: "sop", entityId: sop.id } });
  if (documents === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Adjunte el documento del procedimiento antes de aprobarlo" });
  }

  // Serializes concurrent approvals of the same code, so there is never more
  // than one vigente version.
  await tx.$executeRaw`SELECT 1 FROM sops WHERE tenant_id = ${tenantId} AND code = ${sop.code} FOR UPDATE`;

  const now = new Date();
  const previous = await tx.sop.findMany({ where: { tenantId, code: sop.code, status: "vigente" } });
  for (const old of previous) {
    await tx.sop.updateMany({ where: { id: old.id, tenantId, status: "vigente" }, data: { status: "obsoleto", obsoletedAt: now } });
    await audit(tx, {
      tenantId,
      actorUserId,
      recordId: old.id,
      action: "obsolete",
      before: snapshot(old),
      after: { ...snapshot(old), status: "obsoleto", replacedBy: sop.id },
    });
  }

  const { count } = await tx.sop.updateMany({
    where: { id: sop.id, tenantId, status: "borrador" },
    data: {
      status: "vigente",
      approvedBy: actorUserId,
      approvedAt: now,
      meaningStatement: input.meaningStatement,
      effectiveDate: new Date(`${input.effectiveDate}T00:00:00.000Z`),
      reviewDue: new Date(`${input.reviewDue}T00:00:00.000Z`),
    },
  });
  if (count === 0) throw new TRPCError({ code: "CONFLICT", message: "Solo un borrador se puede aprobar" });

  const approved = await findSop(tx, tenantId, sop.id);
  await audit(tx, {
    tenantId,
    actorUserId,
    recordId: sop.id,
    action: "approve",
    before: snapshot(sop),
    after: { ...snapshot(approved), effectiveDate: input.effectiveDate, reviewDue: input.reviewDue, meaningStatement: input.meaningStatement },
  });
  return approved;
}

// "Leído y entendido": once per person and version, only for the vigente one.
// Idempotent, so a double tap on the floor never errors.
export async function acknowledgeSop(tx: Prisma.TransactionClient, params: { tenantId: string; userId: string; id: string }) {
  const sop = await findSop(tx, params.tenantId, params.id);
  if (sop.status !== "vigente") {
    throw new TRPCError({ code: "CONFLICT", message: "Solo se puede confirmar la lectura de la versión vigente" });
  }
  const existing = await tx.sopAcknowledgment.findFirst({ where: { sopId: sop.id, userId: params.userId } });
  if (existing) return existing;
  return tx.sopAcknowledgment.create({ data: { sopId: sop.id, userId: params.userId } });
}

export type SopListItem = {
  code: string;
  title: string;
  vigente: { id: string; version: number; effectiveDate: Date | null; reviewDue: Date | null; acknowledged: boolean } | null;
  draft: { id: string; version: number } | null;
  versions: number;
};

// One row per code: its vigente version (with the viewer's acknowledgment)
// and any draft in progress.
export async function listSops(tx: Prisma.TransactionClient, tenantId: string, userId: string): Promise<SopListItem[]> {
  const sops = await tx.sop.findMany({
    where: { tenantId },
    orderBy: [{ code: "asc" }, { version: "desc" }],
    include: { acknowledgments: { where: { userId }, select: { id: true } } },
  });
  const byCode = new Map<string, SopListItem>();
  for (const sop of sops) {
    const item = byCode.get(sop.code) ?? { code: sop.code, title: sop.title, vigente: null, draft: null, versions: 0 };
    item.versions += 1;
    if (sop.status === "vigente") {
      item.title = sop.title;
      item.vigente = {
        id: sop.id,
        version: sop.version,
        effectiveDate: sop.effectiveDate,
        reviewDue: sop.reviewDue,
        acknowledged: sop.acknowledgments.length > 0,
      };
    }
    if (sop.status === "borrador") item.draft = { id: sop.id, version: sop.version };
    byCode.set(sop.code, item);
  }
  return [...byCode.values()];
}

export async function getSopDetail(tx: Prisma.TransactionClient, tenantId: string, id: string, userId: string) {
  const sop = await findSop(tx, tenantId, id);
  const [versions, acknowledgments, floorUsers] = await Promise.all([
    tx.sop.findMany({
      where: { tenantId, code: sop.code },
      orderBy: { version: "desc" },
      select: { id: true, version: true, status: true, approvedAt: true, changeSummary: true },
    }),
    tx.sopAcknowledgment.findMany({ where: { sopId: sop.id }, orderBy: { ackAt: "asc" } }),
    tx.user.findMany({
      where: { tenantId, active: true, role: { in: FLOOR_ROLES } },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, role: true },
    }),
  ]);
  const ackByUser = new Map(acknowledgments.map((ack) => [ack.userId, ack.ackAt]));
  const people = [sop.createdBy, sop.approvedBy].filter((value): value is string => Boolean(value));
  const names = new Map(
    (await tx.user.findMany({ where: { tenantId, id: { in: people } }, select: { id: true, fullName: true } })).map(
      (user) => [user.id, user.fullName],
    ),
  );

  return {
    sop,
    createdByName: names.get(sop.createdBy) ?? sop.createdBy,
    approvedByName: sop.approvedBy ? (names.get(sop.approvedBy) ?? sop.approvedBy) : null,
    versions,
    acknowledgedByMe: ackByUser.has(userId),
    coverage: floorUsers.map((user) => ({ ...user, ackAt: ackByUser.get(user.id) ?? null })),
  };
}
