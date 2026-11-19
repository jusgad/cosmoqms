import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { AttachmentError, readAttachment } from "@/lib/attachments/service";
import { getStorage } from "@/lib/storage/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  try {
    const { attachment, bytes } = await readAttachment({ user, id, storage: getStorage() });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        // `mimeType` was detected from the file's magic bytes at upload and
        // is one of PDF/PNG/JPEG/WEBP; `nosniff` keeps browsers from
        // reinterpreting it.
        "Content-Type": attachment.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `inline; filename="${attachment.fileName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AttachmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
