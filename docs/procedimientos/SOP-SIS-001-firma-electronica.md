# SOP-SIS-001 · Uso de la firma electrónica en CosmoQMS

| Campo | Valor |
|---|---|
| Código | SOP-SIS-001 |
| Versión | 1.0 |
| Aplica a | Todo el personal con usuario en CosmoQMS |
| Elaboró | __________________ (Calidad) |
| Aprobó | __________________ (Director Técnico) |
| Vigente desde | ____ / ____ / ________ |

> Una vez aprobado, cargue este procedimiento en CosmoQMS (módulo SOPs) para
> que el personal confirme su lectura.

## 1. Objetivo

Establecer cómo se usa la firma electrónica de CosmoQMS para que tenga el
mismo valor que la firma manuscrita en los registros BPM.

## 2. Qué es una firma electrónica en CosmoQMS

Es la acción de **firmar** una etapa de lote, **liberar o rechazar** un lote
terminado, o **aprobar** un SOP. Cada firma queda unida al registro firmado y
guarda, de forma que no se puede modificar ni borrar:

- quién firmó (nombre de la cuenta personal);
- fecha y hora (hora de Bogotá);
- la **declaración de significado** que la persona aceptó, por ejemplo
  *"Confirmo que realicé el pesaje conforme a la fórmula maestra"*;
- la constancia de que la identidad se verificó en ese momento.

## 3. Compromiso de equivalencia

Antes de recibir su usuario, cada persona firma en papel este compromiso, que
se archiva en su carpeta de personal:

> *Reconozco que mi firma electrónica en CosmoQMS es legalmente equivalente a
> mi firma manuscrita, que soy responsable de todo lo que se firme con mi
> cuenta y que no compartiré mis credenciales con nadie.*
>
> Nombre: ______________________ Cargo: ______________ Firma: __________ Fecha: ________

## 4. Reglas

1. **Una cuenta por persona.** Las cuentas son personales e intransferibles.
   Nunca se usa una cuenta genérica ni la de otra persona.
2. **Las credenciales no se comparten.** Nadie, ni siquiera un jefe o el
   administrador, pide ni conoce la contraseña o el código MFA de otra persona.
3. **MFA obligatorio** para calidad, director técnico y administrador
   (aplicación autenticadora). Recomendado para todos. Se configura en Clerk
   (exigir MFA, si el plan lo permite) y Calidad lo verifica en **Usuarios**,
   donde cada cuenta con MFA muestra "MFA activo" (ver revisión trimestral).
4. **Se firma solo lo que se hizo o se verificó**, en el momento (registro
   contemporáneo). No se firma por otra persona ni "después" de memoria.
5. **Leer la declaración antes de firmar.** La declaración aparece en pantalla;
   si no describe lo que la persona hizo, no firma y avisa a su jefe.
6. **Reautenticación en cada firma.** CosmoQMS pide verificar la identidad
   (contraseña o MFA) inmediatamente antes de firmar. El botón "Firmar" no se
   activa sin esa verificación, y el servidor la vuelve a comprobar.
7. **Roles.** Cada etapa la firma solo el rol autorizado: las etapas de
   producción, operario o jefe de planta; la etapa de calidad, calidad o
   director técnico; la liberación o rechazo del lote y la aprobación de SOPs,
   solo el director técnico.
8. **Errores.** Una firma no se borra ni se edita. Si una firma fue un error,
   se registra una **desviación** que lo explica y se corrige con un registro
   nuevo, según el procedimiento de desviaciones.
9. **Pérdida o sospecha de uso indebido** de la cuenta o del celular con el
   autenticador: avisar de inmediato al administrador, que desactiva la cuenta
   en Usuarios; Calidad evalúa los registros firmados desde la última vez que
   la cuenta estaba bajo control.
10. **Altas, cambios y bajas.** El administrador asigna el rol según el cargo
    aprobado por el jefe del área y desactiva la cuenta el mismo día en que la
    persona se retira o cambia de funciones. Todo cambio queda en la auditoría.
11. **Sesión.** Al dejar el equipo, cerrar sesión o bloquear la pantalla.

## 5. Cómo firmar (paso a paso)

1. Abra la orden (o el SOP) y pulse **Firmar** (o **Liberar lote**, **Rechazar
   lote**, **Aprobar como vigente**).
2. Lea la **declaración de significado**.
3. Pulse **Verificar identidad** e ingrese su contraseña o el código de su
   aplicación autenticadora.
4. Cuando aparezca "Identidad verificada", pulse el botón de firma.
5. Compruebe que la firma aparece en el registro con su nombre y la hora.

## 6. Revisión

Calidad revisa cada trimestre, en la Auditoría de CosmoQMS, las altas, bajas y
cambios de rol; comprueba que las personas retiradas tengan su cuenta
desactivada y, en Usuarios, que calidad, director técnico y administrador
tengan "MFA activo". El resultado se registra y se archiva.

## 7. Registros

- Compromisos de equivalencia firmados (carpeta de personal).
- Registro de capacitación en este procedimiento.
- Revisiones trimestrales de accesos.
