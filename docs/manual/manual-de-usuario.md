# Manual de usuario de CosmoQMS

Versión 1.0 · Para todo el personal. Antes de firmar en el sistema lea también
el [procedimiento de firma electrónica (SOP-SIS-001)](../procedimientos/SOP-SIS-001-firma-electronica.md).

## Contenido

1. [Lo básico](#1-lo-básico) — entrar, el menú, sin señal, notificaciones, firmar
2. [Operario](#2-operario)
3. [Jefe de planta](#3-jefe-de-planta)
4. [Bodega](#4-bodega)
5. [Calidad](#5-calidad)
6. [Director técnico](#6-director-técnico)
7. [Administrador](#7-administrador)
8. [Problemas frecuentes](#8-problemas-frecuentes)

---

## 1. Lo básico

### Entrar

1. Abra la dirección de CosmoQMS en el navegador de la tableta, el celular o el computador.
2. Ingrese su correo y contraseña. Si tiene MFA, escriba el código de su aplicación autenticadora.
3. La primera vez su cuenta queda como **Operario**. El administrador le asigna el rol de su cargo.

Su cuenta es personal. Nunca entre con la cuenta de otra persona ni comparta la suya.

### El menú

El menú de la izquierda (arriba en el celular) muestra solo los módulos de su
rol. Si escribe la dirección de un módulo que no le corresponde, el sistema lo
devuelve al Dashboard.

| Módulo | Para qué |
|---|---|
| Dashboard | Indicadores: lotes en curso, liberados, desviaciones abiertas, conformidad de QC |
| Materias Primas | Lotes recibidos, cuarentena, liberación, certificados (COA) |
| Fórmulas | Fórmulas maestras y su activación |
| Producción | Tablero de órdenes por etapa |
| Calidad | Resultados de QC pendientes y desviaciones |
| Trazabilidad | De un lote de materia prima al producto terminado, y al revés |
| Reportes | Reporte BPM en PDF o Excel |
| SOPs | Procedimientos vigentes y confirmación de lectura |
| Auditoría | Historial de cambios (quién, qué, cuándo) |
| Usuarios / Configuración | Administración (solo administrador) |

### Trabajar sin señal

En planta puede perder la conexión. Los **pesajes** se guardan primero en el
dispositivo y se envían solos cuando vuelve la señal.

- Arriba a la derecha, el indicador dice **Sincronizado** o cuántos eventos están **pendientes**.
- No cierre sesión ni borre los datos del navegador mientras haya pendientes.
- Cada pesaje se aplica una sola vez, aunque el envío se repita.

### Notificaciones

La campana de arriba muestra avisos: desviaciones nuevas, desviaciones listas
para aprobar y resultados de QC fuera de especificación. Pulse **Ver detalle**
para ir al registro, y **Marcar como leída** cuando lo haya atendido.

### Firmar

Cada firma tiene tres pasos: leer la **declaración de significado**, pulsar
**Verificar identidad** (contraseña o código MFA) y pulsar el botón de firma.
Sin verificar identidad el botón no se activa. Una firma no se puede borrar:
si se equivocó, avise a su jefe para registrar una desviación.

---

## 2. Operario

### Registrar un pesaje

1. **Producción** → pulse la tarjeta de la orden.
2. Pulse **Registrar pesaje**.
3. Elija el lote de materia prima: pulse **Escanear** y apunte al QR del lote,
   o escriba en el buscador el nombre o código y pulse el lote.
   Solo aparecen lotes **liberados** por calidad.
4. Revise la **Cantidad teórica** que calcula el sistema.
5. Escriba la **Cantidad pesada**. El indicador de tolerancia se pone en verde,
   amarillo o rojo según la diferencia con la teórica.
6. Pulse **Registrar pesaje**. Repita por cada ingrediente; el botón dice
   cuántos faltan.

### Firmar una etapa

Cuando todos los ingredientes están pesados (o la etapa de mezclado o envasado
terminó), en la orden aparece **Firmar**:

1. Pulse **Firmar** y lea la declaración, por ejemplo
   *"Confirmo que realicé el pesaje conforme a la fórmula maestra"*.
2. **Verificar identidad** → **Firmar**. La orden pasa a la siguiente etapa.

### Reportar una desviación

Si algo no sale como dice el procedimiento (derrame, equipo, cantidad fuera de
tolerancia):

1. En la orden pulse **Reportar desviación**.
2. Describa qué ocurrió, cuándo y en qué etapa. Pulse **Reportar desviación**.
3. Calidad recibe el aviso y la investiga.

### Adjuntar evidencia y leer SOPs

- En la orden, sección de evidencias: elija el archivo (foto o PDF) y pulse **Subir**.
- **SOPs**: los que dicen **Pendiente de leer** debe abrirlos, leer el
  documento y pulsar **Confirmar lectura**.

---

## 3. Jefe de planta

Hace todo lo del operario y además:

### Crear una fórmula maestra

1. **Fórmulas** → **Nueva fórmula**.
2. Código, nombre y tipo de producto.
3. Por cada ingrediente: materia prima y porcentaje. **Agregar ingrediente** para sumar filas.
   El total debe dar **100% ± 0,5%** (se pone en verde).
4. **Guardar fórmula**. Queda en **Borrador** hasta que calidad la active.

### Programar una orden de producción

1. **Producción** → **Nueva orden**.
2. Elija la fórmula (solo aparecen las **activas**), la cantidad planificada y la fecha de inicio.
3. **Crear orden**. Aparece en la columna **Planificado** con su número.

---

## 4. Bodega

### Recibir materia prima

1. **Materias Primas** → **Recibir lote**.
2. Elija la materia prima, escriba el **código de lote del proveedor**, la
   cantidad y la fecha de vencimiento. Si el empaque trae código de barras o QR
   del proveedor, puede pulsar **Escanear**.
3. **Recibir lote**. El lote queda en **Cuarentena** con su QR interno: imprímalo y péguelo.
4. En el lote, adjunte el **certificado de análisis (COA)** en PDF y pulse **Subir**.

### Buscar lotes

En **Materias Primas** escriba en el buscador el lote, código o nombre y pulse
**Buscar**. Los lotes que vencen en menos de 30 días se marcan con un aviso.

---

## 5. Calidad

### Liberar o rechazar materia prima

1. **Materias Primas** → abra el lote en **Cuarentena**.
2. Revise el COA adjunto.
3. **Liberar lote** o **Rechazar lote**. Solo los liberados se pueden pesar.

### Activar una fórmula

Abra la fórmula en **Borrador** y pulse **Activar**. El sistema no la activa si
los ingredientes no suman 100% ± 0,5%.

### Registrar resultados de control de calidad

1. **Calidad** → en la tabla de pendientes, **Registrar resultado** en la orden.
2. Escriba el parámetro y el valor medido. El sistema calcula si es
   **CONFORME** o **FALLA** según la especificación de la fórmula.
3. Un resultado fuera de especificación avisa al director técnico y al jefe de planta.

### Firmar la etapa de calidad

Cuando la orden está en la etapa **Calidad** y los resultados están
registrados, pulse **Firmar** en la orden (declaración: *"Confirmo la
validación de calidad de este lote"*).

### Investigar una desviación

1. **Calidad** → desviaciones → abra la desviación.
2. **Iniciar investigación**.
3. Escriba la investigación (causa raíz) y la **acción correctiva/preventiva**.
4. **Enviar para aprobación**: el director técnico la aprueba y la cierra.

### Trazabilidad y reportes

- **Trazabilidad**: elija la dirección de búsqueda, escriba el código de lote
  de materia prima (o de producto terminado) y pulse **Buscar**.
- **Reportes**: elija el período (**Desde**, **Hasta**) y pulse **Descargar PDF**
  o **Descargar Excel (CSV)**.

### Controlar SOPs

1. **SOPs** → **Nuevo SOP**: código, título y descripción → **Crear borrador**.
2. En el borrador, adjunte el documento en PDF y pulse **Subir**.
3. El director técnico lo aprueba. Para cambiar un SOP vigente, ábralo y pulse
   **Nueva versión**: el documento aprobado nunca se edita.
4. En un SOP vigente, la sección **Lectura del personal** muestra quién lo
   leyó y quién está pendiente.

---

## 6. Director técnico

Ve todos los módulos de calidad y además:

### Liberar o rechazar el lote terminado

1. Abra la orden en etapa **Calidad**.
2. **Liberar lote** (o **Rechazar lote**). El sistema no deja liberar si falta
   un resultado de QC de algún parámetro especificado, si hay uno **FALLA** o si
   hay desviaciones abiertas.
3. Lea la declaración, **Verificar identidad** y confirme. Es la firma de
   liberación del lote al mercado.

### Aprobar desviaciones

En la desviación **Pendiente de aprobación**, revise la investigación y la
acción correctiva y pulse **Aprobar y cerrar**.

### Aprobar un SOP

1. **SOPs** → abra el borrador (debe tener su PDF adjunto).
2. Revise **Vigente desde** y **Próxima revisión** (por defecto, dos años).
3. **Verificar identidad** → **Aprobar como vigente**. La versión anterior queda obsoleta.

### Auditoría

**Auditoría** muestra cada cambio con fecha, tabla, registro, acción y
usuario. Filtre por tabla, usuario o fechas con **Filtrar** y descargue el
resultado en CSV.

---

## 7. Administrador

El administrador gestiona accesos y datos de la empresa. Por separación de
funciones **no** ve Producción ni Calidad y no firma lotes.

### Usuarios

1. **Usuarios** muestra a cada persona con su correo, rol y si tiene **MFA activo**.
2. Para cambiar el rol, elíjalo en la lista y confirme.
3. **Desactivar** quita el acceso de inmediato (retiro, cambio de cargo,
   pérdida de credenciales); **Reactivar** lo devuelve.
4. Usted no puede cambiar su propio acceso: lo hace otro administrador.
5. Cada cambio queda en **Auditoría** (tabla User).

### Configuración

**Configuración** guarda la razón social, el NIT y el registro INVIMA que
aparecen en el reporte BPM y en los registros de lote. Pulse **Guardar**; el
cambio queda en la auditoría.

---

## 8. Problemas frecuentes

| Situación | Qué hacer |
|---|---|
| "Sin acceso a CosmoQMS" | Su cuenta está desactivada o recién creada. Espere unos segundos y pulse **Intentar de nuevo**; si sigue, avise al administrador |
| No aparece el lote para pesar | El lote no está liberado o es de otra materia prima de la fórmula. Avise a calidad |
| El botón **Firmar** no se activa | Falta **Verificar identidad**, o en la etapa pesado faltan ingredientes por pesar |
| El indicador dice que hay eventos pendientes | No tiene señal. Siga trabajando; se envían solos al reconectar. No cierre sesión |
| No ve un módulo | Su rol no lo incluye. Si lo necesita para su trabajo, pídalo a su jefe y al administrador |
| Me equivoqué en una firma o un pesaje | No se borra. Reporte una desviación explicando el error |
