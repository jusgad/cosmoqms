import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/validation/users";

// Periodic user-access review (computerized-system control under BPM and
// the usual data-integrity guidance): who holds which role, whether they use
// MFA and when they last signed in, with the findings the administrator has
// to act on. Pure function; the page and the CSV route feed it.

export const INACTIVITY_DAYS = 90;

export type ReviewUser = { id: string; fullName: string; email: string; role: Role; active: boolean; mfaEnabled: boolean };
export type SignInInfo = { lastSignInAt: Date | null; twoFactorEnabled: boolean };

export type ReviewRow = ReviewUser & {
  roleLabel: string;
  lastSignInAt: Date | null;
  mfa: boolean;
  findings: string[];
};

export function buildAccessReview(users: ReviewUser[], signIns: Map<string, SignInInfo>, now: Date = new Date()): ReviewRow[] {
  const limit = now.getTime() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000;
  return users.map((user) => {
    const info = signIns.get(user.id);
    const lastSignInAt = info?.lastSignInAt ?? null;
    const mfa = info?.twoFactorEnabled ?? user.mfaEnabled;
    const findings: string[] = [];
    if (user.active) {
      if (!mfa) findings.push("Sin MFA");
      if (info && lastSignInAt === null) findings.push("Nunca ha ingresado");
      if (lastSignInAt && lastSignInAt.getTime() < limit) findings.push(`Sin ingresar hace más de ${INACTIVITY_DAYS} días`);
      if (user.role === "admin" && !mfa) findings.push("Administrador sin MFA");
    }
    return { ...user, roleLabel: ROLE_LABELS[user.role], lastSignInAt, mfa, findings };
  });
}

function csvField(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function accessReviewCsv(rows: ReviewRow[], meta: { orgName: string; generatedAt: Date; generatedBy: string }): string {
  const day = (date: Date | null) => (date ? date.toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "");
  const lines = [
    `Revisión de accesos;${csvField(meta.orgName)}`,
    `Generada;${csvField(day(meta.generatedAt))} por ${csvField(meta.generatedBy)}`,
    "",
    ["Nombre", "Correo", "Rol", "Estado", "MFA", "Último ingreso", "Hallazgos"].join(";"),
    ...rows.map((row) =>
      [
        row.fullName,
        row.email,
        row.roleLabel,
        row.active ? "Activo" : "Inactivo",
        row.mfa ? "Sí" : "No",
        day(row.lastSignInAt),
        row.findings.join(" | "),
      ]
        .map(csvField)
        .join(";"),
    ),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
