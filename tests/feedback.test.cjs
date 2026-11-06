const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { escribirRetroalimentacionEnMoodle, iniciarRetroalimentaciones, FEEDBACK_STORAGE_KEY } = require('../feedback.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));

function ejecutarEnPagina({ nombre = 'José Francisco ALCÁNTARA MORENO', body = 'Gracias <por> & tu trabajo.', editor = 'tinymce' } = {}) {
    const texts = [{ nodeType: 1, textContent: 'imagen' }, { nodeType: 3, textContent: `  ${nombre}\n        ` }, { nodeType: 1, textContent: '17733805t' }];
    const link = { childNodes: texts };
    const area = { dispatchEvent(event) { this.events.push(event.type); }, events: [], tagName: 'TEXTAREA' };
    const iframe = {};
    const tiny = {
        initialized: true,
        undoManager: { transact(fn) { fn(); } },
        setContent(html) { this.html = html; },
        save() { this.saved = true; },
        setDirty(value) { this.dirty = value; },
        fire(name) { (this.events ||= []).push(name); }
    };
    const document = {
        querySelector(selector) {
            return selector === '[data-region="user-info"]' ? { querySelector: s => s === 'h4 a' ? link : null } : null;
        },
        getElementById(id) {
            if (id === 'id_assignfeedbackcomments_editor_ifr' && editor === 'tinymce') return iframe;
            if (id === 'id_assignfeedbackcomments_editor') return editor === 'none' ? null : area;
            return null;
        }
    };
    const window = { tinymce: editor === 'tinymce' ? { get: () => tiny } : null };
    const ctx = { document, window, Event: class { constructor(type) { this.type = type; } } };
    vm.createContext(ctx);
    const result = vm.runInContext(`(${escribirRetroalimentacionEnMoodle.toString()})(${JSON.stringify(body)})`, ctx);
    return { result, tiny, area };
}

test('Retroalimentación: primer nombre, sin apellidos ni identificador del alumno, TinyMCE con guardado', () => {
    const { result, tiny, area } = ejecutarEnPagina();
    assert.equal(result.ok, true);
    assert.equal(result.nombre, 'José');
    assert.equal(result.editor, 'tinymce');
    assert.equal(tiny.html, '<p>Hola José,</p><p>Gracias &lt;por&gt; &amp; tu trabajo.</p><p>Un saludo.</p>');
    assert.equal(tiny.saved, true);
    assert.equal(tiny.dirty, true);
    assert.deepEqual(tiny.events, ['input', 'change']);
    assert.deepEqual(area.events, ['input', 'change']);
    assert.doesNotMatch(tiny.html, /Francisco|ALCÁNTARA|17733805t/);
});

test('Retroalimentación: texto plano y saltos de línea en editor sin TinyMCE', () => {
    const { result, area } = ejecutarEnPagina({ nombre: 'María PÉREZ', body: 'Línea 1\nLínea 2', editor: 'textarea' });
    assert.equal(result.ok, true);
    assert.equal(result.nombre, 'María');
    assert.equal(area.value, 'Hola María,\n\nLínea 1\nLínea 2\n\nUn saludo.');
    assert.deepEqual(area.events, ['input', 'change']);
});


test('Retroalimentación: normaliza nombres en mayúsculas y conserva acentos', () => {
    const { result, tiny } = ejecutarEnPagina({ nombre: 'JOSÉ FRANCISCO ALCÁNTARA MORENO', body: 'Trabajo revisado.' });
    assert.equal(result.nombre, 'José');
    assert.equal(tiny.html, '<p>Hola José,</p><p>Trabajo revisado.</p><p>Un saludo.</p>');
    const compuesto = ejecutarEnPagina({ nombre: 'MARÍA-JOSÉ PÉREZ', body: 'Correcto.' });
    assert.equal(compuesto.result.nombre, 'María-José');
    assert.equal(compuesto.tiny.html, '<p>Hola María-José,</p><p>Correcto.</p><p>Un saludo.</p>');
});

test('Retroalimentación: no escribe si no encuentra nombre, editor o plantilla', () => {
    assert.equal(ejecutarEnPagina({ nombre: '   ' }).result.ok, false);
    assert.equal(ejecutarEnPagina({ body: '   ' }).result.ok, false);
    assert.equal(ejecutarEnPagina({ editor: 'none' }).result.ok, false);
});

test('Interfaz: pestaña Corregir, solo allí los controles de calificar', () => {
    assert.match(html, /id="tab-corregir-tab"/);
    assert.match(html, /id="tab-corregir"/);
    const task = html.split('id="tab1"')[1].split('id="tab-corregir"')[0];
    const correcting = html.split('id="tab-corregir"')[1].split('id="tab4"')[0];
    assert.doesNotMatch(task, /id="btn-perfecto"|id="btn-no-entregado"/);
    assert.match(correcting, /id="btn-perfecto"/);
    assert.match(correcting, /id="btn-no-entregado"/);
    for (const id of ['feedback-select','feedback-title-input','feedback-body-input',
        'feedback-new','feedback-save','feedback-delete','feedback-write','feedback-status']) {
        assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
    }
    assert.match(html, /<script src="feedback\.js"><\/script>/);
    assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
    assert.equal(manifest.version, '2.3.2');
});

// Minimal mock DOM for storage and UI state; ensures templates are not lost between popup instances.
function crearPopup(storage) {
    const ids = ['feedback-select','feedback-title-input','feedback-body-input','feedback-new',
        'feedback-save','feedback-delete','feedback-write','feedback-status'];
    const elements = new Map();
    function element(tag = 'button') {
        const handlers = {};
        return {
            tagName: tag.toUpperCase(), value: '', textContent: '', disabled: false,
            dataset: {}, children: [],
            addEventListener(type, callback) { handlers[type] = callback; },
            click() { return handlers.click?.(); },
            change() { return handlers.change?.(); },
            replaceChildren() { this.children = []; this.value = ''; },
            appendChild(item) { this.children.push(item); },
            focus() {},
        };
    }
    for (const id of ids) elements.set(id, element(id === 'feedback-select' ? 'select' : 'button'));
    const document = { getElementById: id => elements.get(id), createElement: () => element('option') };
    const chrome = { storage: { local: storage }, tabs: { query: async () => [{ id: 100 }] },
        scripting: { executeScript: async () => [{ result: { ok:true, nombre:'José' } }] } };
    iniciarRetroalimentaciones({ document, chrome, confirm: () => true });
    return elements;
}

test('Guardar, seleccionar, editar y eliminar múltiples plantillas con storage.local', async () => {
    let data = {};
    const storage = {
        async get(keys) { return data; },
        async set(obj) { data = { ...data, ...obj }; },
    };
    const ui = crearPopup(storage);
    await new Promise(setImmediate);
    const title = ui.get('feedback-title-input'), body = ui.get('feedback-body-input');
    title.value = 'Excelente'; body.value = 'Muy buen trabajo';
    await ui.get('feedback-save').click();
    assert.equal(data[FEEDBACK_STORAGE_KEY].length, 1);
    ui.get('feedback-new').click();
    title.value = 'Mejorable'; body.value = 'Revisa estos apartados';
    await ui.get('feedback-save').click();
    assert.equal(data[FEEDBACK_STORAGE_KEY].length, 2);
    const selected = data[FEEDBACK_STORAGE_KEY][0];
    ui.get('feedback-select').value = selected.id;
    ui.get('feedback-select').change();
    assert.equal(title.value, 'Excelente');
    body.value = 'Trabajo muy bueno';
    await ui.get('feedback-save').click();
    assert.equal(data[FEEDBACK_STORAGE_KEY][0].body, 'Trabajo muy bueno');
    const ui2 = crearPopup(storage);
    await new Promise(setImmediate);
    assert.equal(ui2.get('feedback-select').children.length, 3); // placeholder + 2 templates
    ui2.get('feedback-select').value = selected.id;
    ui2.get('feedback-select').change();
    await ui2.get('feedback-delete').click();
    assert.equal(data[FEEDBACK_STORAGE_KEY].length, 1);
});
