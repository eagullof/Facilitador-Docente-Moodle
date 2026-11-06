# Facilitador Docente Moodle

**Facilitador FP Virtual Aragón** es una extensión para Chrome que ayuda a realizar tareas docentes habituales en Moodle: configurar fechas, preparar cuestionarios, gestionar rúbricas, revisar foros y reutilizar retroalimentaciones.

**Versión: 2.3.2** · Manifest V3 · Interfaz en español

**[Instalar desde Chrome Web Store](https://chromewebstore.google.com/detail/facilitador-fpvirtualarag/abpofjlabipkaacmbcffbfcijkmmplkj?hl=es)**

> La versión publicada en Chrome Web Store puede ser anterior a la versión de este código. Esta extensión es independiente y no es un complemento oficial de Moodle ni de FP Virtual Aragón.

## Funciones principales

| Sección | Herramientas |
| --- | --- |
| **Visibilidad** | Ocultar elementos ocultos de Moodle y el botón de notificaciones de la cabecera. |
| **Tareas** | Aplicar fechas de entrega y cierre; crear rúbricas rápidas desde texto o completas desde CSV, con niveles y puntuaciones personalizados; recomendación de Moodle Rubric Importer para Excel. |
| **Corregir** | Calificar rúbricas como «No entregado» o «Perfecto»; crear, editar, seleccionar, eliminar e insertar plantillas de retroalimentación. |
| **Cuestionarios** | Aplicar fechas, preparar para imprimir, descargar PDF continuo, abrir vistas previas de preguntas. |
| **Acciones masivas** | Descargar informes Excel de calificaciones y respuestas de cuestionarios por sección. |
| **Foros** | Consultar los contadores de mensajes sin leer y acceder a los foros desde Moodle. |

## Nuevo en la versión 2.3.0: pestaña Corregir

Se ha trasladado **Calificar rúbrica** desde Tareas a la nueva pestaña **Corregir**. Sus botones **No entregado** y **Perfecto** conservan su funcionamiento habitual.

### Plantillas de retroalimentación

Puedes guardar hasta **50 plantillas generales de retroalimentación** en el almacenamiento local del navegador.

1. Abre **Corregir** y pulsa **Nueva**.
2. Escribe un **nombre identificativo** (por ejemplo, «Buen trabajo») y el **texto** que quieras reutilizar.
3. Pulsa **Guardar plantilla**.
4. Para otra corrección, abre la página de **calificación de una entrega** en Moodle, escoge una plantilla y pulsa **Escribir retroalimentación**.

La extensión busca el nombre del alumno en el bloque `[data-region="user-info"]` de Moodle, toma **solo el primer nombre**, lo escribe con inicial mayúscula y el resto en minúsculas, y añade automáticamente un saludo y una despedida al comentario:

```text
Hola José,

Has realizado un buen trabajo. Sigue así.

Un saludo.
```

Se utiliza la API de **TinyMCE**, si está disponible, para que el contenido quede correctamente registrado en el editor, y se admite el campo de texto plano como alternativa. El texto de la plantilla se trata como texto (no como HTML), conservando los párrafos y los saltos de línea.

**Importante:** el botón **sustituye** el comentario que ya exista en el editor. La extensión **no guarda automáticamente la calificación en Moodle**; revisa el resultado y pulsa el botón de guardado correspondiente del campus. Si el nombre del alumno o el editor no están disponibles, se informa del problema y no se inserta el comentario.

Las plantillas se pueden **seleccionar, modificar y eliminar**. Se guardan únicamente en `chrome.storage.local` de ese perfil de navegador: no se sincronizan con Moodle y no se incluyen automáticamente en otros dispositivos. **El nombre leído del alumno no se guarda en las plantillas.**

## Rúbricas

Desde **Tareas → Crear rúbrica desde texto**, escribe una línea por criterio con el formato `criterio;puntuaciónMáxima`:

```text
Contenido;10
Presentación;5
Ortografía;5
```

Pulsa **Aplicar rúbrica** desde el editor de rúbricas de Moodle. Para importar rúbricas desde Excel puedes usar la extensión independiente [Moodle Rubric Importer](https://chromewebstore.google.com/detail/moodle-rubric-importer/mibgeikbmhnmicoopgofmcaebkoplpch).

### Importar rúbricas desde CSV (nuevo en 2.3.2)

El apartado **Tareas → Importar rúbrica desde CSV** añade la posibilidad de crear rúbricas con **varios niveles por criterio** y descripciones y puntuaciones propias. Se ha adaptado el flujo de un importador CSV proporcionado como referencia, integrándolo en el panel de Facilitador y añadiendo validaciones y vista previa.

1. Abre el **editor de una rúbrica** en Moodle.
2. En el Facilitador, ve a **Tareas → Importar rúbrica desde CSV**.
3. Selecciona el archivo `.csv` y revisa los criterios y niveles detectados.
4. Pulsa **Importar rúbrica en Moodle**, confirma y revisa la rúbrica resultante antes de guardarla.

**Formato:** cuatro columnas con cabecera (`Criterio;Nivel;Descripción;Puntuación`), con **una fila por nivel** y repetición del nombre del criterio para agrupar sus niveles. Admite CSV con separador `;` o `,`, comillas escapadas y decimales con coma cuando el separador es `;`.

```csv
Criterio;Nivel;Descripción;Puntuación
Contenido;Inicial;No realizado;0
Contenido;Adecuado;Incluye los elementos fundamentales;2
Contenido;Excelente;Contenido completo y preciso;4
Presentación;Inicial;Poco claro;0
Presentación;Excelente;Presentación clara y ordenada;2
```

Puedes obtener una plantilla con el botón **Descargar CSV de ejemplo** o usar el fichero [ejemplos/plantilla-rubrica-moodle.csv](ejemplos/plantilla-rubrica-moodle.csv) incluido en el proyecto. En este formato, el texto de **Descripción** se inserta en los niveles de Moodle; la columna **Nivel** sirve de referencia y se usa como alternativa si falta la descripción.

El importador **no guarda automáticamente en Moodle** ni elimina filas o niveles sobrantes. Si el editor presenta una estructura distinta o no permite añadir criterios/niveles, mostrará un mensaje de error; comprueba los cambios antes de guardar. El archivo CSV se procesa dentro del navegador y no se envía a ningún servidor externo.

Para archivos **Excel `.xlsx`**, sigue disponible la recomendación de la extensión independiente Moodle Rubric Importer: el nuevo importador integrado trabaja con CSV, no directamente con `.xlsx`.

## Cuestionarios y PDF

**Preparar página** elimina la navegación secundaria `div.container-fluid.tertiary-navigation` y su contenido, y quita las clases `formulation` y `clearfix` cuando corresponda, sin borrar las preguntas. **Descargar PDF continuo** genera un PDF de una sola página vertical adaptada a la longitud del contenido, en lugar de paginarlo en A4.

La exportación puede tener límites para cuestionarios muy largos o con estilos especiales. Como alternativa, usa **Preparar página → Imprimir → Guardar como PDF**.

En **Acciones masivas**, abre primero la página principal del curso e introduce el nombre de la sección. La extensión recoge solo IDs de enlaces reales de cuestionarios a `/mod/quiz/view.php?id=...`; la disponibilidad de los informes depende de Moodle y de tus permisos docentes.

## Instalación

### Desde Chrome Web Store

Abre la [ficha de Facilitador FP Virtual Aragón](https://chromewebstore.google.com/detail/facilitador-fpvirtualarag/abpofjlabipkaacmbcffbfcijkmmplkj?hl=es), instala la extensión y recarga Moodle.

### Instalación manual o pruebas de versiones nuevas

1. Descarga el código del repositorio como ZIP y descomprímelo.
2. Abre `chrome://extensions`.
3. Activa **Modo desarrollador**.
4. Pulsa **Cargar descomprimida** y selecciona la carpeta que contiene `manifest.json`.
5. Recarga las pestañas de Moodle abiertas.

Para actualizar una copia instalada manualmente, sustituye los archivos y pulsa **Recargar** desde la página de extensiones. Si pruebas una versión manual junto a la de Chrome Web Store, desactiva una de las dos para evitar que se superpongan.

## Permisos y privacidad

La extensión solicita `scripting`, `activeTab`, `storage`, `sidePanel`, `debugger` y `downloads`, además del permiso de sitios `<all_urls>`.

- **`scripting` y `activeTab`**: ejecutar acciones sobre la página de Moodle activa.
- **`storage`**: recordar las preferencias y las plantillas de retroalimentación.
- **`sidePanel`**: mostrar el facilitador como panel lateral.
- **`debugger`**: utilizar temporalmente `Page.printToPDF` de Chrome para crear el PDF continuo y desconectar al finalizar.
- **`downloads`**: guardar PDF e informes Excel.
- **`<all_urls>`**: permitir que los scripts funcionen en distintos campus; es un permiso amplio que conviene limitar a los dominios Moodle si se adapta el proyecto a un centro concreto.

El nombre del alumno se lee únicamente de la página de corrección abierta y se utiliza para componer el saludo: **no se guarda ni se envía a servidores externos** por la función de plantillas. Las plantillas se guardan localmente en el perfil de Chrome; no almacenes en ellas datos personales innecesarios. La consulta de foros utiliza la sesión ya iniciada en Moodle y no necesita que introduzcas contraseñas en la extensión.

## Desarrollo y pruebas

Proyecto en JavaScript, HTML y CSS para **Chrome Manifest V3**. Los tests están en `tests/`:

```bash
cd tests
npm install
npm test
```

Las pruebas automatizadas utilizan ejemplos simulados de Moodle; comprueba la función en una entrega de prueba real antes de usarla con alumnado. Consulta también [LEEME-FOROS.txt](LEEME-FOROS.txt) para las limitaciones del lector de foros.

## Historial de versiones

- **2.3.2:** importación de rúbricas desde CSV con descripciones y puntuaciones por nivel, vista previa y plantilla de ejemplo.
- **2.3.1:** normalización del primer nombre (mayúscula inicial, resto en minúsculas), coma tras el saludo y despedida «Un saludo.» al final de cada retroalimentación.
- **2.3.0:** nueva pestaña Corregir; calificación de rúbrica trasladada; plantillas de retroalimentación locales y saludo automático con el primer nombre en TinyMCE.
- **2.2.0:** interfaz moderna y minimalista, nueva navegación e iconografía.
- **2.1.3:** ocultar notificaciones, revisión de acciones masivas, recomendación de importador de rúbricas Excel y retirada del ajuste de ancho.
- **2.1.2:** PDF de una sola página vertical continua.
- **2.1.1:** limpieza adicional de cuestionarios y descarga PDF desde Chrome.
- **2.1.0:** consulta de mensajes sin leer en foros.

## Licencia

MIT, según la documentación histórica del proyecto. Si redistribuyes el código, incorpora un archivo `LICENSE` con el texto completo de la licencia.

Proyecto: [eagullof/Facilitador-Docente-Moodle](https://github.com/eagullof/Facilitador-Docente-Moodle).
