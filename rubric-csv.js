/* Facilitador 2.3.2 — Importación de rúbricas CSV con niveles personalizados.
 * Implementación propia, basada en el formato de 4 columnas del archivo de
 * referencia facilitado por el usuario. No ejecuta código ni HTML del CSV.
 */
(function (root) {
    'use strict';

    function normalizarCabecera(texto) {
        return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
    }

    function detectarSeparador(texto) {
        let dentro = false;
        const frecuencias = { ';': 0, ',': 0, '\t': 0 };
        for (let i = 0; i < texto.length; i++) {
            const c = texto[i];
            if (c === '"') {
                if (dentro && texto[i + 1] === '"') i++;
                else dentro = !dentro;
            } else if (!dentro && (c === '\n' || c === '\r')) break;
            else if (!dentro && c in frecuencias) frecuencias[c]++;
        }
        const entries = Object.entries(frecuencias).sort((a, b) => b[1] - a[1]);
        if (!entries[0][1]) throw new Error('El CSV debe contener varias columnas separadas por ; o coma.');
        return entries[0][0];
    }

    function leerFilasCSV(texto, separador) {
        const filas = [];
        let fila = [], campo = '', entreComillas = false, cerrada = false;
        for (let i = 0; i < texto.length; i++) {
            const c = texto[i];
            if (c === '"') {
                if (entreComillas && texto[i + 1] === '"') { campo += '"'; i++; }
                else if (entreComillas) { entreComillas = false; cerrada = true; }
                else if (!campo.trim()) { entreComillas = true; cerrada = false; }
                else throw new Error(`Comillas incorrectas cerca de la fila ${filas.length + 1}.`);
            } else if (!entreComillas && c === separador) {
                fila.push(campo.trim()); campo = ''; cerrada = false;
            } else if (!entreComillas && (c === '\r' || c === '\n')) {
                if (c === '\r' && texto[i + 1] === '\n') i++;
                fila.push(campo.trim());
                if (fila.some(valor => valor !== '')) filas.push(fila);
                fila = []; campo = ''; cerrada = false;
            } else {
                if (cerrada && !/\s/.test(c)) throw new Error(`Texto después de comillas de cierre en fila ${filas.length + 1}.`);
                campo += c;
            }
        }
        if (entreComillas) throw new Error('El archivo contiene un campo entrecomillado sin cerrar.');
        fila.push(campo.trim());
        if (fila.some(valor => valor !== '')) filas.push(fila);
        return filas;
    }

    function parsearCsvRubrica(csvText) {
        if (typeof csvText !== 'string' || !csvText.trim()) throw new Error('El archivo CSV está vacío.');
        if (csvText.length > 2_000_000) throw new Error('El CSV supera el límite de 2 MB.');
        const texto = csvText.replace(/^\uFEFF/, '');
        const separador = detectarSeparador(texto);
        const filas = leerFilasCSV(texto, separador);
        if (filas.length < 2) throw new Error('Incluye una cabecera y al menos una fila de niveles.');

        const cabeceras = filas[0].map(normalizarCabecera);
        const buscar = (candidatos, porDefecto) => {
            const pos = cabeceras.findIndex(c => candidatos.includes(c));
            return pos >= 0 ? pos : porDefecto;
        };
        const iCriterio = buscar(['criterio', 'criterion', 'criterionname', 'nombrecriterio', 'criteria'], 0);
        const iNivel = buscar(['nivel', 'level', 'nombrelevel', 'nombrenivel'], 1);
        const iDescripcion = buscar(['descripcion', 'description', 'descripcionnivel', 'descripciondelnivel', 'leveldescription', 'leveldesc', 'definicion', 'definition'], 2);
        const iPuntos = buscar(['puntuacion', 'score', 'puntos', 'points', 'puntaje', 'calificacion', 'valor'], 3);
        const indices = [iCriterio, iDescripcion, iPuntos];
        if (new Set(indices).size !== 3) throw new Error('Cabeceras repetidas o ambiguas: se necesitan criterio, descripción y puntuación.');
        const indicesReconocidos = cabeceras.some(x => ['criterio', 'criterion', 'criterionname', 'nombrecriterio', 'criteria'].includes(x)) &&
          cabeceras.some(x => ['puntuacion', 'score', 'puntos', 'points', 'puntaje', 'calificacion', 'valor'].includes(x));
        if (!indicesReconocidos && filas[0].length < 4) throw new Error('La cabecera debe incluir cuatro columnas: Criterio;Nivel;Descripción;Puntuación.');
        const mapa = new Map();
        let totalNiveles = 0;
        for (const [indice, fila] of filas.slice(1).entries()) {
            const linea = indice + 2;
            if (fila.length <= Math.max(...indices)) throw new Error(`Fila ${linea}: faltan columnas. Se esperan criterio, nivel, descripción y puntuación.`);
            const criterio = fila[iCriterio].replace(/\s+/g, ' ').trim();
            const nivel = (fila[iNivel] || '').trim();
            const descripcion = (fila[iDescripcion] || nivel).trim();
            const puntuacionOriginal = (fila[iPuntos] || '').trim();
            if (!criterio || !descripcion || !puntuacionOriginal) throw new Error(`Fila ${linea}: falta criterio, descripción o puntuación.`);
            if (criterio.length > 500 || descripcion.length > 5000) throw new Error(`Fila ${linea}: texto demasiado largo.`);
            if (!/^(?:\d+(?:[.,]\d+)?)$/.test(puntuacionOriginal)) throw new Error(`Fila ${linea}: puntuación no válida (${puntuacionOriginal}).`);
            const numero = Number(puntuacionOriginal.replace(',', '.'));
            if (!Number.isFinite(numero) || numero > 1000000) throw new Error(`Fila ${linea}: puntuación fuera del rango admitido.`);
            const clave = criterio.toLocaleLowerCase('es').normalize('NFC');
            if (!mapa.has(clave)) mapa.set(clave, { criterio, niveles: [] });
            const niveles = mapa.get(clave).niveles;
            if (niveles.length >= 30) throw new Error(`Fila ${linea}: máximo 30 niveles por criterio.`);
            niveles.push({ descripcion, puntuacion: String(numero) });
            totalNiveles++;
            if (totalNiveles > 500 || mapa.size > 100) throw new Error('Límite de importación: 100 criterios y 500 niveles.');
        }
        if (!mapa.size) throw new Error('El CSV no contiene criterios con niveles.');
        return { criterios: [...mapa.values()], totalNiveles, separador };
    }

    // Esta función se serializa con chrome.scripting.executeScript y se ejecuta en
    // el documento Moodle. Debe mantenerse autocontenida, sin referencias externas.
    async function importarRubricaCsvEnMoodle(datos) {
        const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
        const queryRows = () => [...document.querySelectorAll('tr[id^="rubric-criteria-"]')]
            .filter(row => row.querySelector('td[id*="-description"], textarea[name$="[description]"], .description'));
        const queryCells = row => [...row.querySelectorAll('td[id*="-levels-"]')]
            .filter(cell => cell.querySelector('[name$="[definition]"], [id*="-definition"], .definition'));
        const esperar = async (fn, ms = 2600) => {
            const inicio = Date.now();
            let valor = fn();
            while (!valor && Date.now() - inicio < ms) { await pausa(65); valor = fn(); }
            return valor;
        };
        const notificar = el => {
            if (!el) return;
            for (const evento of ['input', 'change']) el.dispatchEvent(new Event(evento, { bubbles: true }));
        };
        const escribir = async (contenedor, valor, tipo) => {
            const selectores = tipo === 'puntos'
                ? ['input[name$="[score]"]', '.scorevalue input', 'input[type="number"]', 'input[type="text"]']
                : [tipo === 'criterio' ? 'textarea[name$="[description]"]' : 'textarea[name$="[definition]"]', 'textarea', '[contenteditable="true"]'];
            const textoVisible = contenedor.querySelector?.('.textvalue, .scorevalue');
            if (textoVisible) textoVisible.click();
            else contenedor.click?.();
            await pausa(25);
            let campo = selectores.map(selector => contenedor.matches?.(selector) ? contenedor : contenedor.querySelector?.(selector)).find(Boolean);
            // Moodle puede mostrar el textarea solo al hacer clic en el texto.
            if (!campo) campo = await esperar(() => selectores.map(selector => contenedor.querySelector?.(selector)).find(Boolean), 400);
            if (!campo && textoVisible) {
                // El nivel puede ser un div contenteditable; no destruir sus hijos.
                if (textoVisible.isContentEditable) campo = textoVisible;
            }
            if (!campo) return false;
            if (campo.tagName === 'INPUT' || campo.tagName === 'TEXTAREA') {
                campo.value = valor;
                notificar(campo);
                if (textoVisible && textoVisible !== campo && !textoVisible.contains(campo)) textoVisible.textContent = valor;
            } else if (campo.isContentEditable) {
                campo.textContent = valor;
                notificar(campo);
            } else return false;
            campo.dispatchEvent(new Event('blur', { bubbles: true }));
            return true;
        };
        const filaDescripcion = row => row.querySelector('td[id$="-description"], td.description, .description') || row;
        const celdaDefinicion = td => td.querySelector('[id$="-definition"], .definition') || td;
        const celdaPuntos = td => td.querySelector('[id$="-score"], .score') || td;
        const error = mensaje => ({ ok: false, mensaje });

        if (!datos || !Array.isArray(datos.criterios) || !datos.criterios.length) return error('No hay criterios que importar.');
        if (!queryRows().length || !document.querySelector('input[name$="[addcriterion]"], #rubric-criteria-addcriterion')) {
            return error('Abre el editor de una rúbrica de Moodle antes de importar el CSV.');
        }
        let criteriosEscritos = 0, nivelesEscritos = 0;
        try {
            for (let i = 0; i < datos.criterios.length; i++) {
                const criterio = datos.criterios[i];
                let filas = queryRows();
                if (i >= filas.length) {
                    const boton = document.querySelector('input[name$="[addcriterion]"], #rubric-criteria-addcriterion');
                    if (!boton || boton.disabled) return error(`Solo se importaron ${criteriosEscritos} criterios: no se puede añadir el siguiente.`);
                    boton.click();
                    const nuevas = await esperar(() => queryRows().length > i ? queryRows() : null);
                    if (!nuevas) return error(`Solo se importaron ${criteriosEscritos} criterios: Moodle no añadió la fila ${i + 1}.`);
                    filas = nuevas;
                }
                const fila = filas[i];
                let celdas = queryCells(fila);
                if (celdas.length < criterio.niveles.length && !fila.querySelector('input[name$="[addlevel]"]')) {
                    return error(`Criterio ${i + 1}: faltan niveles y Moodle no muestra «Añadir nivel».`);
                }
                if (!(await escribir(filaDescripcion(fila), criterio.criterio, 'criterio')))
                    return error(`No se pudo editar la descripción del criterio ${i + 1}.`);
                for (let j = 0; j < criterio.niveles.length; j++) {
                    if (j >= celdas.length) {
                        const boton = fila.querySelector('input[name$="[addlevel]"]');
                        if (!boton || boton.disabled) return error(`Criterio ${i + 1}: no se pudo añadir el nivel ${j + 1}.`);
                        boton.click();
                        const nuevas = await esperar(() => queryCells(fila).length > j ? queryCells(fila) : null);
                        if (!nuevas) return error(`Criterio ${i + 1}: Moodle no añadió el nivel ${j + 1}.`);
                        celdas = nuevas;
                    }
                    const nivel = criterio.niveles[j];
                    if (!(await escribir(celdaDefinicion(celdas[j]), nivel.descripcion, 'descripcion')))
                        return error(`Criterio ${i + 1}, nivel ${j + 1}: no se pudo escribir la descripción.`);
                    if (!(await escribir(celdaPuntos(celdas[j]), nivel.puntuacion, 'puntos')))
                        return error(`Criterio ${i + 1}, nivel ${j + 1}: no se pudo escribir la puntuación.`);
                    nivelesEscritos++;
                }
                criteriosEscritos++;
            }
        } catch (e) {
            return error(`La importación se interrumpió: ${e.message}`);
        }
        return { ok: true, criterios: criteriosEscritos, niveles: nivelesEscritos,
            mensaje: `Se han rellenado ${criteriosEscritos} criterios y ${nivelesEscritos} niveles. Revisa las celdas y las filas sobrantes y guarda la rúbrica en Moodle.` };
    }

    function iniciarImportacionCsv() {
        if (typeof document === 'undefined') return;
        const archivoInput = document.getElementById('input-rubrica-csv');
        const botonImportar = document.getElementById('btn-importar-rubrica-csv');
        const botonEjemplo = document.getElementById('btn-ejemplo-rubrica-csv');
        const vista = document.getElementById('vista-rubrica-csv');
        const estado = document.getElementById('estado-rubrica-csv');
        if (!archivoInput || !botonImportar || !estado || !vista) return;
        let datos = null;
        const mostrar = (texto, estadoTipo = '') => {
            estado.textContent = texto;
            estado.dataset.state = estadoTipo;
        };
        botonImportar.disabled = true;
        archivoInput.addEventListener('change', async () => {
            datos = null;
            botonImportar.disabled = true;
            vista.replaceChildren();
            const file = archivoInput.files?.[0];
            if (!file) { mostrar(''); return; }
            try {
                if (file.size > 2_000_000) throw new Error('El archivo supera 2 MB.');
                const buffer = await file.arrayBuffer();
                let contenido;
                try { contenido = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
                catch { contenido = new TextDecoder('windows-1252').decode(buffer); }
                datos = parsearCsvRubrica(contenido);
                const resumen = document.createElement('p');
                resumen.className = 'csv-preview-heading';
                resumen.textContent = `${datos.criterios.length} criterios · ${datos.totalNiveles} niveles`;
                vista.append(resumen);
                const lista = document.createElement('ul');
                lista.className = 'csv-preview-list';
                for (const criterio of datos.criterios.slice(0, 5)) {
                    const li = document.createElement('li');
                    li.textContent = `${criterio.criterio} · ${criterio.niveles.length} ${criterio.niveles.length === 1 ? "nivel" : "niveles"}`;
                    lista.append(li);
                }
                if (datos.criterios.length > 5) {
                    const li = document.createElement('li');
                    li.textContent = `Y ${datos.criterios.length - 5} más…`;
                    lista.append(li);
                }
                vista.append(lista);
                botonImportar.disabled = false;
                mostrar('Archivo validado. La importación rellenará las primeras filas del editor de Moodle.', 'ok');
            } catch (e) { mostrar(`No se pudo leer el CSV: ${e.message}`, 'error'); }
        });
        botonImportar.addEventListener('click', async () => {
            if (!datos) return;
            if (!root.confirm('¿Importar la rúbrica CSV en la pestaña de Moodle activa? Se modificarán los primeros criterios y niveles existentes. Moodle no se guardará automáticamente.')) return;
            botonImportar.disabled = true;
            mostrar('Rellenando la rúbrica en Moodle… no cierres este panel.', 'busy');
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.id) throw new Error('No hay una pestaña de Moodle activa.');
                const resultados = await chrome.scripting.executeScript({
                    target: { tabId: tab.id }, func: importarRubricaCsvEnMoodle, args: [datos]
                });
                const resultado = resultados?.[0]?.result;
                if (!resultado) throw new Error('Moodle no devolvió un resultado.');
                mostrar(resultado.mensaje, resultado.ok ? 'ok' : 'error');
            } catch (e) { mostrar(`No se pudo importar: ${e.message}`, 'error'); }
            finally { botonImportar.disabled = false; }
        });
        botonEjemplo?.addEventListener('click', () => {
            const plantilla = '\uFEFFCriterio;Nivel;Descripción;Puntuación\r\n' +
                'Contenido;Inicial;No presenta los elementos esenciales;0\r\n' +
                'Contenido;Adecuado;Incluye los elementos esenciales;2\r\n' +
                'Contenido;Excelente;Contenido completo y preciso;4\r\n' +
                'Presentación;Inicial;Presentación poco clara;0\r\n' +
                'Presentación;Excelente;Presentación clara y ordenada;2\r\n';
            const url = URL.createObjectURL(new Blob([plantilla], { type: 'text/csv;charset=utf-8' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'plantilla-rubrica-moodle.csv';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = { parsearCsvRubrica, importarRubricaCsvEnMoodle, iniciarImportacionCsv };
    if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', iniciarImportacionCsv);
})(typeof window !== 'undefined' ? window : globalThis);
