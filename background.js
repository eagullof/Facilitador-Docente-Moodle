// Para que se abra al hacer click en el icono
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Escucha los atajos de teclado configurados en manifest.json
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  if (command === "marcar-no-entregado") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const levels = document.querySelectorAll(".levels");
        levels.forEach(level => {
          const firstTd = level.querySelector("td");
          if (firstTd) firstTd.click();
        });
        const commentBox = document.getElementById("id_assignfeedbackcomments_editoreditable");
        if (commentBox) commentBox.innerHTML = "No entregado.";
      }
    });
  } else if (command === "marcar-perfecto") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const levels = document.querySelectorAll(".levels");
        levels.forEach(level => {
          const tds = level.querySelectorAll("td");
          if (tds.length) tds[tds.length - 1].click();
        });
        const commentBox = document.getElementById("id_assignfeedbackcomments_editoreditable");
        if (commentBox) commentBox.innerHTML = "¡Buen trabajo!";
      }
    });
  }
});
// PDF de una sola página vertical: no utiliza el tamaño A4 fijo.
// La altura se mide con los estilos de impresión ya aplicados para no cortar preguntas.
const exportacionesPDFActivas = new Set();
const MARGEN_PDF_PULGADAS = 0.18;
const ALTO_MAXIMO_PDF_PULGADAS = 198; // Evitar sobrepasar el límite habitual de 200 pulgadas.

