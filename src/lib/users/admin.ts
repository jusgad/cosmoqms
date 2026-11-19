import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { UpdateUserInput } from "@/lib/validation/users";

// User administration (/usuarios). `users` is not one of the five regulated
// tables of CLAUDE.md rule 2, but a role decides who may sign which batch
// stage, so every change is written to `audit_log` explicitly, in the same
// transaction (tableName "User").

export function listUsers(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.user.findMany({
    where: { tenantId },
    orderBy: [{ active: "desc" }, { fullName: "asc" }],
    select: { id: true, fullName: true, email: true, role: true, active: true, mfaEnabled: true },
  });
}

export async function updateUser(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; actorUserId: string; input: UpdateUserInput },
) {
  const { tenantId, actorUserId, input } = params;
  const user = await tx.user.findFirst({ where: { id: input.id, tenantId } });
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });

  // An admin never edits their own access: it would let the last admin lock
  // everyone out, and a self-granted change is a segregation-of-duties smell.
  if (user.id === actorUserId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No puede cambiar su propio rol ni desactivar su propia cuenta" });
  }

  const role = input.role ?? user.role;
  const active = input.active ?? user.active;
  if (role === user.role && active === user.active) return user;

  const { count } = await tx.user.updateMany({ where: { id: user.id, tenantId }, data: { role, active } });
  if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });

  await tx.auditLog.create({
    data: {
      tenantId,
      tableName: "User",
      recordId: user.id,
      action: "update",
      beforeData: { role: user.role, active: user.active },
      afterData: { role, active },
      actorUserId,
      occurredAt: new Date(),
    },
  });

  return { ...user, role, active };
}
