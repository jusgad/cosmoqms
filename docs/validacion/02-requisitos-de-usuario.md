# VAL-URS-001 · Especificación de requisitos de usuario

Versión 1.0 · Ver [plan maestro](01-plan-maestro-validacion.md) para criterios de riesgo.

| ID | Requisito | Riesgo |
|---|---|---|
| URS-01 | Cada persona entra con su propio usuario y contraseña; el sistema ofrece MFA. Hay seis roles (operario, jefe de planta, bodega, calidad, director técnico, administrador) y cada uno ve y hace solo lo de su función. El administrador supervisa todos los módulos en solo lectura, consulta la matriz de roles y hace la revisión periódica de accesos; no opera producción ni calidad (no recibe, pesa, firma, libera ni aprueba). | Alto |
| URS-02 | Los datos de una empresa nunca son visibles para otra. El aislamiento se aplica también en la base de datos (Row Level Security), no solo en la aplicación. | Alto |
| URS-03 | Toda materia prima recibida queda en **cuarentena** con un código interno único (QR), proveedor, cantidad, vencimiento y certificado de análisis (COA) adjunto. | Alto |
| URS-04 | Solo bodega o calidad liberan o rechazan un lote de materia prima, y solo desde cuarentena. Solo los lotes liberados se pueden usar en el pesaje. | Alto |
| URS-05 | Las fórmulas maestras tienen código, versión e ingredientes en porcentaje. Solo calidad activa una fórmula, y solo si sus ingredientes suman 100% ± 0,5%. Calidad define las especificaciones de QC mientras la fórmula está en borrador. Una fórmula activa no se edita: el cambio es una nueva versión, y al activarla la anterior queda archivada. | Alto |
| URS-06 | Las órdenes de producción se crean solo desde una fórmula activa, con un número de orden único por empresa. | Medio |
| URS-07 | El pesaje registra el lote usado, la cantidad teórica y la pesada, con indicador de tolerancia. Funciona sin conexión y, al reconectar, cada pesaje se aplica una sola vez. El pesaje descuenta el inventario del lote, no admite más de lo disponible y no acepta lotes vencidos (un lote vencido tampoco se puede liberar). | Alto |
| URS-08 | Las etapas del lote (planificado → pesado → mezclado → envasado → calidad → liberado/rechazado) avanzan solo según una máquina de estados validada en el servidor; no se puede saltar etapas ni firmar pesado sin todos los ingredientes pesados. | Alto |
| URS-09 | Cada firma electrónica exige volver a verificar la identidad en el momento (reautenticación), muestra y guarda la declaración de significado, registra quién y cuándo, y solo la puede hacer el rol autorizado para esa etapa. | Alto |
| URS-10 | Los resultados de QC se comparan con la especificación de la fórmula; el veredicto (conforme / no conforme) lo calcula el servidor. Un resultado fuera de especificación notifica a calidad, director técnico y jefe de planta. | Alto |
| URS-11 | Solo el director técnico libera o rechaza el lote terminado, con firma electrónica. No se puede liberar sin resultados de QC para cada parámetro especificado, con un resultado no conforme ni con desviaciones abiertas. | Alto |
| URS-12 | Las desviaciones se reportan desde planta, calidad las investiga con causa raíz y CAPA, y el director técnico las aprueba y cierra. | Alto |
| URS-13 | Trazabilidad completa: desde un lote de materia prima hasta los lotes terminados que lo usaron, y al revés. | Alto |
| URS-14 | Audit trail: toda creación o cambio en tablas reguladas (órdenes, eventos de lote, QC, desviaciones, lotes terminados), usuarios, SOPs y datos de la empresa queda registrado con quién, qué, cuándo, antes y después, en la misma transacción. Los eventos de lote, el audit trail y los adjuntos no se pueden modificar ni borrar. | Alto |
| URS-15 | Se puede descargar el batch record de cada orden en PDF con los datos de la empresa, la fórmula y su versión, los pesajes con el lote usado, las firmas con el nombre de quien firmó, los resultados de QC contra la especificación, las desviaciones con su CAPA y los eventos. | Medio |
| URS-16 | Reporte BPM por período en CSV (Excel es-CO) y PDF con datos de la empresa, decisiones, QC, desviaciones y lotes de materia prima. | Medio |
| URS-17 | Control de documentos: los SOPs pasan de borrador a vigente solo con la firma del director técnico y su documento adjunto; la versión anterior queda obsoleta; el documento aprobado no cambia; el personal confirma la lectura de la versión vigente y calidad ve quién falta. | Alto |
| URS-18 | El administrador gestiona roles y activa o desactiva cuentas; cada cambio queda en el audit trail y nadie cambia su propio acceso. | Alto |
| URS-19 | Respaldo diario de la base y los adjuntos con verificación de integridad, retención configurable y simulacro de restauración comprobable. | Alto |
| URS-20 | El sistema informa su estado de salud y permite detectar caídas y respaldos fallidos. | Medio |
| URS-21 | Uso en planta: funciona en celular y tableta, con botones de al menos 44 × 44 px. | Bajo |
| URS-22 | Bodega mantiene el catálogo de materias primas e imprime una etiqueta con el QR interno de cada lote; una materia prima con historial no se elimina. | Medio |
| URS-23 | Cada rol ve sus pendientes en el dashboard y recibe un aviso cuando le toca actuar (lote en cuarentena, orden lista para calidad, lote listo para liberar). | Medio |
| URS-24 | El administrador supervisa todos los módulos en solo lectura, consulta la matriz de roles y hace la revisión periódica de accesos (MFA, último ingreso) con evidencia en CSV. | Medio |
