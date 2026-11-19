import { randomUUID } from "node:crypto";
import type { Attachment, Prisma } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import type { FileStorage } from "@/lib/storage/storage";
import { detectMimeType, sanitizeFileName } from "@/lib/attachments/sniff";
import {
  KIND_FOR_ENTITY,
  MAX_ATTACHMENT_BYTES,
  UPLOAD_ROLES,
  VIEW_ROLES,
  type AttachmentEntityType,
} from "@/lib/validation/attachments";

export class AttachmentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 413 | 415,
  ) {
    super(message);
  }
}

// The entity must exist in the caller's own tenant — an attachment can never
// hang off another tenant's lot or order.
async function assertEntityInTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<void> {
  const found =
    entityType === "raw_material_lot"
      ? await tx.rawMaterialLot.findFirst({ where: { id: entityId, tenantId }, select: { id: true } })
      : await tx.productionOrder.findFirst({ where: { id: entityId, tenantId }, select: { id: true } });
  if (!found) {
    throw new AttachmentError(
      entityType === "raw_material_lot" ? "Lote de materia prima no encontrado" : "Orden de producción no encontrada",
      404,
    );
  }
}

export async function uploadAttachment(params: {
  user: CurrentUser;
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  bytes: Uint8Array;
  storage: FileStorage;
}): Promise<Attachment> {
  const { user, entityType, entityId, bytes, storage } = params;

  if (!UPLOAD_ROLES[entityType].includes(user.role)) {
    throw new AttachmentError(`El rol '${user.role}' no puede adjuntar archivos aquí`, 403);
  }
  if (bytes.length === 0) {
    throw new AttachmentError("El archivo está vacío", 400);
  }
  if (bytes.length > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentError("El archivo supera el límite de 10 MB", 413);
  }
  const mimeType = detectMimeType(bytes);
  if (!mimeType) {
    throw new AttachmentError("Solo se aceptan PDF, PNG, JPG o WEBP", 415);
  }

  const fileName = sanitizeFileName(params.fileName);
  const storageKey = `${user.tenantId}/${entityType}/${entityId}/${randomUUID()}-${fileName}`;

  return withTenant(user.tenantId, user.id, async (tx) => {
    await assertEntityInTenant(tx, user.tenantId, entityType, entityId);
    // File first, row second: if the insert fails the transaction rolls back
    // and the stored object is an unreferenced orphan — never the reverse (a
    // row pointing at a file that doesn't exist).
    await storage.put(storageKey, bytes, mimeType);
    return tx.attachment.create({
      data: {
        tenantId: user.tenantId,
        entityType,
        entityId,
        kind: KIND_FOR_ENTITY[entityType],
        fileName,
        mimeType,
        sizeBytes: bytes.length,
        storageKey,
        uploadedBy: user.id,
      },
    });
  });
}

export async function readAttachment(params: {
  user: CurrentUser;
  id: string;
  storage: FileStorage;
}): Promise<{ attachment: Attachment; bytes: Uint8Array }> {
  const { user, id, storage } = params;
  const attachment = await withTenant(user.tenantId, user.id, (tx) =>
    tx.attachment.findFirst({ where: { id, tenantId: user.tenantId } }),
  );
  // Same 404 for "doesn't exist" and "not yours to see", so ids can't be
  // probed across tenants or roles.
  if (!attachment || !VIEW_ROLES[attachment.entityType].includes(user.role)) {
    throw new AttachmentError("Archivo no encontrado", 404);
  }
  return { attachment, bytes: await storage.get(attachment.storageKey) };
}

export type AttachmentListItem = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  uploadedByName: string;
};

// For Server Components that already hold a tenant transaction.
export async function listAttachments(
  tx: Prisma.TransactionClient,
  tenantId: string,
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<AttachmentListItem[]> {
  const rows = await tx.attachment.findMany({
    where: { tenantId, entityType, entityId },
    orderBy: { uploadedAt: "desc" },
  });
  const uploaders = await tx.user.findMany({
    where: { tenantId, id: { in: [...new Set(rows.map((row) => row.uploadedBy))] } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(uploaders.map((uploader) => [uploader.id, uploader.fullName]));
  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt,
    uploadedByName: nameById.get(row.uploadedBy) ?? row.uploadedBy,
  }));
}
