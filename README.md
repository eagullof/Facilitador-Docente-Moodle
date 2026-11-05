# Facilitador Docente Moodle

**Extensión para Google Chrome que simplifica tareas de docencia y evaluación en Moodle**, desarrollada pensando especialmente en FP Virtual Aragón.

**Versión actual: 2.2.0** · Manifest V3 · Interfaz en español

**[Instalar Facilitador FP Virtual Aragón desde Chrome Web Store](https://chromewebstore.google.com/detail/facilitador-fpvirtualarag/abpofjlabipkaacmbcffbfcijkmmplkj?hl=es)**

Permite trabajar con rúbricas, configurar fechas, preparar cuestionarios, descargar informes y consultar foros sin leer desde un panel compacto con cinco secciones.

> **Aviso:** es una herramienta independiente, no un complemento oficial de Moodle ni de FP Virtual Aragón. Algunas funciones dependen de la estructura HTML, los permisos docentes y la versión del campus; conviene comprobar los resultados antes de guardar cambios o realizar descargas masivas.

## Funciones

| Sección | Qué permite hacer |
| --- | --- |
| **Visibilidad** | Ocultar actividades marcadas como ocultas y esconder la campana de notificaciones de la barra superior. Las preferencias se recuerdan localmente. |
| **Tareas** | Establecer fechas de entrega y límite; marcar todos los criterios de una rúbrica como **No entregado** o **Perfecto**; generar criterios de rúbrica a partir de texto. |
| **Cuestionarios** | Establecer fechas de apertura y cierre; abrir vistas previas de preguntas; limpiar una vista previa para imprimirla y **descargar un PDF vertical continuo**. |
| **Acciones masivas** | Solicitar informes Excel de calificaciones y respuestas de los cuestionarios de una sección concreta del curso. |
| **Foros** | Consultar los contadores de mensajes sin leer, filtrar resultados y acceder a los foros desde el popup o desde el Área personal de Moodle. |

### Rúbricas: formato de texto

En **Tareas → Crear rúbrica desde texto**, escribe un criterio por línea, separado de su puntuación máxima mediante punto y coma:

```text
Contenido;10
Presentación;5
Ortografía;5
```

Abre primero el editor de creación de la rúbrica en Moodle; después pega los criterios y pulsa **Aplicar rúbrica**. La extensión incorpora también un prompt orientativo para preparar este texto con ayuda de IA.

Para importar rúbricas **desde ficheros Excel**, recomendamos la extensión independiente [Moodle Rubric Importer](https://chromewebstore.google.com/detail/moodle-rubric-importer/mibgeikbmhnmicoopgofmcaebkoplpch). No forma parte de Facilitador y debe instalarse por separado.

### Preparación de cuestionarios y PDF

En una vista previa o revisión de cuestionario:

1. Pulsa **Preparar página** para quitar elementos que dificultan la impresión.
2. Si quieres un archivo, pulsa **Descargar PDF continuo**. La extensión aplica la misma limpieza y genera un PDF de **una sola página vertical**, ajustando su altura al contenido.

La preparación elimina, entre otros, el bloque `div.container-fluid.tertiary-navigation` y sus hijos. También retira las clases `formulation` y `clearfix` de los contenedores correspondientes **sin eliminar las preguntas ni sus respuestas**.

El PDF tiene límites técnicos para documentos extremadamente largos y su resultado depende del contenido y los estilos del campus. Si la exportación falla, prueba **Preparar página → Imprimir → Guardar como PDF** desde Chrome.

### Informes de cuestionarios por sección

Desde la **página principal del curso**, abre **Acciones masivas**, introduce el **nombre exacto de la sección** y pulsa **Descargar informes**.

Se usan los identificadores de los enlaces reales a cuestionarios (`/mod/quiz/view.php?id=...`), en lugar de IDs genéricos de actividades. La extensión solicita informes Excel de calificaciones y respuestas, pero su obtención depende de los permisos de la cuenta, de la estructura del curso y de la respuesta del servidor Moodle. Chrome puede pedir autorización para varias descargas.

### Foros sin leer

En **Foros** puedes consultar los contadores que ofrece Moodle, filtrar cursos y foros, actualizar o cancelar una consulta y añadir enlaces a cursos que no se hayan detectado automáticamente. También hay un resumen en el **Área personal**.

La consulta usa la sesión abierta en el mismo campus. No abre las discusiones ni cambia deliberadamente su estado de lectura. Un foro **sin seguimiento** no debe interpretarse como cero mensajes sin leer; la extensión puede mostrar resultados parciales si el campus no expone todos los contadores.

Consulta [LEEME-FOROS.txt](LEEME-FOROS.txt) para detalles de funcionamiento y limitaciones.

## Instalación

### Desde Chrome Web Store (recomendado)

Abre la **[ficha oficial de Facilitador FP Virtual Aragón en Chrome Web Store](https://chromewebstore.google.com/detail/facilitador-fpvirtualarag/abpofjlabipkaacmbcffbfcijkmmplkj?hl=es)** y pulsa **Añadir a Chrome**. Después, recarga las pestañas de Moodle que estuvieran abiertas.

La versión publicada en Chrome Web Store puede diferir de la versión más reciente del código de este repositorio.

### Instalación o actualización manual

1. Descarga el repositorio como ZIP desde **Code → Download ZIP** y descomprímelo, o clónalo con Git.
2. Abre `chrome://extensions` en Chrome (o `edge://extensions` en Edge).
3. Activa **Modo desarrollador**.
4. Selecciona **Cargar descomprimida** y elige la carpeta que contiene `manifest.json`.
5. Abre Moodle o recarga las pestañas del campus que ya estuvieran abiertas.

Para actualizar una copia descomprimida, sustituye sus archivos por los de la nueva versión y pulsa **Recargar** en la página de extensiones. Evita dejar activas simultáneamente dos copias de Facilitador.

No necesitas instalar dependencias de Node.js para **usar** la extensión.

## Uso rápido

- **Visibilidad:** activa o desactiva las preferencias en el panel.
- **Tareas:** abre la configuración o la pantalla de calificación de la tarea antes de usar sus botones.
- **Cuestionarios:** trabaja desde la edición del cuestionario, el banco de preguntas o la vista previa, según la función.
- **Acciones masivas:** abre la portada del curso, no la página de un cuestionario individual.
- **Foros:** mantén una pestaña de Moodle abierta y la sesión iniciada mientras se realiza la consulta.

Los cambios de fechas y rúbricas deben revisarse y guardarse en Moodle cuando corresponda.

### Atajos de teclado

| Atajo | Acción |
| --- | --- |
| `Alt + T` | Preparar la vista previa del cuestionario para imprimir. |
| `Alt + P` | Abrir vistas previas de preguntas, cuando los enlaces estén disponibles. |
| `Alt + Mayús + 1` | Marcar los criterios de la rúbrica como **No entregado**. |
| `Alt + Mayús + 2` | Marcar los criterios de la rúbrica como **Perfecto**. |

Los atajos pueden variar o entrar en conflicto con otros atajos del sistema o del navegador. Los de comandos de la extensión se pueden consultar en `chrome://extensions/shortcuts`.

## Permisos y privacidad

La versión 2.2.0 solicita estos permisos en `manifest.json`:

| Permiso | Para qué se utiliza |
| --- | --- |
| `scripting` y `activeTab` | Ejecutar acciones en la pestaña activa, como aplicar fechas o preparar cuestionarios. |
| `storage` | Guardar preferencias de visibilidad y opciones de la consulta de foros. |
| `sidePanel` | Mostrar la interfaz también como panel lateral. |
| `debugger` | Acceder temporalmente a `Page.printToPDF` de Chrome para generar el PDF continuo. La conexión se cierra al terminar la operación. |
| `downloads` | Guardar el PDF y solicitar la descarga de informes Excel. |
| `<all_urls>` | Permite ejecutar los scripts de contenido en diferentes direcciones web. Es un permiso amplio: conviene usar la extensión solo si se confía en su código y valorar restringirlo a los dominios Moodle necesarios en futuras versiones. |

La herramienta de foros consulta el campus con la sesión ya iniciada y utiliza los contadores que proporciona Moodle. Sus opciones se almacenan localmente; no necesita que introduzcas credenciales en la extensión. Las solicitudes pueden quedar registradas en los logs habituales del servidor.

Chrome puede mostrar un aviso cuando se usa el permiso `debugger` durante la generación del PDF. La disponibilidad de estas funciones puede verse limitada por políticas del navegador o del centro educativo.

## Desarrollo y pruebas

El proyecto utiliza **JavaScript, HTML y CSS** con Chrome Extensions **Manifest V3**. El código de la extensión está en la raíz del repositorio; las pruebas automatizadas están en `tests/`.

Para ejecutarlas necesitas una versión de Node.js compatible con el `package.json` del directorio de pruebas:

```bash
cd tests
npm install
npm test
```

Las pruebas automatizadas cubren funciones del popup, preparación de cuestionarios, acciones masivas, visibilidad y foros. Parte de las comprobaciones usa páginas y respuestas simuladas: **no sustituye las pruebas manuales en un campus Moodle real**.

## Historial de cambios

### 2.2.0 — Rediseño de interfaz
- Diseño moderno y minimalista: cabecera, navegación con iconos, tarjetas, botones y formularios coherentes.
- Mejor presentación de las cinco pestañas en popup y panel lateral.
- Nuevo estilo de iconos y ajustes visuales de la sección Foros.
- Se mantienen las funciones de la versión 2.1.3.

### 2.1.3 — Visibilidad y acciones masivas
- Nueva preferencia para ocultar las notificaciones de la barra superior mediante `hidden`.
- Retirado el ajuste de ancho de rúbricas.
- Recomendación de Moodle Rubric Importer para archivos Excel.
- Validación de los IDs de cuestionarios usados en las descargas masivas.

### 2.1.2 — PDF continuo
- PDF del cuestionario en una sola página vertical, en vez de varias hojas A4.
- Ajuste de altura y tratamiento de saltos de página.

### 2.1.1 — Limpieza y descarga de cuestionarios
- Eliminación de la navegación secundaria y retirada de clases CSS de formulación sin borrar el contenido.
- Descarga PDF desde Chrome con los permisos `debugger` y `downloads`.

### 2.1.0 — Foros sin leer
- Pestaña Foros y resumen en el Área personal.
- Consulta de contadores, filtros, cursos adicionales y gestión de resultados parciales.

## Licencia

La documentación del proyecto indica **MIT**. Para facilitar su reutilización, se recomienda incluir un archivo `LICENSE` con el texto completo de esa licencia.

---

Proyecto mantenido por [eagullof](https://github.com/eagullof) · [Repositorio en GitHub](https://github.com/eagullof/Facilitador-Docente-Moodle)
