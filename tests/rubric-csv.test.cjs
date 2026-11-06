const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parsearCsvRubrica, importarRubricaCsvEnMoodle } = require('../rubric-csv.js');
const base = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(base, 'popup.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8'));

test('Importador CSV: varios niveles por criterio y puntuaciones decimales', () => {
    const csv = '\uFEFFCriterio;Nivel;Descripción;Puntuación\r\n' +
      'Contenido;Básico;No realizado;0\r\n' +
      'Contenido;Bien;"Cumple; con lo esperado";2,5\r\n' +
      'Diseño;Alto;"Adecuado ""con estilo""";4\r\n';
    const parsed = parsearCsvRubrica(csv);
    assert.equal(parsed.criterios.length, 2);
    assert.equal(parsed.totalNiveles, 3);
    assert.deepEqual(parsed.criterios[0].niveles, [
      {descripcion:'No realizado', puntuacion:'0'},
      {descripcion:'Cumple; con lo esperado', puntuacion:'2.5'}
    ]);
    assert.equal(parsed.criterios[1].niveles[0].descripcion, 'Adecuado "con estilo"');
});

test('CSV con comas y comillas, cabeceras alternativas y saltos de línea', () => {
    const parsed = parsearCsvRubrica('Criterion,Level,Level Description,Score\n"Trabajo, escrito",Avanzado,"Texto\nmultilínea",4\nTrabajo,Inicial,Pendiente,0\n');
    assert.equal(parsed.criterios.length, 2);
    assert.equal(parsed.criterios[0].criterio, 'Trabajo, escrito');
    assert.equal(parsed.criterios[0].niveles[0].descripcion, 'Texto\nmultilínea');
});

test('CSV: errores visibles antes de alterar Moodle', () => {
    for (const csv of [
      '', 'Criterio;Nivel;Descripción;Puntuación',
      'Criterio;Nivel;Descripción;Puntuación\nA;X;Texto;no-numero',
      'Criterio;Nivel;Descripción;Puntuación\nA;X;Texto;',
      'Criterio;Nivel;Descripción;Puntuación\nA;X;"Falta cierre;1'
    ]) assert.throws(() => parsearCsvRubrica(csv));
});

test('Rúbrica CSV: no modifica páginas que no contienen editor de rúbricas', async () => {
    const anterior = global.document;
    global.document = { querySelectorAll() { return []; }, querySelector() { return null; } };
    try {
        const result = await importarRubricaCsvEnMoodle({criterios:[{criterio:'A',niveles:[{descripcion:'B',puntuacion:'1'}]}]});
        assert.equal(result.ok, false);
        assert.match(result.mensaje, /editor de una rúbrica/);
    } finally { global.document = anterior; }
});

test('Tareas: selector de archivo, vista previa, descarga de ejemplo y módulo cargado', () => {
    for (const id of ['input-rubrica-csv','vista-rubrica-csv','estado-rubrica-csv',
      'btn-importar-rubrica-csv','btn-ejemplo-rubrica-csv']) assert.match(html, new RegExp(`id="${id}"`));
    assert.match(html, /<script src="rubric-csv\.js"><\/script>/);
    assert.equal(manifest.version, '2.3.2');
    assert.match(html, /Crear rúbrica desde texto/);
    assert.match(html, /Moodle Rubric Importer/);
    const ids = [...html.matchAll(/\bid="([\w-]+)"/g)].map(x => x[1]);
    assert.equal(new Set(ids).size, ids.length);
});
