(function () {
    const today = new Date();
    const dia = today.getDate();
    const mes = today.getMonth() + 1;
    const anio = today.getFullYear();

    function seleccionarValor(id, valor) {
        const select = document.getElementById(id);
        if (select) {
            for (const option of select.options) {
                if (parseInt(option.value) === valor) {
                    option.selected = true;
                    break;
                }
            }
        }
    }

    function aplicarFecha() {
        seleccionarValor("apertura-dia", dia);
        seleccionarValor("apertura-mes", mes);
        seleccionarValor("apertura-anio", anio);
        seleccionarValor("apertura-hora", 9);
        seleccionarValor("apertura-minuto", 0);

        seleccionarValor("cierre-dia", dia);
        seleccionarValor("cierre-mes", mes);
        seleccionarValor("cierre-anio", anio);
        seleccionarValor("cierre-hora", 23);
        seleccionarValor("cierre-minuto", 59);
    }

    // Esperar a que el DOM esté listo
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", aplicarFecha);
    } else {
        aplicarFecha();
    }
})();


// Botón: No entregado
document.getElementById("btn-no-entregado").addEventListener("click", async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const levels = document.querySelectorAll(".levels");
                levels.forEach(level => {
                    const firstTd = level.querySelector("td");
                    if (firstTd) firstTd.click();
                });
                document.getElementById("id_assignfeedbackcomments_editoreditable").innerHTML = "No entregado.";
            }
        });
    } catch (error) {
        console.error("Error al marcar como no entregado:", error);
    }
});

// Botón: Perfecto
document.getElementById("btn-perfecto").addEventListener("click", async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const levels = document.querySelectorAll(".levels");
                levels.forEach(level => {
                    const tds = level.querySelectorAll("td");
                    if (tds.length) tds[tds.length - 1].click();
                });
                document.getElementById("id_assignfeedbackcomments_editoreditable").innerHTML = "¡Buen trabajo!";
            }
        });
    } catch (error) {
        console.error("Error al marcar como perfecto:", error);
    }
});

// Botón: Aplicar rúbrica
document.getElementById("btn-aplicar-rubrica").addEventListener("click", async () => {
    try {
        const csvData = document.getElementById("input-rubrica").value;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (csvData) => {
                const lines = csvData.split("#").filter(Boolean);
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

                items.forEach((item, i) => {
                    const baseId = `rubric-criteria-NEWID${i + 1}`;
                    const parent = document.getElementById(baseId);
                    if (!parent) return;

                    parent.querySelector(".btn")?.click();
                    const elems = parent.querySelectorAll(".textvalue");
                    const areas = parent.querySelectorAll("textarea");
                    const inputs = parent.querySelectorAll("input.hiddenelement");

                    if (!elems.length) return;

                    elems[0].textContent = areas[0].textContent = item.item;
                    elems[1].textContent = areas[1].textContent = "No realizado";
                    elems[2].textContent = "0"; inputs[0].value = "0";
                    elems[3].textContent = areas[2].textContent = "Incompleto/incorrecto";
                    elems[4].textContent = (item.puntos / 4).toString(); inputs[1].value = (item.puntos / 4).toString();
                    elems[5].textContent = areas[3].textContent = "Realizado con errores";
                    elems[6].textContent = (item.puntos / 2).toString(); inputs[2].value = (item.puntos / 2).toString();
                    elems[7].textContent = areas[4].textContent = "Correcto";
                    elems[8].textContent = item.puntos.toString(); inputs[3].value = item.puntos.toString();
                });
            },
            args: [csvData]
        });
    } catch (error) {
        console.error("Error al aplicar rúbrica:", error);
    }
});

