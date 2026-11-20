# CosmoQMS

Sistema de producción y control de calidad (MES/QMS) para laboratorio
cosmético, diseñado para cumplir BPM e INVIMA (Colombia).

Registra el ciclo completo de cada lote: recepción y liberación de materias
primas, fórmulas maestras, órdenes de producción, pesaje (también sin
conexión), firmas electrónicas con reautenticación, control de calidad,
desviaciones y CAPA, liberación del lote, trazabilidad, control de documentos
(SOPs), audit trail y reporte BPM.

## Documentación

Toda la documentación está en [`docs/`](docs/README.md):

- [Manual de usuario](docs/01-manual-de-usuario.md)
- [Manual técnico](docs/02-manual-tecnico.md)
- [Manual arquitectónico](docs/03-manual-arquitectonico.md)
- [Manual de desarrollador](docs/04-manual-de-desarrollador.md)
- [Manual de administrador](docs/05-manual-de-administrador.md)
- Anexos: firma electrónica, paquete de validación IQ/OQ/PQ y API (OpenAPI)

## Inicio rápido

```bash
corepack enable && pnpm install
cp .env.example .env
docker compose up -d --build
```

Detalle en el [manual de administrador](docs/05-manual-de-administrador.md)
(producción) y el [manual de desarrollador](docs/04-manual-de-desarrollador.md) (desarrollo).

## Tecnología

Next.js 15 · TypeScript · Tailwind CSS 4 · tRPC · Prisma · PostgreSQL 16 ·
Clerk · Serwist + Dexie (PWA sin conexión) · Playwright · Docker
