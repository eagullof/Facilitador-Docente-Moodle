/* Facilitador 2.3.1 · Plantillas de retroalimentación para el calificador de Moodle.
 * Solo las plantillas generales se guardan localmente. El nombre del alumno
 * se obtiene de la página en el momento de escribir, sin almacenarlo.
 */
const FEEDBACK_STORAGE_KEY = 'facilitadorRetroalimentacionesV1';
const FEEDBACK_MAX_TEMPLATES = 50;

// Esta función se ejecuta dentro del contexto PRINCIPAL de la pestaña de Moodle.
// Debe mantenerse autónoma para chrome.scripting.executeScript({ world: 'MAIN' }).
function escribirRetroalimentacionEnMoodle(textoPlantilla) {
    const userInfo = document.querySelector('[data-region="user-info"]');
    const alumnoLink = userInfo?.querySelector('h4 a');
    if (!alumnoLink) {
        return { ok: false, error: 'No se ha encontrado el nombre del alumno. Abre la pantalla de calificación de una tarea.' };
    }

    // Se toman solamente los nodos de texto directos del enlace: excluye el
    // <small> (identificador de usuario) y otros elementos auxiliares del perfil.
    const textoNombre = Array.from(alumnoLink.childNodes)
        .filter(nodo => nodo.nodeType === 3)
        .map(nodo => nodo.textContent)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    // Solo el primer nombre, con mayúscula inicial y el resto en minúsculas.
    // Respeta acentos y nombres compuestos con guion o apóstrofo.
    const primerNombre = textoNombre.split(/\s+/)[0] || '';
    const nombre = primerNombre.toLocaleLowerCase('es-ES')
        .replace(/(^|[-'’])(\p{L})/gu, (_, separador, letra) =>
            separador + letra.toLocaleUpperCase('es-ES'));
    if (!nombre) {
        return { ok: false, error: 'No se ha podido identificar el primer nombre del alumno.' };
    }

    const plantilla = typeof textoPlantilla === 'string' ? textoPlantilla.trim() : '';
    if (!plantilla) return { ok: false, error: 'La plantilla seleccionada está vacía.' };

    const texto = `Hola ${nombre},\n\n${plantilla.replace(/\r\n?/g, '\n')}\n\nUn saludo.`;
    // No insertar HTML arbitrario proporcionado en la plantilla: texto plano
    // convertido a párrafos seguros, conservando los saltos de línea.
    const escapeHtml = valor => valor.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const html = texto.split(/\n\s*\n/)
        .map(parrafo => `<p>${escapeHtml(parrafo).replace(/\n/g, '<br>')}</p>`)
        .join('');

    const editorId = 'id_assignfeedbackcomments_editor';
    const frame = document.getElementById(`${editorId}_ifr`);
    const tiny = window.tinymce || window.tinyMCE;
    const editor = tiny && typeof tiny.get === 'function'
        ? (tiny.get(editorId) || (tiny.activeEditor?.id === editorId ? tiny.activeEditor : null))
        : null;
    if (editor && typeof editor.setContent === 'function') {
        try {
            // Se usa la API de TinyMCE en MAIN, no iframe.innerHTML, para que
            // Moodle reciba el contenido al guardar la calificación.
            const escribir = () => editor.setContent(html);
            if (editor.undoManager && typeof editor.undoManager.transact === 'function') {
                editor.undoManager.transact(escribir);
            } else {
                escribir();
            }
            if (typeof editor.save === 'function') editor.save();
            if (typeof editor.setDirty === 'function') editor.setDirty(true);
            if (typeof editor.fire === 'function') {
                editor.fire('input');
                editor.fire('change');
            }
            const textarea = document.getElementById(editorId);
            if (textarea) {
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return { ok: true, nombre, editor: 'tinymce' };
        } catch (error) {
            return { ok: false, error: `No se pudo actualizar TinyMCE: ${error.message}` };
        }
    }

    // No modificar directamente el interior del iframe cuando TinyMCE está
    // presente pero no disponible: la interfaz podría mostrar texto sin guardarlo.
    if (frame) {
        return { ok: false, error: 'El editor TinyMCE todavía no está listo. Abre el campo de comentarios y vuelve a intentarlo.' };
    }

    // Moodle también puede mostrar un editor de texto plano en lugar de TinyMCE.
    const textarea = document.getElementById(editorId);
    if (textarea && textarea.tagName === 'TEXTAREA' && !textarea.disabled) {
        textarea.value = texto;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true, nombre, editor: 'textarea' };
    }

    // Compatibilidad con una caja editable antigua sin iframe.
    const editable = document.getElementById(`${editorId}editable`);
    if (editable && editable.isContentEditable) {
        editable.innerHTML = html;
        editable.dispatchEvent(new Event('input', { bubbles: true }));
        editable.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true, nombre, editor: 'editable' };
    }
    return { ok: false, error: 'No se ha encontrado el editor de retroalimentación. Abre una entrega en la pantalla de calificación.' };
}

function iniciarRetroalimentaciones({ document: doc, chrome: api, confirm: confirmar = () => true }) {
    const select = doc.getElementById('feedback-select');
    if (!select) return;
    const titulo = doc.getElementById('feedback-title-input');
    const cuerpo = doc.getElementById('feedback-body-input');
    const nuevo = doc.getElementById('feedback-new');
    const guardar = doc.getElementById('feedback-save');
    const eliminar = doc.getElementById('feedback-delete');
    const escribir = doc.getElementById('feedback-write');
    const estado = doc.getElementById('feedback-status');
    let plantillas = [];
    let cargado = false;

    function mensaje(texto, esError = false) {
        estado.textContent = texto;
        estado.dataset.state = esError ? 'error' : 'ok';
    }
    function seleccionada() { return plantillas.find(p => p.id === select.value); }
    function refrescar(id = '') {
        select.replaceChildren();
        const opcion = doc.createElement('option');
        opcion.value = '';
        opcion.textContent = plantillas.length ? 'Selecciona una plantilla' : 'Todavía no hay plantillas';
        select.appendChild(opcion);
        for (const plantilla of plantillas) {
            const opt = doc.createElement('option');
            opt.value = plantilla.id;
            opt.textContent = plantilla.title;
            select.appendChild(opt);
        }
        select.value = plantillas.some(p => p.id === id) ? id : '';
        actualizarBotones();
    }
    function actualizarBotones() {
        const activa = !!seleccionada();
        eliminar.disabled = !activa || !cargado;
        escribir.disabled = !activa || !cargado;
        guardar.textContent = activa ? 'Guardar cambios' : 'Guardar plantilla';
        guardar.disabled = !cargado;
        nuevo.disabled = !cargado;
    }
    function cargarSeleccion() {
        const activa = seleccionada();
        titulo.value = activa?.title || '';
        cuerpo.value = activa?.body || '';
        actualizarBotones();
        mensaje('');
    }
    async function persistir() {
        await api.storage.local.set({ [FEEDBACK_STORAGE_KEY]: plantillas });
    }

    select.addEventListener('change', cargarSeleccion);
    nuevo.addEventListener('click', () => {
        select.value = '';
        cargarSeleccion();
        titulo.focus();
    });
    guardar.addEventListener('click', async () => {
        if (!cargado) return;
        const title = titulo.value.trim();
        const body = cuerpo.value.trim();
        if (!title || !body) return mensaje('Escribe un nombre y un texto antes de guardar.', true);
        if (title.length > 80 || body.length > 8000) return mensaje('La plantilla es demasiado larga.', true);
        const actual = seleccionada();
        if (!actual && plantillas.length >= FEEDBACK_MAX_TEMPLATES) {
            return mensaje('Has alcanzado el límite de 50 plantillas.', true);
        }
        const id = actual?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
        const anterior = plantillas.slice();
        const item = { id, title, body };
        if (actual) plantillas = plantillas.map(p => p.id === id ? item : p);
        else plantillas.push(item);
        try {
            await persistir();
            refrescar(id);
            mensaje(actual ? 'Plantilla actualizada.' : 'Plantilla guardada.');
        } catch (error) {
            plantillas = anterior;
            mensaje('No se ha podido guardar la plantilla en el navegador.', true);
        }
    });
    eliminar.addEventListener('click', async () => {
        const actual = seleccionada();
        if (!actual || !confirmar(`¿Eliminar la plantilla «${actual.title}»?`)) return;
        const anterior = plantillas.slice();
        plantillas = plantillas.filter(p => p.id !== actual.id);
        try {
            await persistir();
            refrescar();
            titulo.value = '';
            cuerpo.value = '';
            mensaje('Plantilla eliminada.');
        } catch (error) {
            plantillas = anterior;
            mensaje('No se ha podido eliminar la plantilla.', true);
        }
    });
    escribir.addEventListener('click', async () => {
        const actual = seleccionada();
        if (!actual) return mensaje('Selecciona primero una plantilla guardada.', true);
        if (titulo.value.trim() !== actual.title || cuerpo.value.trim() !== actual.body) {
            return mensaje('Tienes cambios sin guardar. Pulsa «Guardar cambios» antes de escribir.', true);
        }
        escribir.disabled = true;
        mensaje('Escribiendo en Moodle…');
        try {
            const [tab] = await api.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) throw new Error('Abre la pantalla de calificación de Moodle.');
            const ejecuciones = await api.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: escribirRetroalimentacionEnMoodle,
                args: [actual.body]
            });
            const resultado = ejecuciones?.[0]?.result;
            if (!resultado?.ok) throw new Error(resultado?.error || 'No se pudo escribir la retroalimentación.');
            mensaje(`Retroalimentación escrita para ${resultado.nombre}. Revisa el texto y guarda la calificación en Moodle.`);
        } catch (error) {
            mensaje(error.message || 'Error al escribir la retroalimentación.', true);
        } finally {
            actualizarBotones();
        }
    });

    // Nunca sobreescribir plantillas existentes cuando falla la lectura.
    (async () => {
        try {
            const data = await api.storage.local.get([FEEDBACK_STORAGE_KEY]);
            plantillas = Array.isArray(data[FEEDBACK_STORAGE_KEY])
                ? data[FEEDBACK_STORAGE_KEY].filter(p => p && typeof p.id === 'string' &&
                    typeof p.title === 'string' && typeof p.body === 'string' &&
                    p.title.length <= 80 && p.body.length <= 8000).slice(0, FEEDBACK_MAX_TEMPLATES)
                : [];
            cargado = true;
            refrescar();
        } catch (error) {
            mensaje('No se pudieron cargar las plantillas locales. Comprueba el almacenamiento del navegador.', true);
        }
    })();
}

if (typeof document !== 'undefined' && typeof chrome !== 'undefined' && chrome.storage?.local) {
    document.addEventListener('DOMContentLoaded', () => {
        iniciarRetroalimentaciones({ document, chrome, confirm: pregunta => window.confirm(pregunta) });
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escribirRetroalimentacionEnMoodle, iniciarRetroalimentaciones, FEEDBACK_STORAGE_KEY };
}