// Botón: Establecer fechas tarea
document.getElementById("btn-fechas-tarea").addEventListener("click", async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const y = new Date().getFullYear();
                document.getElementById("id_duedate_enabled").click();
                document.getElementById("id_cutoffdate_enabled").click();
                document.getElementById("id_duedate_year").value = y;
                document.getElementById("id_cutoffdate_year").value = y;
                document.getElementById("id_duedate_hour").value = 23;
                document.getElementById("id_duedate_minute").value = 59;
                document.getElementById("id_cutoffdate_hour").value = 23;
                document.getElementById("id_cutoffdate_minute").value = 59;
                document.getElementById("id_attemptreopenmethod").selectedIndex = 1;
                document.getElementById("id_sendstudentnotifications").selectedIndex = 0;
            }
        });
    } catch (error) {
        console.error("Error al establecer fechas de tarea:", error);
    }
});

// Botón: Establecer fechas cuestionario
document.getElementById("btn-fechas-cuestionario").addEventListener("click", async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const y = new Date().getFullYear();
                document.getElementById("id_timeopen_enabled").click();
                document.getElementById("id_timeclose_enabled").click();
                document.getElementById("id_timeclose_year").value = y;
                document.getElementById("id_timeclose_hour").value = 23;
                document.getElementById("id_timeclose_minute").value = 59;
            }
        });
    } catch (error) {
        console.error("Error al establecer fechas del cuestionario:", error);
    }
});

// Botón: Vista previa preguntas
document.getElementById("btn-vista-previa").addEventListener("click", async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const dropdowns = document.querySelectorAll('.dropdown-menu, .menu, .dropdown-menu-right');
                const links = [];

                dropdowns.forEach(menu => {
                    const item = menu.children[3];
                    if (item?.tagName === 'A') links.push(item.href);
                });

                links.forEach(url => window.open(url, '_blank'));
            }
        });
    } catch (error) {
        console.error("Error en vista previa:", error);
    }
});

// Botón: Preparar test
document.getElementById("btn-preparar-test").addEventListener("click", async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                [...document.getElementsByClassName("info")].forEach(el => el.remove());
                [...document.querySelectorAll('[disabled]')].forEach(el => el.removeAttribute('disabled'));
                [...document.getElementsByClassName("generaltable ")].forEach(el => el.remove());
                [...document.getElementsByClassName("moove-container-fluid")].forEach(el => el.remove());
                [...document.getElementsByClassName("submitbtns")].forEach(el => el.remove());
                [...document.getElementsByTagName("header")].forEach(el => el.remove());
            }
        });
    } catch (error) {
        console.error("Error al preparar test:", error);
    }
});

// Botón: Descargar test
document.getElementById("btn-descargar-test").addEventListener("click", async () => {
    try {
        const nombreTest = document.getElementById("input-nombre-test").value.trim().toLowerCase();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (nombreTest) => {
                function extraerIdsExamenes(seccion) {
                    const ids = [];
                    const sections = document.querySelectorAll('li.section');

                    sections.forEach(sec => {
                        const title = sec.querySelector('h3.sectionname');
                        if (title?.textContent.trim().toLowerCase() === seccion) {
                            sec.querySelectorAll('.quiz .activity-item').forEach(el => {
                                ids.push(Number(el.parentElement.dataset.id));
                            });
                        }
                    });
                    return ids;
                }

                const ids = extraerIdsExamenes(nombreTest);
                const sesskey = document.getElementsByName('sesskey')[0].value;
                const modos = ['overview', 'responses'];
                const baseUrl = 'https://www.fpvirtualaragon.es/mod/quiz/report.php';
                const fixedParams = `sesskey=${sesskey}&download=excel&attemps=enrolled_with&onlygraded&onlyregraded&slotmarks=1&resp=1&right=1&qtext=1`;

                let delay = 0;
                ids.forEach(id => {
                    modos.forEach(mode => {
                        const url = `${baseUrl}?${fixedParams}&id=${id}&mode=${mode}`;
                        setTimeout(() => {
                            const a = document.createElement('a');
                            a.href = url;
                            a.style.display = 'none';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                        }, delay);
                        delay += 500;
                    });
                });
                window.alert("Descarga iniciada. Revisa tu carpeta de descargas.");
            },
            args: [nombreTest]
        });
    } catch (error) {
        window.alert("Error al descargar el test. Asegúrate de que el nombre de la sección es correcto y está en minúsculas.");
    }
});