function nombreSeguroPDF(titulo) {
  const base = (typeof titulo === "string" ? titulo : "Cuestionario")
    .replace(/[\/\\:*?"<>|\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, 110) || "Cuestionario";
  return `Cuestionario - ${base}.pdf`;
}

// Los cambios de estilo son temporales: desaparecen al terminar o si se produce un error.
const prepararEstilosPDFContinuo = `(() => {
  const anterior = document.getElementById('fp-quiz-pdf-continuo');
  if (anterior) anterior.remove();
  const estilo = document.createElement('style');
  estilo.id = 'fp-quiz-pdf-continuo';
  estilo.textContent = \`@media print {
    html, body, #page-wrapper, #page, #page-content, #region-main {
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
    }
    *, *::before, *::after {
      break-before: auto !important;
      break-after: auto !important;
      break-inside: auto !important;
      page-break-before: auto !important;
      page-break-after: auto !important;
      page-break-inside: auto !important;
    }
    img, svg, canvas, video { max-width: 100% !important; height: auto; }
    pre { white-space: pre-wrap !important; overflow-wrap: anywhere !important; }
  }\`;
  document.head.appendChild(estilo);
  return true;
})()`;

const medirDocumentoPDF = `(async () => {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  // El cambio a @media print debe tener efecto antes de medir.
  const raiz = document.documentElement;
  const cuerpo = document.body;
  if (!raiz || !cuerpo) throw new Error('No se ha encontrado el contenido del cuestionario.');
  const altura = Math.ceil(Math.max(
    raiz.scrollHeight, raiz.offsetHeight,
    cuerpo.scrollHeight, cuerpo.offsetHeight,
    raiz.getBoundingClientRect().bottom + window.scrollY,
    cuerpo.getBoundingClientRect().bottom + window.scrollY
  ));
  const anchura = Math.ceil(Math.max(
    raiz.clientWidth, raiz.scrollWidth,
    cuerpo.scrollWidth, window.innerWidth
  ));
  return { altura, anchura };
})()`;

async function evaluarEnPestanaPDF(destino, expresion) {
  const resultado = await chrome.debugger.sendCommand(destino, "Runtime.evaluate", {
    expression: expresion,
    returnByValue: true,
    awaitPromise: true
  });
  if (resultado?.exceptionDetails) {
    throw new Error(resultado.exceptionDetails.text || "No se pudo calcular el tamaño del cuestionario.");
  }
  return resultado?.result?.value;
}

function calcularTamanoPDFContinuo(medidas) {
  if (!Number.isFinite(medidas?.altura) || medidas.altura <= 0 ||
      !Number.isFinite(medidas?.anchura) || medidas.anchura <= 0) {
    throw new Error("No se pudo medir el cuestionario para exportarlo sin cortes.");
  }

  // Mantener aproximadamente el ancho de la página web evita recortes laterales.
  const anchoContenido = Math.max(794, Math.min(medidas.anchura, 2400));
  const paperWidth = Math.ceil((anchoContenido / 96 + 2 * MARGEN_PDF_PULGADAS) * 100) / 100;

  // Margen de seguridad para redondeos, fuentes/imágenes y diferencias de maquetación.
  const alturaNecesaria = (medidas.altura * 1.025 + 48) / 96;
  const escala = Math.min(1, (ALTO_MAXIMO_PDF_PULGADAS - 2 * MARGEN_PDF_PULGADAS) / alturaNecesaria);
  if (escala < 0.5) {
    throw new Error("El cuestionario es demasiado largo para un PDF legible de una sola página. Prueba a dividirlo en cuestionarios más pequeños.");
  }
  const paperHeight = Math.min(ALTO_MAXIMO_PDF_PULGADAS,
    Math.ceil((alturaNecesaria * escala + 2 * MARGEN_PDF_PULGADAS) * 100) / 100);
  return { paperWidth, paperHeight, scale: Math.round(escala * 1000) / 1000 };
}

async function exportarCuestionarioPDF(tabId) {
  if (!Number.isInteger(tabId) || tabId < 1) throw new Error("Pestaña no válida.");
  if (exportacionesPDFActivas.has(tabId)) throw new Error("Ya se está generando un PDF de esta pestaña.");

  exportacionesPDFActivas.add(tabId);
  const destino = { tabId };
  let depuradorConectado = false;
  let mediosImpresionActivados = false;
  let estilosInstalados = false;
  try {
    const pestana = await chrome.tabs.get(tabId);
    if (!/^https?:\/\//i.test(pestana.url || "")) {
      throw new Error("Abre la vista previa del cuestionario en una página web para crear el PDF.");
    }

    await chrome.debugger.attach(destino, "1.3");
    depuradorConectado = true;

    await evaluarEnPestanaPDF(destino, prepararEstilosPDFContinuo);
    estilosInstalados = true;
    await chrome.debugger.sendCommand(destino, "Emulation.setEmulatedMedia", { media: "print" });
    mediosImpresionActivados = true;

    const medidas = await evaluarEnPestanaPDF(destino, medirDocumentoPDF);
    const tamano = calcularTamanoPDFContinuo(medidas);
    const pdf = await chrome.debugger.sendCommand(destino, "Page.printToPDF", {
      printBackground: true,
      displayHeaderFooter: false,
      ...tamano,
      marginTop: MARGEN_PDF_PULGADAS,
      marginBottom: MARGEN_PDF_PULGADAS,
      marginLeft: MARGEN_PDF_PULGADAS,
      marginRight: MARGEN_PDF_PULGADAS,
      preferCSSPageSize: false
    });
    if (!pdf?.data) throw new Error("Chrome no devolvió ningún PDF.");

    const nombreArchivo = nombreSeguroPDF(pestana.title);
    await chrome.downloads.download({
      url: `data:application/pdf;base64,${pdf.data}`,
      filename: nombreArchivo,
      conflictAction: "uniquify",
      saveAs: false
    });
    return { nombreArchivo };
  } finally {
    if (depuradorConectado) {
      if (mediosImpresionActivados) {
        try {
          await chrome.debugger.sendCommand(destino, "Emulation.setEmulatedMedia", { media: "" });
        } catch (error) {
          console.warn("No se pudo restaurar el modo de visualización:", error);
        }
      }
      if (estilosInstalados) {
        try {
          await evaluarEnPestanaPDF(destino, "(() => { document.getElementById('fp-quiz-pdf-continuo')?.remove(); return true; })()");
        } catch (error) {
          console.warn("No se pudieron quitar los estilos temporales del PDF:", error);
        }
      }
      try {
        await chrome.debugger.detach(destino);
      } catch (error) {
        console.warn("No se pudo cerrar la sesión temporal de PDF:", error);
      }
    }
    exportacionesPDFActivas.delete(tabId);
  }
}

chrome.runtime.onMessage.addListener((mensaje, remitente, responder) => {
  if (mensaje?.action !== "exportarCuestionarioPDF") return;
  // Solo la propia extensión (el panel) puede pedir la exportación.
  if (remitente.id !== chrome.runtime.id) {
    responder({ ok: false, error: "Origen no autorizado." });
    return;
  }
  (async () => {
    const [activa] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activa?.id !== mensaje.tabId) throw new Error("La pestaña activa ha cambiado. Vuelve a intentarlo.");
    return exportarCuestionarioPDF(mensaje.tabId);
  })()
    .then(resultado => responder({ ok: true, ...resultado }))
    .catch(error => {
      console.error("Error al generar PDF:", error);
      responder({ ok: false, error: error.message || "No se pudo exportar el PDF." });
    });
  return true; // Respuesta asíncrona desde el service worker.
});
