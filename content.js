// Limpieza de la vista previa del cuestionario, compartida por el botón y Alt+T.
function prepararCuestionarioParaImprimir() {
    // Quitar el bloque completo, incluido todo su contenido, además de los
    // elementos que ya se eliminaban en las versiones anteriores.
    const elementosParaEliminar = document.querySelectorAll(
        ".info, .generaltable, .moove-container-fluid, .submitbtns, header, div.container-fluid.tertiary-navigation"
    );
    elementosParaEliminar.forEach(el => el.remove());

    // Las respuestas deshabilitadas pueden volver a mostrarse correctamente.
    document.querySelectorAll("[disabled]").forEach(el => el.removeAttribute("disabled"));

    // Conservar el div y TODOS sus hijos; solo retirar las clases indicadas.
    const formulaciones = document.querySelectorAll("div.formulation.clearfix");
    formulaciones.forEach(el => el.classList.remove("formulation", "clearfix"));

    return { elementosEliminados: elementosParaEliminar.length, formulacionesLimpias: formulaciones.length };
}

// Atajos inyectados directamente en la página de Moodle (Keyboard Listeners)
document.addEventListener("keydown", (event) => {
  // Evitar que se activen atajos cuando el usuario redacta en un campo de texto o editor
  const activeElement = document.activeElement;
  const isEditing = activeElement.tagName === "INPUT" || 
                    activeElement.tagName === "TEXTAREA" || 
                    activeElement.isContentEditable;

  if (isEditing) return;

  // Atajo: Alt + P para vista previa de preguntas
  if (event.altKey && event.key.toLowerCase() === "p") {
    event.preventDefault();
    const dropdowns = document.querySelectorAll('.dropdown-menu, .menu, .dropdown-menu-right');
    const links = [];
    dropdowns.forEach(menu => {
      const item = menu.children[3];
      if (item?.tagName === 'A') links.push(item.href);
    });
    links.forEach(url => window.open(url, '_blank'));
  }

  // Atajo: Alt + T para preparar el test de impresión
  if (event.altKey && event.key.toLowerCase() === "t") {
    event.preventDefault();
    prepararCuestionarioParaImprimir();
  }
});

// Función para aplicar o quitar el CSS que oculta los elementos
function aplicarOcultarCSS(ocultar) {
    let styleEl = document.getElementById("fp-custom-ocultar-style");

    if (ocultar) {
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
        if (styleEl) {
            styleEl.remove();
        }
    }
}

// 1. Al cargar cualquier página de Moodle, verificar la preferencia guardada
chrome.storage.local.get(["ocultarElementos"], (result) => {
    if (result.ocultarElementos) {
        aplicarOcultarCSS(true);
    }
});

// 2. Escuchar los cambios que se hagan desde el Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleOcultarCSS") {
        aplicarOcultarCSS(request.ocultar);
    }
});

// Oculta únicamente la región de notificaciones de Moodle mediante el atributo
// HTML hidden. También contempla regiones que Moodle añada después de cargar.
let observadorNotificaciones = null;
const hiddenOriginalNotificaciones = new WeakMap();
function aplicarOcultarNotificaciones(ocultar) {
    if (!ocultar && observadorNotificaciones) {
        observadorNotificaciones.disconnect();
        observadorNotificaciones = null;
    }
    for (const elemento of document.querySelectorAll('.popover-region.popover-region-notifications')) {
        if (ocultar) {
            if (!hiddenOriginalNotificaciones.has(elemento)) {
                hiddenOriginalNotificaciones.set(elemento, elemento.hidden);
            }
            elemento.hidden = true;
        } else if (hiddenOriginalNotificaciones.has(elemento)) {
            elemento.hidden = hiddenOriginalNotificaciones.get(elemento);
            hiddenOriginalNotificaciones.delete(elemento);
        }
    }
    // No vigilar páginas ajenas a Moodle: el content script original se ejecuta en todas las webs.
    const esPaginaMoodle = ocultar && (document.body?.id?.startsWith('page-') ||
        !!document.querySelector?.('.popover-region.popover-region-notifications'));
    if (ocultar && !observadorNotificaciones && document.documentElement && esPaginaMoodle) {
        observadorNotificaciones = new MutationObserver(() => {
            for (const elemento of document.querySelectorAll('.popover-region.popover-region-notifications')) {
                if (!hiddenOriginalNotificaciones.has(elemento)) {
                    hiddenOriginalNotificaciones.set(elemento, elemento.hidden);
                }
                elemento.hidden = true;
            }
        });
        observadorNotificaciones.observe(document.documentElement, { childList: true, subtree: true });
    }
}
chrome.storage.local.get(["ocultarNotificaciones"], (result) => {
    aplicarOcultarNotificaciones(!!result.ocultarNotificaciones);
});
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "toggleNotificaciones") {
        aplicarOcultarNotificaciones(!!request.ocultar);
    }
});

// El panel lateral solicita esta misma preparación antes de crear el PDF.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.action !== "prepararCuestionarioParaImprimir") return;
    try {
        sendResponse({ ok: true, resumen: prepararCuestionarioParaImprimir() });
    } catch (error) {
        sendResponse({ ok: false, error: error.message });
    }
});
