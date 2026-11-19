import { NextResponse } from "next/server";
import { requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth";
import { loadProductionReport } from "@/lib/reports/loadProductionReport";
import { renderReportHtml, toCsv } from "@/lib/reports/productionReport";
import { renderPdf } from "@/lib/pdf";
import { productionReportQuery } from "@/lib/validation/reports";

// GET /api/reports/produccion?from=AAAA-MM-DD&to=AAAA-MM-DD&format=csv|pdf
// Same audience as the batch-record PDF: calidad and director_tecnico.
export async function GET(req: Request) {
  let user;
  try {
    user = await requireRole(["calidad", "director_tecnico"]);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
    throw err;
  }

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const query = productionReportQuery.safeParse(params);
  if (!query.success) {
    return NextResponse.json({ error: query.error.issues[0]?.message ?? "Parámetros inválidos" }, { status: 400 });
  }

  const { header, rows } = await loadProductionReport(user, query.data.from, query.data.to);
  const baseName = `reporte-bpm-${query.data.fromLabel}_${query.data.toLabel}`;

  if (query.data.format === "pdf") {
    const pdf = await renderPdf(renderReportHtml(header, rows), {
      landscape: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
