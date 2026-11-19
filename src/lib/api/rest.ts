import { NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import type { Role } from "@prisma/client";
import type { z } from "zod";
import { ForbiddenError, requireRole, UnauthorizedError, type CurrentUser } from "@/lib/auth";

// Small toolkit for the REST endpoints under /api/v1: same session/role rules
// as tRPC (`requireRole`), the same domain services, and one JSON error shape:
// `{ error: string, issues?: [...] }`.

export async function authorize(roles: Role[]): Promise<CurrentUser | NextResponse> {
  try {
    return await requireRole(roles);
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}

export async function parseJsonBody<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { response: NextResponse.json({ error: "El cuerpo debe ser JSON válido" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos",
          issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data };
}

// Domain services throw `TRPCError`s (NOT_FOUND, CONFLICT...); tRPC's own
// table maps them to the matching HTTP status. Anything else is a 500 and is
// re-thrown so Next/Sentry see it.
export function restError(error: unknown): NextResponse {
  if (error instanceof TRPCError) {
    return NextResponse.json({ error: error.message }, { status: getHTTPStatusCodeFromError(error) });
  }
  throw error;
}
