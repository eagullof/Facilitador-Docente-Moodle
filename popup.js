// Esta función se ejecuta en la página activa de Moodle. El ID de un enlace
// /mod/quiz/view.php?id=... es un course-module ID (cmid) válido para report.php.
// Los data-id de los contenedores de sección o actividad NO son fiables para ello.
function obtenerDescargasCuestionarios(nombreSeccion) {
    const normalizar = (texto) => (texto || "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    const nombre = normalizar(nombreSeccion);
    const secciones = document.querySelectorAll('li.section, .course-section, [data-region="section"]');
    const ids = new Set();
    const cuestionarios = [];
    let coincidencias = 0;

    for (const seccion of secciones) {
        const titulo = seccion.querySelector('.sectionname, [data-region="sectionname"], .course-section-header h3');
        if (!titulo || normalizar(titulo.textContent) !== nombre) continue;
        coincidencias++;

        // Se aceptan exclusivamente los enlaces de actividades reales de tipo quiz.
        // Nunca se toman IDs del atributo data-id de sus contenedores.
        for (const enlace of seccion.querySelectorAll('a[href*="/mod/quiz/view.php"]')) {
            if (!enlace.closest('.activity, .activity-item, [data-modname="quiz"]')) continue;
            let url;
            try { url = new URL(enlace.href, window.location.href); } catch { continue; }
            if (url.origin !== window.location.origin || !url.pathname.endsWith('/mod/quiz/view.php')) continue;
            const valor = url.searchParams.get('id');
            if (!/^[1-9]\d*$/.test(valor || '')) continue;
            const id = Number(valor);
            if (!Number.isSafeInteger(id) || ids.has(id)) continue;
            ids.add(id);
            cuestionarios.push({ id, nombre: enlace.textContent.trim(), url: url.href });
        }
    }

    // Moodle no siempre muestra un input sesskey en la portada del curso.
    // Su ausencia no impide consultar los informes mediante GET.
    const sesskey = document.querySelector('input[name="sesskey"]')?.value || '';
    const descargas = [];
    for (const quiz of cuestionarios) {
        for (const modo of ['overview', 'responses']) {
            // Conserva cualquier subdirectorio de instalación (/moodle/mod/quiz/...).
            const informe = new URL('report.php', quiz.url);
            informe.search = '';
            informe.searchParams.set('id', String(quiz.id));
            informe.searchParams.set('mode', modo);
            informe.searchParams.set('download', 'excel');
            informe.searchParams.set('attempts', 'enrolled_with');
            informe.searchParams.set('slotmarks', '1');
            if (modo === 'responses') {
                informe.searchParams.set('qtext', '1');
                informe.searchParams.set('resp', '1');
                informe.searchParams.set('right', '1');
            }
            if (sesskey) informe.searchParams.set('sesskey', sesskey);
            descargas.push({ id: quiz.id, modo, url: informe.href });
        }
    }
    return { coincidencias, cuestionarios, descargas };
}

document.addEventListener("DOMContentLoaded", () => {

    // 1. Inicialización de Tooltips y Popovers (Bootstrap)
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
    [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));

    // Cerrar popovers al hacer clic fuera
    document.addEventListener("click", (e) => {
        document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => {
            const pop = bootstrap.Popover.getInstance(el);
            if (pop && !el.contains(e.target)) pop.hide();
        });
    });

    // Función auxiliar para registrar eventos de forma segura
    const addSafeListener = (id, event, callback) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, callback);
        }
    };

    // Botón: No entregado
    addSafeListener("btn-no-entregado", "click", async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;
            
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const levels = document.querySelectorAll(".levels");
                    levels.forEach(level => {
                        const firstTd = level.querySelector("td");
                        if (firstTd) firstTd.click();
                    });
                    const commentsEditor = document.getElementById("id_assignfeedbackcomments_editoreditable");
                    if (commentsEditor) commentsEditor.innerHTML = "No entregado.";
                }
            });
        } catch (error) {
            console.error("Error al marcar como no entregado:", error);
        }
    });

    // Botón: Perfecto
    addSafeListener("btn-perfecto", "click", async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const levels = document.querySelectorAll(".levels");
                    levels.forEach(level => {
                        const tds = level.querySelectorAll("td");
                        if (tds.length) tds[tds.length - 1].click();
                    });
                    const commentsEditor = document.getElementById("id_assignfeedbackcomments_editoreditable");
                    if (commentsEditor) commentsEditor.innerHTML = "¡Buen trabajo!";
                }
            });
        } catch (error) {
            console.error("Error al marcar como perfecto:", error);
        }
    });

    // Botón: Aplicar rúbrica
    addSafeListener("btn-aplicar-rubrica", "click", async () => {
        try {
            const inputRubrica = document.getElementById("input-rubrica");
            if (!inputRubrica) return;
            const csvData = inputRubrica.value;

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (csvData) => {
                    // Soporta separación por '#' o por salto de línea '\n'
                    const lines = csvData.split(/[\n#]/).filter(Boolean);
                    const headers = ["item", "puntos"];
                    const items = lines.map(line => {
                        const values = line.split(";");
                        return headers.reduce((obj, key, i) => {
                            obj[key] = values[i]?.replace(/(^"|"$)/g, "") || null;
                            return obj;
                        }, {});
                    });

                    if (!items.length) return;

                    const h1Text = document.querySelector("#page-header h1")?.textContent || "";
                    const input = document.getElementById("id_name");
                    if (input && h1Text) input.value = h1Text;

                    const addBtn = document.getElementById("rubric-criteria-addcriterion");
                    if (!addBtn) return;

                    for (let i = 0; i < items.length - 1; i++) addBtn.click();

                    document.getElementById("page")?.click();
                    document.getElementById("rubric-options-lockzeropoints")?.click();

                    items.forEach(async (item, i) => {
                        const baseId = `rubric-criteria-NEWID${i + 1}`;
                        const parent = document.getElementById(baseId);
                        if (!parent) return;

                        parent.querySelector(".btn")?.click();

                        // Espera de 50ms para permitir renderizado de elementos
                        await new Promise(resolve => setTimeout(resolve, 50));

                        const elems = parent.querySelectorAll(".textvalue");
                        const areas = parent.querySelectorAll("textarea");
                        const inputs = parent.querySelectorAll("span.scorevalue input, input.hiddenelement");

                        if (!elems.length) return;

                        elems[0].textContent = areas[0].textContent = item.item;
                        elems[1].textContent = areas[1].textContent = "No realizado";
                        elems[2].textContent = "0"; 
                        if (inputs[0]) inputs[0].value = "0";

                        elems[3].textContent = areas[2].textContent = "Incompleto/incorrecto";
                        elems[4].textContent = (item.puntos / 4).toString(); 
                        if (inputs[1]) inputs[1].value = (item.puntos / 4).toString();

                        elems[5].textContent = areas[3].textContent = "Realizado con errores";
                        elems[6].textContent = (item.puntos / 2).toString(); 
                        if (inputs[2]) inputs[2].value = (item.puntos / 2).toString();

                        elems[7].textContent = areas[4].textContent = "Correcto";
                        elems[8].textContent = item.puntos.toString(); 
                        if (inputs[3]) inputs[3].value = item.puntos.toString();
                    });
                },
                args: [csvData]
            });
        } catch (error) {
            console.error("Error al aplicar rúbrica:", error);
        }
    });

    // Botón: Establecer fechas tarea
    addSafeListener("btn-fechas-tarea", "click", async () => {
        try {
            const dueDateVal = document.getElementById("input-duedate-tarea")?.value;
            const cutoffDateVal = document.getElementById("input-cutoffdate-tarea")?.value;

            const now = new Date();
            const dueObj = dueDateVal ? new Date(dueDateVal + "T00:00:00") : now;
            const cutoffObj = cutoffDateVal ? new Date(cutoffDateVal + "T00:00:00") : now;

            const dueData = {
                day: dueObj.getDate(),
                month: dueObj.getMonth() + 1,
                year: dueObj.getFullYear()
            };

            const cutoffData = {
                day: cutoffObj.getDate(),
                month: cutoffObj.getMonth() + 1,
                year: cutoffObj.getFullYear()
            };

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (due, cutoff) => {
                    const dueCheckbox = document.getElementById("id_duedate_enabled");
                    if (dueCheckbox && !dueCheckbox.checked) dueCheckbox.click();

                    const cutoffCheckbox = document.getElementById("id_cutoffdate_enabled");
                    if (cutoffCheckbox && !cutoffCheckbox.checked) cutoffCheckbox.click();

                    if (document.getElementById("id_duedate_day")) document.getElementById("id_duedate_day").value = due.day;
                    if (document.getElementById("id_duedate_month")) document.getElementById("id_duedate_month").value = due.month;
                    if (document.getElementById("id_duedate_year")) document.getElementById("id_duedate_year").value = due.year;
                    if (document.getElementById("id_duedate_hour")) document.getElementById("id_duedate_hour").value = 23;
                    if (document.getElementById("id_duedate_minute")) document.getElementById("id_duedate_minute").value = 59;

                    if (document.getElementById("id_cutoffdate_day")) document.getElementById("id_cutoffdate_day").value = cutoff.day;
                    if (document.getElementById("id_cutoffdate_month")) document.getElementById("id_cutoffdate_month").value = cutoff.month;
                    if (document.getElementById("id_cutoffdate_year")) document.getElementById("id_cutoffdate_year").value = cutoff.year;
                    if (document.getElementById("id_cutoffdate_hour")) document.getElementById("id_cutoffdate_hour").value = 23;
                    if (document.getElementById("id_cutoffdate_minute")) document.getElementById("id_cutoffdate_minute").value = 59;

                    const attemptReopen = document.getElementById("id_attemptreopenmethod");
                    if (attemptReopen) attemptReopen.selectedIndex = 1;

                    const notifyStudents = document.getElementById("id_sendstudentnotifications");
                    if (notifyStudents) notifyStudents.selectedIndex = 0;
                },
                args: [dueData, cutoffData]
            });
        } catch (error) {
            console.error("Error al establecer fechas de tarea:", error);
        }
    });

    // Botón: Establecer fechas cuestionario
    addSafeListener("btn-fechas-cuestionario", "click", async () => {
        try {
            const openDateVal = document.getElementById("input-duedate-cuestionario")?.value;
            const closeDateVal = document.getElementById("input-cutoffdate-cuestionario")?.value;

            const now = new Date();
            const openObj = openDateVal ? new Date(openDateVal + "T00:00:00") : now;
            const closeObj = closeDateVal ? new Date(closeDateVal + "T00:00:00") : now;

            const openData = {
                day: openObj.getDate(),
                month: openObj.getMonth() + 1,
                year: openObj.getFullYear()
            };

            const closeData = {
                day: closeObj.getDate(),
                month: closeObj.getMonth() + 1,
                year: closeObj.getFullYear()
            };

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (open, close) => {
                    const timeOpenEnabled = document.getElementById("id_timeopen_enabled");
                    if (timeOpenEnabled && !timeOpenEnabled.checked) timeOpenEnabled.click();

                    const timeCloseEnabled = document.getElementById("id_timeclose_enabled");
                    if (timeCloseEnabled && !timeCloseEnabled.checked) timeCloseEnabled.click();

                    // Fecha de apertura (timeopen) -> Ajustado a las 00:01 hs
                    if (document.getElementById("id_timeopen_day")) document.getElementById("id_timeopen_day").value = open.day;
                    if (document.getElementById("id_timeopen_month")) document.getElementById("id_timeopen_month").value = open.month;
                    if (document.getElementById("id_timeopen_year")) document.getElementById("id_timeopen_year").value = open.year;
                    if (document.getElementById("id_timeopen_hour")) document.getElementById("id_timeopen_hour").value = 0;
                    if (document.getElementById("id_timeopen_minute")) document.getElementById("id_timeopen_minute").value = 1;

                    // Fecha de cierre (timeclose) -> Ajustado a las 23:59 hs
                    if (document.getElementById("id_timeclose_day")) document.getElementById("id_timeclose_day").value = close.day;
                    if (document.getElementById("id_timeclose_month")) document.getElementById("id_timeclose_month").value = close.month;
                    if (document.getElementById("id_timeclose_year")) document.getElementById("id_timeclose_year").value = close.year;
                    if (document.getElementById("id_timeclose_hour")) document.getElementById("id_timeclose_hour").value = 23;
                    if (document.getElementById("id_timeclose_minute")) document.getElementById("id_timeclose_minute").value = 59;
                },
                args: [openData, closeData]
            });
        } catch (error) {
            console.error("Error al establecer fechas del cuestionario:", error);
        }
    });
    // Botón: Vista previa preguntas
    addSafeListener("btn-vista-previa", "click", async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // Selecciona solo los menús desplegables que están dentro de una celda <td>
const dropdowns = document.querySelectorAll('td .dropdown-menu, td .menu, td .dropdown-menu-right');
const links = [];

dropdowns.forEach(menu => {
    // Extrae el enlace del primer elemento hijo
    const item = menu.children[0];
    if (item?.tagName === 'A') {
        links.push(item.href);
    }
});

                    links.forEach(url => window.open(url, '_blank'));
                }
            });
        } catch (error) {
            console.error("Error en vista previa:", error);
        }
    });

    // Botones de impresión: la limpieza de la página es la misma en ambos.
    const prepararEnPestana = async (tabId) => {
        const respuesta = await chrome.tabs.sendMessage(tabId, {
            action: "prepararCuestionarioParaImprimir"
        });
        if (!respuesta?.ok) {
            throw new Error(respuesta?.error || "No se pudo preparar la página. Abre la vista previa del cuestionario y recárgala.");
        }
    };

    const estadoPDF = document.getElementById("estado-pdf-cuestionario");
    const informarPDF = (mensaje, esError = false) => {
        if (estadoPDF) {
            estadoPDF.textContent = mensaje;
            estadoPDF.style.color = esError ? "#a61b1b" : "";
        }
    };

    addSafeListener("btn-preparar-test", "click", async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) throw new Error("No hay ninguna pestaña activa.");
            await prepararEnPestana(tab.id);
            informarPDF("Página preparada para imprimir.");
        } catch (error) {
            informarPDF(error.message, true);
            console.error("Error al preparar el cuestionario:", error);
        }
    });

    addSafeListener("btn-descargar-pdf-cuestionario", "click", async () => {
        const boton = document.getElementById("btn-descargar-pdf-cuestionario");
        if (boton?.disabled) return;
        if (boton) boton.disabled = true;
        try {
            informarPDF("Calculando la altura y generando el PDF continuo…");
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) throw new Error("No hay ninguna pestaña activa.");
            await prepararEnPestana(tab.id);
            const respuesta = await chrome.runtime.sendMessage({
                action: "exportarCuestionarioPDF",
                tabId: tab.id
            });
            if (!respuesta?.ok) throw new Error(respuesta?.error || "No se pudo crear el PDF.");
            informarPDF("Descarga iniciada: " + respuesta.nombreArchivo);
        } catch (error) {
            informarPDF("No se pudo descargar: " + error.message, true);
            console.error("Error al descargar el cuestionario en PDF:", error);
        } finally {
            if (boton) boton.disabled = false;
        }
    });

    // Descargas masivas: solo cmid tomados de enlaces reales /mod/quiz/view.php?id=...
    const estadoDescarga = document.getElementById("estado-descarga-test");
    const informarDescarga = (mensaje, esError = false) => {
        if (estadoDescarga) {
            estadoDescarga.textContent = mensaje;
            estadoDescarga.style.color = esError ? "#a61b1b" : "";
        }
    };
    addSafeListener("btn-descargar-test", "click", async () => {
        const boton = document.getElementById("btn-descargar-test");
        if (boton?.disabled) return;
        if (boton) boton.disabled = true;
        try {
            const nombre = document.getElementById("input-nombre-test")?.value.trim();
            if (!nombre) throw new Error("Escribe el nombre de la sección del curso.");
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) throw new Error("Abre la página principal del curso de Moodle.");
            informarDescarga("Buscando cuestionarios en la sección…");

            const ejecucion = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: obtenerDescargasCuestionarios,
                args: [nombre]
            });
            const resultado = ejecucion?.[0]?.result;
            if (!resultado) throw new Error("No se pudo leer la página del curso.");
            if (!resultado.coincidencias) throw new Error("No se ha encontrado esa sección. Comprueba el nombre en la página principal del curso.");
            if (!resultado.descargas.length) throw new Error("La sección existe, pero no contiene enlaces a cuestionarios de Moodle. No se ha iniciado ninguna descarga.");

            let correctas = 0;
            const errores = [];
            for (const archivo of resultado.descargas) {
                try {
                    await chrome.downloads.download({ url: archivo.url, saveAs: false, conflictAction: "uniquify" });
                    correctas++;
                    informarDescarga(`Descargas iniciadas: ${correctas}/${resultado.descargas.length}…`);
                } catch (error) {
                    errores.push(`Cuestionario ${archivo.id} (${archivo.modo}): ${error.message}`);
                }
            }
            if (errores.length) {
                informarDescarga(`${correctas} descargas iniciadas. ${errores.length} fallidas. ${errores[0]}`, true);
            } else {
                const cantidad = resultado.cuestionarios.length;
                informarDescarga(`${correctas} informes solicitados de ${cantidad} ${cantidad === 1 ? "cuestionario" : "cuestionarios"}. Chrome puede pedir permiso para varias descargas.`);
            }
        } catch (error) {
            informarDescarga(error.message, true);
            console.error("Error al descargar informes masivos:", error);
        } finally {
            if (boton) boton.disabled = false;
        }
    });

    // Estado del Switch Ocultar Elementos
    const toggleOcultar = document.getElementById("toggle-ocultar");
    if (toggleOcultar) {
        chrome.storage?.local?.get(["ocultarElementos"], (result) => {
            toggleOcultar.checked = !!result?.ocultarElementos;
        });

        toggleOcultar.addEventListener("change", async (e) => {
            const ocultar = e.target.checked;
            chrome.storage?.local?.set({ ocultarElementos: ocultar });

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            try {
                await chrome.tabs.sendMessage(tab.id, { action: "toggleOcultarCSS", ocultar: ocultar });
            } catch (err) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (debeOcultar) => {
                        let styleEl = document.getElementById("fp-custom-ocultar-style");
                        if (debeOcultar) {
                            if (!styleEl) {
                                styleEl = document.createElement("style");
                                styleEl.id = "fp-custom-ocultar-style";
                                styleEl.textContent = `
                                    .activity.activity-wrapper:has(.hiddenactivity), .hidden {
                                        display: none !important;
                                    }
                                `;
                                document.head.appendChild(styleEl);
                            }
                        } else {
                            if (styleEl) styleEl.remove();
                        }
                    },
                    args: [ocultar]
                }).catch(scriptErr => console.warn("No se puede inyectar script:", scriptErr));
            }
        });
    }

    // Estado del switch de notificaciones (se conserva entre páginas y sesiones).
    const toggleNotificaciones = document.getElementById("toggle-notificaciones");
    if (toggleNotificaciones) {
        chrome.storage.local.get(["ocultarNotificaciones"], (result) => {
            toggleNotificaciones.checked = !!result?.ocultarNotificaciones;
        });
        toggleNotificaciones.addEventListener("change", async (event) => {
            const ocultar = event.target.checked;
            await chrome.storage.local.set({ ocultarNotificaciones: ocultar });
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;
            try {
                await chrome.tabs.sendMessage(tab.id, { action: "toggleNotificaciones", ocultar });
            } catch (error) {
                console.warn("Recarga la página de Moodle para aplicar la visibilidad de notificaciones:", error);
            }
        });
    }

    // Copiar el Prompt para IA
    addSafeListener("btn-copiar-prompt", "click", () => {
        const promptTextarea = document.getElementById("prompt-ia-text");
        if (!promptTextarea) return;

        const textoACopiar = promptTextarea.value.trim();
        const tempTextArea = document.createElement("textarea");
        tempTextArea.value = textoACopiar;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();

        try {
            document.execCommand("copy");
            const btnCopiar = document.getElementById("btn-copiar-prompt");
            if (btnCopiar) {
                const originalText = btnCopiar.innerText;
                btnCopiar.innerText = "¡Copiado!";
                btnCopiar.style.backgroundColor = "var(--success)";

                setTimeout(() => {
                    btnCopiar.innerText = originalText;
                    btnCopiar.style.backgroundColor = "";
                }, 1500);
            }
        } catch (err) {
            console.error("Error al copiar el texto: ", err);
        } finally {
            document.body.removeChild(tempTextArea);
        }
    });
});