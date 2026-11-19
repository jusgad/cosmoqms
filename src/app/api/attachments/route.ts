import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AttachmentError, uploadAttachment } from "@/lib/attachments/service";
import { getStorage } from "@/lib/storage/storage";
import { uploadAttachmentFields } from "@/lib/validation/attachments";

// multipart/form-data: `file`, `entityType` (raw_material_lot |
// production_order), `entityId`. Role, tenant ownership, size and the real
// file type are all checked in `uploadAttachment`.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Se esperaba multipart/form-data" }, { status: 400 });
  }

  const fields = uploadAttachmentFields.safeParse({
    entityType: form.get("entityType"),
    entityId: form.get("entityId"),
  });
  const file = form.get("file");
  if (!fields.success || !(file instanceof File)) {
    return NextResponse.json({ error: "Faltan el archivo, el tipo de entidad o su id" }, { status: 400 });
  }

  try {
    const attachment = await uploadAttachment({
      user,
      entityType: fields.data.entityType,
      entityId: fields.data.entityId,
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      storage: getStorage(),
    });
    return NextResponse.json(
      {
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        uploadedAt: attachment.uploadedAt,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AttachmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