// Botón: Modificar cuestionario
document.getElementById("btn-modificar-cuestionarios").addEventListener("click", async () => {
    try {
        const nombreTest = document.getElementById("input-nombre-test").value.trim().toLowerCase();
        const fechas = [
            document.getElementById("apertura-dia").value.trim(),
            document.getElementById("apertura-mes").value.trim(),
            document.getElementById("apertura-anio").value.trim(),
            document.getElementById("apertura-hora").value.trim(),
            document.getElementById("apertura-minuto").value.trim(),
            document.getElementById("cierre-dia").value.trim(),
            document.getElementById("cierre-mes").value.trim(),
            document.getElementById("cierre-anio").value.trim(),
            document.getElementById("cierre-hora").value.trim(),
            document.getElementById("cierre-minuto").value.trim(),
            document.getElementById("fecha-apertura-cbx").checked,
            document.getElementById("fecha-cierre-cbx").checked,
            document.getElementById("quizzpass").value.trim(),
        ]
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (nombreTest, fechas) => {
                function extraerIdsExamenes(seccion) {
                    const ids = [];
                    const names = [];
                    const sections = document.querySelectorAll('li.section');

                    sections.forEach(sec => {
                        const title = sec.querySelector('h3.sectionname');
                        if (title?.textContent.trim().toLowerCase() === seccion) {
                            sec.querySelectorAll('.quiz .activity-item').forEach(el => {
                                names.push(el.dataset.activityname);
                                ids.push(Number(el.parentElement.dataset.id));
                            });
                        }
                    });

                    return [ids, names];
                }

                const datosCuestionarios = extraerIdsExamenes(nombreTest);
                const ids = datosCuestionarios[0];
                const nombres = datosCuestionarios[1];
                const sesskey = document.getElementsByName('sesskey')[0].value;
                const datacourse_id = document.querySelector('[data-courseid]').dataset.courseid;

                console.log(fechas[10]);
                console.log(fechas[11]);
                ids.forEach((id, index) => {
                    const data = {
                    course: datacourse_id,
                    coursemodule: id,
                    update: id,
                    sesskey: sesskey,
                    'timeopen[enabled]': fechas[10] ? '1' : '0',
                    'timeopen[day]': fechas[0],
                    'timeopen[month]': fechas[1],
                    'timeopen[year]': fechas[2],
                    'timeopen[hour]': fechas[3],
                    'timeopen[minute]': fechas[4],
                    'timeclose[enabled]': fechas[11] ? '1' : '0',
                    'timeclose[day]': fechas[5],
                    'timeclose[month]': fechas[6],
                    'timeclose[year]': fechas[7],
                    'timeclose[hour]': fechas[8],
                    'timeclose[minute]': fechas[9],
                    'quizpassword': fechas[12],
                    '_qf__mod_quiz_mod_form': '1',
                    name: nombres[index],
                    availabilityconditionsjson: '{"op":"&","c":[],"showc":[]}',
                };


                function setDateAndPassword() {
                    fetch('https://www.fpvirtualaragon.es/course/modedit.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams(data).toString(),
                    })
                        .then(response => {
                            window.alert(`Datos del cuestionario "${nombres[index]}" actualizados correctamente.`);
                        })
                        .catch(error => {
                            window.alert(`Error al actualizar el cuestionario "${nombres[index]}".`);
                        })
                }
                setDateAndPassword();
                });
                
            },
            args: [nombreTest, fechas]
        });
    } catch (error) {
        console.error("Error al descargar test:", error);
    }
});
