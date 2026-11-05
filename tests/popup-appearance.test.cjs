const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '..');
const read = filename => fs.readFileSync(path.join(base, filename), 'utf8');
const html = read('popup.html');
const css = read('css/style.css');
const manifest = JSON.parse(read('manifest.json'));

test('Interfaz renovada con cinco pestañas, navegación accesible y sin iconos remotos', () => {
  for (const id of ['tab0-tab','tab1-tab','tab4-tab','tab3-tab','tab-forums-tab']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /class="brand-mark"/);
  assert.match(html, /class="feature-card"/);
  assert.doesNotMatch(html, /cdn\.jsdelivr|fonts\.googleapis|bootstrap-icons/);
  assert.match(css, /\.main-nav\s+\.nav-link/);
  assert.match(css, /prefers-reduced-motion/);
});

test('Se mantienen todos los controles operativos, sin duplicar IDs', () => {
  const ids = [...html.matchAll(/\bid="([\w-]+)"/g)].map(x => x[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['toggle-ocultar','toggle-notificaciones','btn-fechas-tarea',
    'btn-no-entregado','btn-perfecto','input-rubrica','btn-aplicar-rubrica',
    'btn-copiar-prompt','prompt-ia-text','btn-fechas-cuestionario','btn-preparar-test',
    'btn-descargar-pdf-cuestionario','btn-vista-previa','input-nombre-test',
    'btn-descargar-test','estado-descarga-test','estado-pdf-cuestionario',
    'fp-forums-popup']) assert.ok(ids.includes(id),id);
  assert.doesNotMatch(html, /toggle-rubrica-ancho/);
  assert.match(html, /Moodle Rubric Importer/);
  assert.equal(manifest.version, '2.2.0');
  for (const size of ['16','32','48','128']) {
    assert.ok(manifest.action.default_icon[size]);
    assert.ok(fs.existsSync(path.join(base, manifest.action.default_icon[size])));
  }
});
