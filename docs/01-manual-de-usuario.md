# Manual de usuario de CosmoQMS

Versión 1.0 · Para todo el personal. Antes de firmar en el sistema lea también
el [procedimiento de firma electrónica (SOP-SIS-001)](procedimientos/SOP-SIS-001-firma-electronica.md).

## Contenido

1. [Lo básico](#1-lo-básico) — entrar, el menú, sin señal, notificaciones, firmar
2. [Jefe de planta](#2-jefe-de-planta) — también hace el trabajo de planta: pesaje, firmas y desviaciones
3. [Bodega](#3-bodega)
4. [Calidad](#4-calidad)
5. [Director técnico](#5-director-técnico)
6. [Administrador](#6-administrador)
7. [Problemas frecuentes](#7-problemas-frecuentes)

CosmoQMS trabaja con **5 roles**: jefe de planta, bodega, calidad, director
técnico y administrador.

---

## 1. Lo básico

### Entrar

1. Abra la dirección de CosmoQMS en el navegador de la tableta, el celular o el computador.
2. Ingrese su correo y contraseña. Si tiene MFA, escriba el código de su aplicación autenticadora.
3. La primera vez su cuenta queda **pendiente** y ve "Sin acceso a CosmoQMS". El administrador le asigna
   el rol de su cargo y la activa; después pulse **Intentar de nuevo**.

Su cuenta es personal. Nunca entre con la cuenta de otra persona ni comparta la suya.

### El menú

El menú de la izquierda (arriba en el celular) muestra solo los módulos de su
rol. El administrador los ve todos, en solo lectura. Si escribe la dirección de un módulo que no le corresponde, el sistema lo
devuelve al Dashboard.

| Módulo | Para qué |
|---|---|
| Dashboard | Indicadores: lotes en curso, liberados, desviaciones abiertas, conformidad de QC |
| Materias Primas | Catálogo de materias primas, lotes recibidos, cuarentena, liberación, certificados (COA) |
| Fórmulas | Fórmulas maestras y su activación |
| Producción | Tablero de órdenes por etapa |
| Calidad | Resultados de QC pendientes y desviaciones |
| Trazabilidad | De un lote de materia prima al producto terminado, y al revés |
| Reportes | Reporte BPM en PDF o Excel |
| SOPs | Procedimientos vigentes y confirmación de lectura |
| Auditoría | Historial de cambios (quién, qué, cuándo) |
| Usuarios / Roles y permisos / Configuración | Administración (solo administrador) |

### Trabajar sin señal

En planta puede perder la conexión. Los **pesajes** se guardan primero en el
dispositivo y se envían solos cuando vuelve la señal.

- Arriba a la derecha, el indicador dice **Sincronizado** o cuántos eventos están **pendientes**.
- No cierre sesión ni borre los datos del navegador mientras haya pendientes.
- Cada pesaje se aplica una sola vez, aunque el envío se repita.

### Acciones rápidas

Arriba del **Dashboard** están los botones de lo que más hace su rol: por ejemplo, **Recibir lote** para bodega, **Nueva orden** para el jefe de planta, **Control de calidad** para calidad o **Lotes por liberar** para el director técnico. Las tarjetas de indicadores también son enlaces: al tocarlas abre la lista que hay detrás del número, si su rol puede verla.

### Mis pendientes

En el **Dashboard**, el recuadro **Mis pendientes** muestra lo que espera por
su rol, con un enlace a donde se hace: por ejemplo, al jefe de planta las órdenes por
pesar y las etapas por firmar; a calidad los lotes en cuarentena y las órdenes por analizar; al
director técnico los lotes listos para liberar. Si dice "Todo al día", no tiene
nada pendiente.

### Notificaciones

La campana de arriba muestra avisos: desviaciones nuevas, desviaciones listas
para aprobar, resultados de QC fuera de especificación, lotes de materia prima
recibidos en cuarentena (a calidad), órdenes listas para control de calidad
(a calidad) y lotes listos para liberar (al director técnico). Pulse **Ver detalle**
para ir al registro, y **Marcar como leída** cuando lo haya atendido.

### Firmar

Cada firma tiene tres pasos: leer la **declaración de significado**, pulsar
**Verificar identidad** (contraseña o código MFA) y pulsar el botón de firma.
Sin verificar identidad el botón no se activa. Una firma no se puede borrar:
si se equivocó, avise a su jefe para registrar una desviación.

---

## 2. Jefe de planta

Crea las fórmulas y las órdenes de producción, y hace el trabajo de planta:
pesa, firma las etapas de pesado, mezclado y envasado, y reporta desviaciones.

### Planta: registrar un pesaje

1. **Producción** → pulse la tarjeta de la orden.
2. Pulse **Registrar pesaje**.
3. Elija el lote de materia prima: pulse **Escanear** y apunte al QR del lote,
   o escriba en el buscador el nombre o código y pulse el lote.
   Solo aparecen lotes **liberados** por calidad, **sin vencer**, **con
   existencias** y de una materia prima de la fórmula. Cada lote muestra cuánto
   tiene disponible y cuándo vence.
4. Revise la **Cantidad teórica** que calcula el sistema.
5. Escriba la **Cantidad pesada**. El indicador de tolerancia se pone en verde,
   amarillo o rojo según la diferencia con la teórica.
6. Pulse **Registrar pesaje**. Repita por cada ingrediente; el botón dice
   cuántos faltan. El pesaje se descuenta del lote. Si el lote no alcanza, el
   sistema no deja registrar más de lo disponible: complete con otro lote de
   la misma materia prima.

### Planta: firmar una etapa

Cuando todos los ingredientes están pesados (o la etapa de mezclado o envasado
terminó), en la orden aparece **Firmar**:

1. Pulse **Firmar** y lea la declaración, por ejemplo
   *"Confirmo que realicé el pesaje conforme a la fórmula maestra"*.
2. **Verificar identidad** → **Firmar**. La orden pasa a la siguiente etapa.

### Planta: reportar una desviación

Si algo no sale como dice el procedimiento (derrame, equipo, cantidad fuera de
tolerancia):

1. En la orden pulse **Reportar desviación**.
2. Describa qué ocurrió, cuándo y en qué etapa. Pulse **Reportar desviación**.
3. Calidad recibe el aviso y la investiga.

### Planta: adjuntar evidencia y leer SOPs

- En la orden, sección de evidencias: elija el archivo (foto o PDF) y pulse **Subir**.
- **SOPs**: los que dicen **Pendiente de leer** debe abrirlos, leer el
  documento y pulsar **Confirmar lectura**.


### Crear una fórmula maestra

1. **Fórmulas** → **Nueva fórmula**.
2. Código, nombre y tipo de producto.
3. Por cada ingrediente: materia prima y porcentaje. **Agregar ingrediente** para sumar filas.
   El total debe dar **100% ± 0,5%** (se pone en verde).
4. **Guardar fórmula**. Queda en **Borrador** hasta que calidad la active.

### Corregir una fórmula en borrador

Abra la fórmula en **Borrador**. En **Ingredientes (borrador editable)** puede
cambiar el porcentaje (escríbalo y pulse Enter), quitar un ingrediente con la
papelera o agregar otro. El total se pone en verde al llegar a 100 % ± 0,5 %.

### Crear una nueva versión de una fórmula activa

Una fórmula activa no se modifica. Para cambiarla:

1. Abra la fórmula **Activa** y pulse **Crear versión N**. El sistema copia los
   ingredientes y las especificaciones en un borrador nuevo.
2. Ajuste el borrador y avise a calidad.
3. Cuando calidad activa la nueva versión, la anterior queda **Archivada**. Las
   órdenes ya creadas conservan la versión con la que se hicieron, y el
   **Historial de versiones** de la fórmula muestra todas.

### Programar una orden de producción

1. **Producción** → **Nueva orden**.
2. Elija la fórmula (solo aparecen las **activas**), la cantidad planificada y la fecha de inicio.
3. **Crear orden**. Aparece en la columna **Planificado** con su número.

---

## 3. Bodega

### Mantener el catálogo de materias primas

El catálogo dice qué materias primas existen en el laboratorio. Una materia
prima tiene que estar en el catálogo antes de recibir un lote de ella o de
usarla en una fórmula.

1. **Materias Primas** → **Catálogo**.
2. En **Nueva materia prima** escriba el código (por ejemplo `MP-006`), el
   nombre, la unidad y, si quiere, la categoría. Pulse **Agregar**.
3. Para corregir el nombre, la unidad o la categoría, pulse el lápiz de la
   fila, cambie el dato y pulse **Guardar**. El código no se cambia.
4. El ícono de la papelera elimina una materia prima creada por error. El
   sistema no deja eliminar una que ya tiene lotes recibidos o que está en una
   fórmula, porque hace parte del historial de los lotes.

### Recibir materia prima

1. **Materias Primas** → **Recibir lote**.
2. Si el empaque trae QR o código de barras del proveedor, pulse **Leer QR del
   proveedor** y apunte la cámara. Con un lector de mano (USB o Bluetooth), haga
   clic en el campo **Lector de mano** y escanee. CosmoQMS llena los datos que
   traiga el código y muestra un resumen de lo que leyó:
   - materia prima, si el código o el nombre coincide con el catálogo;
   - lote del proveedor, cantidad y fecha de vencimiento;
   - enlace al COA y código del proveedor (por ejemplo, el GTIN).
3. Revise cada campo y complete lo que falte: la materia prima, el **código de
   lote del proveedor**, la cantidad y la fecha de vencimiento. Si el resumen dice
   que la materia prima no está en el catálogo, selecciónela a mano.
4. **Recibir lote**. El lote queda en **Cuarentena** con su QR interno, aunque
   los datos hayan venido del QR del proveedor. Calidad recibe un aviso.
5. En el lote, pulse **Imprimir etiqueta con QR**: sale una etiqueta de
   100 × 70 mm con el QR, la materia prima, el lote del proveedor, el estado y
   el vencimiento. Péguela en el bulto.
6. En el lote, adjunte el **certificado de análisis (COA)** en PDF y pulse **Subir**.

Formatos de QR que CosmoQMS entiende:

| Formato | Ejemplo |
|---|---|
| GS1 (estándar de la industria) | `(01)07701234567893(10)GLIC-118(17)270630(30)50` |
| GS1 Digital Link | `https://id.gs1.org/01/07701234567893/10/GLIC-118?17=270630` |
| JSON | `{"codigo":"MP-002","lote":"GLIC-118","cantidad":50,"vence":"2027-06-30"}` |
| Texto con campos | `MATERIAL: Glicerina Vegetal; LOTE: GLIC-118; VENCE: 30/06/2027` |

En GS1, el código de la materia prima se lee del campo `(240)`. Si su
proveedor solo trae el GTIN `(01)`, registre ese GTIN como código de la materia
prima en el catálogo para que se reconozca sola. Un código con otro formato se
guarda tal cual en **Código del proveedor**.

### Buscar lotes

En **Materias Primas** escriba en el buscador el lote, código o nombre y pulse
**Buscar**. La tabla muestra el lote del proveedor, el estado, lo **disponible**
y el vencimiento. Se marcan con aviso los lotes que vencen en menos de 30 días,
los **vencidos**, los de **stock bajo** (menos del 10 % de lo recibido) y los
**agotados**.

---

## 4. Calidad

### Liberar o rechazar materia prima

1. **Materias Primas** → abra el lote en **Cuarentena**.
2. Revise el COA adjunto.
3. **Liberar lote** o **Rechazar lote**. Solo los liberados se pueden pesar.
   Un lote vencido no se puede liberar, solo rechazar.
4. Reimprima la etiqueta (**Imprimir etiqueta con QR**) para que el bulto
   muestre el estado nuevo.

### Definir las especificaciones de calidad de una fórmula

Las especificaciones son los rangos contra los que se evalúa cada lote (por
ejemplo, pH entre 5,5 y 7 o viscosidad entre 8.000 y 12.000 cP).

1. Abra la fórmula en **Borrador**.
2. En **Especificaciones de calidad** escriba el parámetro, el mínimo, el
   máximo (puede dejar uno de los dos vacío) y la unidad. Pulse **Agregar**.
3. La papelera de cada fila quita una especificación.

Solo se cambian mientras la fórmula está en borrador: una vez activa, cambiar
un rango requiere una nueva versión de la fórmula. Defínalas antes de activar.

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

- **Batch record**: en la orden, **Descargar batch record (PDF)** genera el
  registro del lote con los datos de la empresa, los pesajes con el lote usado,
  las firmas con su nombre, el control de calidad contra la especificación y
  las desviaciones con su CAPA.
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

## 5. Director técnico

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

## 6. Administrador

El administrador gestiona los accesos y los datos de la empresa, y supervisa
el sistema. Entra a **todos los módulos en modo supervisión (solo lectura)**:
arriba aparece el aviso "Modo supervisión". Por separación de funciones (BPM)
**no** recibe lotes, no pesa, no firma, no libera y no aprueba: esos botones no
le aparecen y el servidor rechaza esas acciones si las intenta.

### Usuarios

1. **Usuarios** muestra a cada persona con su correo, rol y si tiene **MFA activo**.
2. Una persona nueva aparece **Inactiva o pendiente**: elija su rol en la lista (uno de los 5) y
   pulse **Reactivar** para darle acceso. Solo la primera cuenta de la empresa entra sola, como
   administrador.
3. Para cambiar el rol de alguien, elíjalo en la lista y confirme.
4. **Desactivar** quita el acceso de inmediato (retiro, cambio de cargo,
   pérdida de credenciales); **Reactivar** lo devuelve.
5. Usted no puede cambiar su propio acceso: lo hace otro administrador.
6. Cada cambio queda en **Auditoría** (tabla User).
7. Arriba aparecen los **cupos de Clerk** usados. Si la organización está llena, una persona nueva no
   puede entrar: siga el manual de administrador (§4) para liberar un cupo.

### Roles y permisos

**Roles y permisos** muestra qué hace cada rol, cuántas personas activas lo
tienen y una tabla con cada acción del sistema y los roles que pueden
hacerla. Es la referencia para decidir qué rol darle a una persona según su
cargo; el rol se asigna en **Usuarios**. Los permisos de cada rol no se editan
desde la pantalla: los fija la separación de funciones y los valida el
servidor en cada acción.

### Revisión de accesos

Hágala al menos cada tres meses y guarde el CSV como evidencia.

1. **Usuarios** → **Revisión de accesos**.
2. La tabla muestra cada cuenta con su rol, estado, MFA y último ingreso, y
   marca los hallazgos: cuenta activa **sin MFA**, que **nunca ha ingresado** o
   que **no ingresa hace más de 90 días**, y administrador sin MFA.
3. Corrija cada hallazgo: desactive a quien ya no trabaja en el laboratorio,
   ajuste el rol o pida a la persona que active el MFA.
4. **Descargar CSV** guarda la revisión con la fecha y su nombre.

### Configuración

**Configuración** guarda la razón social, el NIT y el registro INVIMA que
aparecen en el reporte BPM, en el batch record y en las etiquetas. Pulse
**Guardar**; el cambio queda en la auditoría.

---

## 7. Problemas frecuentes

| Situación | Qué hacer |
|---|---|
| "Sin acceso a CosmoQMS" | Su cuenta está pendiente (recién creada) o desactivada. Avise al administrador para que le asigne su rol y la active; luego pulse **Intentar de nuevo** |
| No aparece el lote para pesar | El lote no está liberado, está vencido, se agotó o no es de una materia prima de la fórmula. Avise a calidad o a bodega |
| El botón **Firmar** no se activa | Falta **Verificar identidad**, o en la etapa pesado faltan ingredientes por pesar |
| El indicador dice que hay eventos pendientes | No tiene señal. Siga trabajando; se envían solos al reconectar. No cierre sesión |
| No ve un módulo | Su rol no lo incluye. Si lo necesita para su trabajo, pídalo a su jefe y al administrador |
| Me equivoqué en una firma o un pesaje | No se borra. Reporte una desviación explicando el error |
