const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function examLink(href, activity = true) {
  return {href, textContent:'Cuestionario', closest: () => activity ? ({}) : null};
}
function section(title, links) {
  return {
    querySelector: () => ({textContent:title}),
    querySelectorAll: () => links
  };
}
function extract(sections, name='Examen JULIO', sesskey='test') {
  const document = {
    addEventListener() {},
    querySelectorAll() { return sections; },
    querySelector: () => sesskey ? ({value:sesskey}) : null
  };
  const ctx = {document, window:{location:{href:'https://campus.example/moodle/course/view.php?id=4',origin:'https://campus.example'}},URL,console};
  vm.createContext(ctx);
  vm.runInContext(source('popup.js'),ctx);
  return vm.runInContext(`obtenerDescargasCuestionarios(${JSON.stringify(name)})`,ctx);
}

test('Acciones masivas: usa los cmid de quiz/view.php; ignora 8325 de otras actividades y duplicados',() => {
  const s = section('Exámen  JULIO',[
    examLink('https://campus.example/moodle/mod/assign/view.php?id=8325'),
    examLink('https://campus.example/moodle/mod/quiz/view.php?id=300'),
    examLink('https://campus.example/moodle/mod/quiz/view.php?id=300'),
    examLink('https://campus.example/moodle/mod/quiz/view.php?id=301'),
    examLink('https://otra.example/mod/quiz/view.php?id=302'),
    examLink('https://campus.example/moodle/mod/quiz/view.php?id=303',false),
    examLink('https://campus.example/moodle/mod/quiz/view.php?id=0'),
    examLink('https://campus.example/moodle/mod/quiz/view.php?id=no-numero'),
  ]);
  const result=extract([s]);
  assert.equal(result.coincidencias,1);
  assert.deepEqual([...result.cuestionarios.map(x=>x.id)], [300,301]);
  assert.equal(result.descargas.length,4);
  for (const item of result.descargas) {
    const url=new URL(item.url);
    assert.equal(url.pathname,'/moodle/mod/quiz/report.php');
    assert.ok(['300','301'].includes(url.searchParams.get('id')));
    assert.equal(url.searchParams.get('download'),'excel');
    assert.equal(url.searchParams.get('sesskey'),'test');
    assert.equal(url.searchParams.get('attempts'),'enrolled_with');
    assert.ok(['overview','responses'].includes(url.searchParams.get('mode')));
    assert.ok(!item.url.includes('8325'));
  }
});

test('Acciones masivas: no inicia informes al no encontrar la sección o si solo contiene tareas',() => {
  const s=section('Pruebas',[
    examLink('https://campus.example/mod/assign/view.php?id=8325'),
    examLink('https://campus.example/mod/forum/view.php?id=710')
  ]);
  assert.equal(extract([s]).coincidencias,0);
  const result=extract([s],'Pruebas','');
  assert.equal(result.coincidencias,1);
  assert.equal(result.descargas.length,0);
});

test('Visibilidad: aplica hidden a notificaciones, incluye elementos nuevos y restaura su estado original', () => {
  const notificacion={hidden:false};
  const yaOculta={hidden:true};
  const ajeno={hidden:false};
  const elems=[notificacion,yaOculta];
  const listeners=[];
  const observers=[];
  class MutationObserver {
    constructor(fn) { this.fn=fn; observers.push(this); }
    observe() { this.active=true; }
    disconnect() { this.active=false; }
  }
  const document={
    activeElement:{tagName:'BODY',isContentEditable:false},
    body:{id:'page-course-view-topics'},documentElement:{},
    addEventListener() {},getElementById(){return null;},
    querySelectorAll(selector) {
      if (selector==='.popover-region.popover-region-notifications') return elems;
      return [];
    }
  };
  const chrome={
    storage:{local:{get(keys,fn){fn({ocultarElementos:false,ocultarNotificaciones:false});}}},
    runtime:{onMessage:{addListener(fn){listeners.push(fn);}}}
  };
  vm.runInNewContext(source('content.js'),{document,chrome,MutationObserver,console});
  listeners.forEach(fn=>fn({action:'toggleNotificaciones',ocultar:true},{}));
  assert.equal(notificacion.hidden,true);
  assert.equal(yaOculta.hidden,true);
  assert.equal(ajeno.hidden,false);
  assert.equal(observers.length,1);
  const nueva={hidden:false};
  elems.push(nueva);
  observers[0].fn();
  assert.equal(nueva.hidden,true);
  listeners.forEach(fn=>fn({action:'toggleNotificaciones',ocultar:false},{}));
  assert.equal(notificacion.hidden,false);
  assert.equal(yaOculta.hidden,true);
  assert.equal(nueva.hidden,false);
  assert.equal(observers[0].active,false);
});

test('Interfaz: elimina ancho de rúbricas, añade importador y el interruptor de notificaciones', () => {
  const html=source('popup.html');
  const js=source('popup.js');
  const content=source('content.js');
  const manifest=JSON.parse(source('manifest.json'));
  assert.match(html,/id="toggle-notificaciones"/);
  assert.match(html,/Moodle Rubric Importer/);
  assert.match(html,/mibgeikbmhnmicoopgofmcaebkoplpch/);
  assert.match(html,/id="estado-descarga-test"/);
  assert.doesNotMatch(html,/toggle-rubrica-ancho/);
  assert.doesNotMatch(js,/ajustarRubricaAncho|toggleRubricaAnchoCSS/);
  assert.doesNotMatch(content,/ajustarRubricaAncho|toggleRubricaAnchoCSS/);
  assert.equal(manifest.version,'2.2.0');
});

test('Acciones masivas: el botón solicita solo informes de quizzes y muestra recuento al usuario',async () => {
  const listeners=new Map();
  let domReady;
  const updates=[];
  const btn={disabled:false,addEventListener(kind,fn){listeners.set(`btn:${kind}`,fn);}};
  const input={value:'Examen JULIO'};
  const estado={textContent:'',style:{}};
  const secciones=[section('Examen JULIO',[
    examLink('https://campus.example/moodle/mod/quiz/view.php?id=500'),
    examLink('https://campus.example/moodle/mod/assign/view.php?id=8325')
  ])];
  const document={
    addEventListener(kind,fn){if(kind==='DOMContentLoaded')domReady=fn;},
    querySelectorAll(sel){return sel.startsWith('li.section,')?secciones:[];},
    querySelector(sel){return sel==='input[name="sesskey"]'?({value:'ABC'}):null;},
    getElementById(id) {
      if(id==='btn-descargar-test')return btn;
      if(id==='input-nombre-test')return input;
      if(id==='estado-descarga-test')return estado;
      return null;
    }
  };
  const chrome={
    storage:{local:{get(keys,cb){cb({});}}},
    tabs:{query: async()=>[{id:4}]},
    scripting:{executeScript:async ({func,args})=>[{result:func(args[0])}]},
    downloads:{download: async opts => { updates.push(opts.url);return updates.length; }}
  };
  const bootstrap={Popover: Object.assign(function(){},{getInstance(){return null;}})};
  const ctx={document,chrome,bootstrap,window:{location:{href:'https://campus.example/moodle/course/view.php?id=21',origin:'https://campus.example'}},URL,console};
  vm.createContext(ctx);
  vm.runInContext(source('popup.js'),ctx);
  domReady();
  await listeners.get('btn:click')();
  assert.equal(updates.length,2);
  assert.ok(updates.every(url=>url.includes('id=500') && !url.includes('8325')));
  assert.match(estado.textContent,/2 informes solicitados de 1 cuestionario\./);
  assert.equal(btn.disabled,false);
});
