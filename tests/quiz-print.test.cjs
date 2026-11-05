const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function entornoContenido() {
  const escuchas = [];
  const eventos = [];
  const hijoNavegacion = { textContent: 'Debe desaparecer' };
  const hijoFormulacion = { textContent: 'Respuesta del alumno' };
  const navegacion = { removed: false, children: [hijoNavegacion], remove() { this.removed = true; } };
  const otros = Array.from({ length: 5 }, () => ({ removed: false, remove() { this.removed = true; } }));
  const clases = new Set(['formulation', 'clearfix', 'otra-clase']);
  const formulacion = {
    children: [hijoFormulacion], removed: false,
    classList: { remove(...valores) { valores.forEach(v => clases.delete(v)); } }
  };
  const deshabilitado = {disabled: true, removeAttribute(k) { if (k === 'disabled') this.disabled = false; }};
  const document = {
    activeElement: { tagName: 'BODY', isContentEditable: false },
    addEventListener(tipo, fn) { eventos.push({ tipo, fn }); },
    querySelectorAll(selector) {
      if (selector === '[disabled]') return [deshabilitado];
      if (selector === 'div.formulation.clearfix') return [formulacion];
      if (selector.includes('div.container-fluid.tertiary-navigation')) return [navegacion, ...otros];
      return [];
    },
    getElementById() { return null; }
  };
  const chrome = {
    storage: { local: { get(_claves, fn) { fn({}); } } },
    runtime: { onMessage: { addListener(fn) { escuchas.push(fn); } } }
  };
  const ctx = vm.createContext({ document, chrome, console });
  vm.runInContext(source('content.js'), ctx);
  return { navegacion, otros, formulacion, clases, deshabilitado, hijoFormulacion, escuchas, eventos };
}

test('Limpieza: elimina bloque terciario e hijos, pero conserva la formulación y sus preguntas', () => {
  const e = entornoContenido();
  let respuesta;
  e.escuchas.forEach(fn => fn({action:'prepararCuestionarioParaImprimir'}, {}, dato => { respuesta = dato; }));
  assert.equal(respuesta?.ok, true);
  assert.equal(e.navegacion.removed, true);
  assert.ok(e.otros.every(x => x.removed));
  assert.equal(e.navegacion.children[0].textContent, 'Debe desaparecer');
  assert.equal(e.formulacion.removed, false);
  assert.equal(e.formulacion.children[0], e.hijoFormulacion);
  assert.deepEqual([...e.clases], ['otra-clase']);
  assert.equal(e.deshabilitado.disabled, false);
});

test('El atajo Alt+T también ejecuta la limpieza actualizada', () => {
  const e = entornoContenido();
  const fn = e.eventos.find(x => x.tipo === 'keydown').fn;
  let prevented = false;
  fn({altKey: true, key: 't', preventDefault() { prevented = true; }});
  assert.equal(prevented, true);
  assert.equal(e.navegacion.removed, true);
  assert.equal(e.clases.has('formulation'), false);
});

function entornoFondo(overrides={}) {
  const calls = [];
  let onMessage;
  const chrome = {
    runtime: { id: 'test-extension', onMessage: { addListener(fn) { onMessage = fn; } } },
    sidePanel: { setPanelBehavior() {} },
    commands: { onCommand: { addListener() {} } },
    tabs: {
      query: async () => [{ id: 4 }],
      get: async () => ({ id: 4, url: 'https://campus.example/mod/quiz/review.php', title: 'Biología / Prueba: 2' })
    },
    debugger: {
      attach: async (...args) => { calls.push(['attach', ...args]); },
      sendCommand: async (_dest, cmd, params) => {
        calls.push([cmd, params]);
        if (cmd === 'Runtime.evaluate') {
          return {result: {value: params.expression.includes('return { altura, anchura }')
            ? {altura: 4800, anchura: 1152} : true}};
        }
        if (cmd === 'Page.printToPDF') return {data: 'JVBERi0xLjQK'};
      },
      detach: async (...args) => { calls.push(['detach', ...args]); }
    },
    downloads: { download: async arg => { calls.push(['download', arg]); return 42; } }
  };
  Object.entries(overrides).forEach(([name, values]) => Object.assign(chrome[name], values));
  vm.runInNewContext(source('background.js'), { chrome, console, Set, Number });
  async function solicitud(tabId = 4, remitente = {id:'test-extension'}) {
    return new Promise(resolve => {
      const asincrono = onMessage({action:'exportarCuestionarioPDF',tabId}, remitente, resolve);
      assert.equal(asincrono, true);
    });
  }
  return { calls, solicitud };
}

