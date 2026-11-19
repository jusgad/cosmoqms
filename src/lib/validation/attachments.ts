import { z } from "zod";

// Schema-only module (bundle-safe): AttachmentUploader.tsx imports the limits
// from here, never from the service, which pulls in Prisma and node:fs.

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const ACCEPT_ATTRIBUTE = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

export const ATTACHMENT_ENTITIES = ["raw_material_lot", "production_order"] as const;
export type AttachmentEntityType = (typeof ATTACHMENT_ENTITIES)[number];

// The entity decides the kind: a raw-material lot carries its supplier's
// certificate of analysis, a production order carries floor evidence.
export const KIND_FOR_ENTITY = {
  raw_material_lot: "coa",
  production_order: "evidencia",
} as const satisfies Record<AttachmentEntityType, "coa" | "evidencia">;

// Plain string literals (not the Prisma `Role` enum) keep this module
// client-bundle safe; the service enforces these server-side.
export const UPLOAD_ROLES: Record<AttachmentEntityType, readonly string[]> = {
  raw_material_lot: ["bodega", "calidad"],
  production_order: ["operario", "jefe_planta", "calidad"],
};

export const VIEW_ROLES: Record<AttachmentEntityType, readonly string[]> = {
  raw_material_lot: ["bodega", "jefe_planta", "calidad", "director_tecnico", "admin"],
  production_order: ["operario", "jefe_planta", "calidad", "director_tecnico", "admin"],
};

export const uploadAttachmentFields = z.object({
  entityType: z.enum(ATTACHMENT_ENTITIES),
  entityId: z.string().uuid(),
});
