# CosmoQMS — Design System (Lab QMS)

Fuente de verdad para valores de diseño (Blueprint Sección 7). El builder debe seguir estos valores sin inventar nuevos. Los tokens viven como variables CSS en `src/app/globals.css` (Tailwind v4, `@theme inline` + `:root`/`.dark`) — no hay `tailwind.config.ts`.

## Colors

| Role                               | Hex                                  | Usage                                 |
| ---------------------------------- | ------------------------------------ | ------------------------------------- |
| Primary                            | `#0891B2`                            | Botones primarios, enlaces, foco      |
| Secondary                          | `#22D3EE`                            | Acentos secundarios                   |
| Accent (éxito/liberado)            | `#16A34A`                            | Estados aprobados/liberados           |
| Background                         | `#F0FDFA` (light) / `#0B1120` (dark) | Fondo de página                       |
| Surface / Card                     | `#FFFFFF` (light) / `#111827` (dark) | Tarjetas, paneles                     |
| Text                               | `#134E4A` (light) / `#E5E7EB` (dark) | Texto principal                       |
| Muted                              | `#475569` (light) / `#9CA3AF` (dark) | Texto secundario                      |
| Border                             | `#CCFBF1` (light) / `#1F2937` (dark) | Bordes, separadores                   |
| Destructive (rechazado/desviación) | `#DC2626`                            | Errores, rechazos, alertas críticas   |
| Pendiente/Revisión                 | `#D97706`                            | Estado ámbar — en revisión de calidad |

Todos los pares cumplen contraste mínimo 4.5:1 verificado en ambos modos. Nota: en modo oscuro `--muted-foreground` se ajusta a `#9CA3AF` (en vez de `#475569`) porque este último no alcanza 4.5:1 sobre `#0B1120`.

### Tailwind / shadcn token mapping

shadcn `accent`/`muted` conservan su significado shadcn habitual (fondos hover/sutiles). El verde de estado es `success`, nunca `accent`.

| Utility                                       | CSS var                         | Value (light)         |
| --------------------------------------------- | ------------------------------- | --------------------- |
| `bg-background` / `text-foreground`           | `--background` / `--foreground` | `#F0FDFA` / `#134E4A` |
| `bg-card` / `text-card-foreground`            | `--card` / `--card-foreground`  | `#FFFFFF` / `#134E4A` |
| `text-muted-foreground`                       | `--muted-foreground`            | `#475569`             |
| `bg-primary` / `text-primary`                 | `--primary`                     | `#0891B2`             |
| `bg-secondary`                                | `--secondary`                   | `#22D3EE`             |
| `bg-destructive` / `text-destructive`         | `--destructive`                 | `#DC2626`             |
| `border-border`                               | `--border`                      | `#CCFBF1`             |
| `ring-ring`                                   | `--ring`                        | `#0891B2`             |
| `bg-success` / `text-success` (CosmoQMS-only) | `--success`                     | `#16A34A`             |
| `bg-pending` / `text-pending` (CosmoQMS-only) | `--pending`                     | `#D97706`             |

## Typography

| Role                                     | Font             | Size      | Weight  |
| ---------------------------------------- | ---------------- | --------- | ------- |
| Headings                                 | Fira Sans        | 20–32px   | 600–700 |
| Body                                     | Fira Sans        | 16px base | 400–500 |
| Datos/códigos (lotes, pesos, timestamps) | Fira Code (mono) | 14–16px   | 400–500 |

Fuentes autohospedadas vía `next/font/google` (Fira Sans, Fira Code) — mapeadas a `font-sans` / `font-mono` en `@theme inline`. No se usa el `<link>` de Google Fonts para mantener la PWA offline.

## Spacing & Layout

- Escala densa (dashboard): 8, 12, 16, 24, 32, 48px
- Border radius: 8px default (`--radius`), 12px cards (`rounded-card` / `--radius-card`)
- Max content width: 1280px (desktop); mobile sin límite, padding 16px
- Breakpoints: 375, 768, 1024, 1440px
- Touch targets: mínimo 44×44px (uso con guantes en planta)

## Component Style

- Flat design, sin sombras ni gradientes decorativos
- Transiciones 150–300ms
- Iconografía SVG (Lucide) — nunca emoji
- Estados de lote siempre comunicados con color + texto + ícono (nunca solo color, por accesibilidad)
- Modo oscuro con el mismo contraste verificado (4.5:1 mínimo)
- Diseño persistido aquí (`design-system/lab-qms/MASTER.md`) para que el builder lo siga sin inventar valores.
