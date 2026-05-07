# Manual de Usuario — ProteCheck

## ¿Qué es ProteCheck?

ProteCheck es una aplicación web para verificar el cumplimiento normativo de voluntarios de Protección Civil. Analiza los informes `.xls` exportados desde **Apúntate** y calcula automáticamente el estado de cada voluntario respecto a los tres requisitos de cumplimiento: horas de PC, control trimestral y formación en RCP+AIT.

> **🔒 Privacidad y Seguridad:** ProteCheck funciona 100% de forma local en tu navegador. Ningún archivo Excel, dato personal o información de los voluntarios sale de tu ordenador. No hay bases de datos ni servidores externos procesando la información.

---

## Primeros pasos

### 1. Seleccionar carpeta

Haz clic en el botón **📁 Seleccionar Carpeta** en la cabecera de la aplicación y elige la carpeta que contiene los archivos `.xls` exportados desde Apúntate. El nombre de cada archivo debe incluir el número de voluntario (por ejemplo, `15970.xls`).

ProteCheck procesará todos los archivos de la carpeta y mostrará los resultados en la tabla.

### 2. Arrastrar y soltar archivos individuales

Puedes arrastrar un archivo `.xls` directamente sobre la ventana de la aplicación para añadir o actualizar un voluntario concreto sin necesidad de recargar toda la carpeta.

### 3. Refrescar datos

El botón **🔄** (aparece tras cargar una carpeta) recarga todos los archivos de la carpeta preservando los ajustes manuales de Jefatura y Psicosocial que hayas aplicado.

---

## Panel principal

### Métricas rápidas

En la parte superior de la pantalla se muestran cuatro contadores:

| Contador | Descripción |
|---|---|
| **VOLUNTARIOS** | Total de voluntarios cargados |
| **APTOS** | Voluntarios que cumplen los tres requisitos |
| **ALERTA** | Voluntarios que fallan uno o dos requisitos |
| **PELIGRO** | Voluntarios que fallan los tres requisitos |

### La tabla de voluntarios

Cada fila representa un voluntario. Las columnas se pueden ordenar haciendo clic en su cabecera.

| Columna | Descripción |
|---|---|
| **NVOL** | Número de voluntario |
| **ANTIGÜEDAD** | Años desde el primer servicio registrado |
| **SERVICIOS** | Número de servicios en el período activo |
| **H.TOT** | Total de horas en el período (válidas + no válidas) |
| **HORAS PC** | Horas válidas de Protección Civil para el requisito de 80 h. Un `~` indica ajuste manual. |
| **H.PSICO** | Horas de atención psicosocial |
| **RETÉN PC** | Horas de retén en SAMUR/Fénix |
| **TRIMESTRAL** | Días transcurridos desde el último servicio válido |
| **RCP/AIT** | Fecha del último reciclaje detectado (MM/AAAA) o *EXENTO* si antigüedad < 3 años |
| **ESTADO** | Estado de cumplimiento global: **APTO** / **ALERTA** / **PELIGRO** |

---

## Estados de cumplimiento

### APTO

El voluntario cumple los tres requisitos de cumplimiento normativo.

### ALERTA

El voluntario falla uno o dos de los tres requisitos. Hay que revisar qué condición está incumplida.

### PELIGRO

El voluntario falla los tres requisitos simultáneamente.

### La lógica completa

**Requisito 1 — 80 horas de PC**

En la ventana de tiempo seleccionada, el voluntario debe acumular al menos **80 horas de Protección Civil válidas**. Las categorías que cuentan son las de motivos 2.2, 4.1, 4.2, 6.1, 6.7, 6.5 y todos los prefijos 3.x y 7.x, más los servicios marcados como "Entrevista". Los servicios de "Oficina Voluntario" cuentan con un límite de uno por período, excepto para voluntarios en Jefatura.

**Requisito 2 — Control de los 90 días**

El último servicio válido no puede haber ocurrido hace más de **90 días**. Este control es absoluto: no se ve afectado por el filtro de período seleccionado.

**Requisito 3 — RCP + AIT vigentes**

Debe constar en el historial un reciclaje o recertificación de **RCP** y otro de **AIT** en los últimos **3 años**. ProteCheck lo detecta buscando en la denominación del servicio palabras como *RECICLAJE*, *RECERTIFICACIÓN* o *MÓDULO* junto con *RCP*, *SVB* o *AIT*. Los voluntarios con menos de 3 años de antigüedad están **exentos** de este requisito.