test('PDF continuo: calcula la altura del contenido, imprime en una sola hoja larga y restaura los estilos', async () => {
  const e = entornoFondo();
  const resultado = await e.solicitud();
  assert.equal(resultado.ok, true);
  assert.equal(resultado.nombreArchivo, 'Cuestionario - Biología Prueba 2.pdf');
  const comandos = e.calls.map(x => x[0]);
  assert.deepEqual(comandos, [
    'attach', 'Runtime.evaluate', 'Emulation.setEmulatedMedia',
    'Runtime.evaluate', 'Page.printToPDF', 'download',
    'Emulation.setEmulatedMedia', 'Runtime.evaluate', 'detach'
  ]);
  const pdf = e.calls.find(x => x[0] === 'Page.printToPDF')[1];
  assert.ok(pdf.paperWidth > 11, 'El ancho se ajusta al tamaño del contenido en pantalla');
  assert.ok(pdf.paperHeight > 50, 'La página se hace más alta según el cuestionario');
  assert.equal(pdf.scale, 1);
  assert.equal(pdf.printBackground, true);
  assert.equal(pdf.displayHeaderFooter, false);
  assert.equal(pdf.preferCSSPageSize, false);
  assert.match(e.calls.find(x=>x[0] === 'download')[1].url, /^data:application\/pdf;base64,/);
  assert.equal(e.calls.find(x=>x[0] === 'download')[1].saveAs, false);
  assert.equal(e.calls[6][1].media, '');
  assert.match(e.calls[7][1].expression, /getElementById/);
});

test('PDF continuo: ajusta la escala antes de llegar al límite de altura', async () => {
  const e = entornoFondo({debugger:{sendCommand:async (_dest,cmd,param)=>{
    e.calls.push([cmd,param]);
    if (cmd==='Runtime.evaluate') return {result:{value:param.expression.includes('return { altura, anchura }') ? {altura:19500, anchura:1000}:true}};
    if (cmd==='Page.printToPDF') return {data:'JVBERi0xLjQK'};
  }}});
  assert.equal((await e.solicitud()).ok, true);
  const pdf = e.calls.find(x=>x[0] === 'Page.printToPDF')[1];
  assert.ok(pdf.paperHeight <= 198);
  assert.ok(pdf.scale < 1 && pdf.scale > 0.5);
});

test('PDF continuo: ante una descarga fallida retira el estilo y desconecta el depurador', async () => {
  const e = entornoFondo({ downloads: {download: async () => {throw new Error('Descarga bloqueada');}} });
  const respuesta = await e.solicitud();
  assert.equal(respuesta.ok, false);
  assert.match(respuesta.error, /Descarga bloqueada/);
  assert.equal(e.calls.at(-1)[0], 'detach');
  assert.equal(e.calls.at(-2)[0], 'Runtime.evaluate');
});

test('PDF continuo: si no se puede medir el cuestionario, no genera un archivo incompleto', async () => {
  const e = entornoFondo({debugger:{sendCommand:async (_dest,cmd,param)=>{
    e.calls.push([cmd,param]);
    if (cmd==='Runtime.evaluate') return {result:{value:param.expression.includes('return { altura, anchura }') ? {altura:0, anchura:0}:true}};
  }}});
  const respuesta = await e.solicitud();
  assert.equal(respuesta.ok, false);
  assert.match(respuesta.error, /medir el cuestionario/);
  assert.ok(!e.calls.some(x=>x[0] === 'download' || x[0]==='Page.printToPDF'));
  assert.equal(e.calls.at(-1)[0], 'detach');
});

test('PDF: rechaza pestañas ajenas y remitentes no autorizados', async () => {
  const e = entornoFondo();
  const ajena = await e.solicitud(88);
  assert.equal(ajena.ok, false);
  assert.match(ajena.error, /pestaña activa/i);
  const remitenteAjeno = await new Promise(resolve => {
    const registro=[];
    const chrome={runtime:{id:'test-extension',onMessage:{addListener:f=>registro.push(f)}},sidePanel:{setPanelBehavior(){}},commands:{onCommand:{addListener(){}}}};
    vm.runInNewContext(source('background.js'), {chrome, console, Set, Number});
    const retorno=registro[0]({action:'exportarCuestionarioPDF',tabId:4},{id:'externo'},resolve);
    assert.equal(retorno, undefined);
  });
  assert.equal(remitenteAjeno.ok, false);
  assert.equal(e.calls.length, 0);
});

test('El panel incluye ambos botones y el manifiesto declara los permisos necesarios', () => {
  const html = source('popup.html');
  const manifest = JSON.parse(source('manifest.json'));
  assert.match(html, /id="btn-preparar-test"/);
  assert.match(html, /id="btn-descargar-pdf-cuestionario"/);
  assert.ok(manifest.permissions.includes('debugger'));
  assert.ok(manifest.permissions.includes('downloads'));
  assert.match(html, /Descargar PDF continuo/);
  assert.equal(manifest.version, '2.2.0');
});