---

## Filtros

### // ESTADO

| Opción | Muestra |
|---|---|
| **TODOS** | Todos los voluntarios |
| **APTOS** | Solo los voluntarios en estado APTO |
| **ALERTA · PELIGRO** | Solo los que tienen algún incumplimiento |
| **FALLA RCP** | Solo los que no tienen RCP+AIT en vigor |

### // HORAS

| Opción | Descripción |
|---|---|
| **FIRMADAS** | Usa las horas efectivamente realizadas (recomendado) |
| **PROGRAMADAS** | Usa las horas previstas en el servicio |

### // PERIODO

| Opción | Descripción |
|---|---|
| **AÑO ACTUAL** | Desde el 1 de enero del año en curso hasta hoy |
| **12M EXACTOS** | Los 365 días anteriores a la fecha de hoy |
| **12M VENCIDO** | Desde el día 1 del mes de hace 12 meses (período de cotización habitual) |
| **3 MESES** | Los últimos 90 días |

> **Nota:** el período solo afecta al cálculo de las 80 horas. El control de los 90 días y el requisito de RCP+AIT son siempre absolutos.

---

## Modal de detalle del voluntario

Haz clic en cualquier fila de la tabla para abrir el panel de detalle. Se muestra:

- **Cabecera**: estado, antigüedad, horas PC acumuladas y días sin servicio válido.
- **Alertas activas**: qué requisitos están incumplidos.
- **Tabla de servicios**: todos los registros del voluntario con fecha, denominación, lugar, horas y si cuentan para el cálculo.

### Columna ACC — ajustes manuales

Cada servicio tiene un menú de acción en la columna **ACC**:

**H.PC** — Fuerza que el servicio cuente (o deje de contar) como horas de Protección Civil, independientemente de su código de motivo. Un servicio ajustado manualmente aparece marcado con `~` en la tabla principal.

**+ Psicosocial** — Marca el servicio como atención psicosocial, sumándolo al contador H.PSICO.

### Toggle ES JEFATURA

Activar este interruptor en el modal indica que el voluntario ocupa un puesto de mando. En este modo, todos los servicios de "Oficina Voluntario" cuentan como horas de PC sin límite por período.

---

## Exportación

Usa los botones de la parte superior de la tabla para exportar los datos:

| Formato | Descripción |
|---|---|
| **XLSX** | Libro Excel con todas las columnas y metadatos calculados |
| **CSV** | Tabla plana compatible con cualquier hoja de cálculo |
| **PDF** | Informe de cumplimiento listo para imprimir o archivar |

Los archivos exportados reflejan el estado actual del panel, con los filtros y ajustes manuales aplicados.

---

## Preguntas frecuentes

**¿Qué archivos acepta ProteCheck?**
Archivos `.xls` o `.xlsx` exportados directamente desde Apúntate. El nombre del archivo debe contener el número de voluntario como secuencia numérica (por ejemplo, `15970.xls` o `Informe_15970.xls`).

**¿Por qué un voluntario aparece como ALERTA aunque tiene muchas horas?**
Puede estar fallando el control de los 90 días o el requisito de RCP+AIT. Abre el modal de detalle haciendo clic en la fila para ver exactamente qué condición está incumplida.

**¿Qué es el período "12M VENCIDO"?**
Cuenta desde el primer día del mes de hace 12 meses hasta hoy. Es útil para calcular el cumplimiento anual de la misma forma que se calcularía en un período de cotización o liquidación mensual.

**¿Cómo sé si se ha detectado el RCP?**
Si el voluntario tiene un reciclaje en los últimos 3 años, la columna **RCP/AIT** de la tabla mostrará la fecha (MM/AAAA). Si aparece en verde en el modal de detalle, está en vigor. Si el voluntario tiene menos de 3 años de antigüedad, aparece como *EXENTO*.

**¿Se pierden los ajustes manuales al refrescar?**
Los ajustes de **Jefatura** y **Psicosocial** se conservan al usar el botón 🔄. Los ajustes de **H.PC** también se preservan. Sin embargo, todos los ajustes se pierden si se cierra la aplicación.

---

## Contacto

Para reportar errores o sugerencias: mrz_coding_sol.figure210@passinbox.com

Repositorio: https://github.com/miguelrzazo/ProteCheck
