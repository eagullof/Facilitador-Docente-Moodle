const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const base = 'https://campus.example/moodle';
const config = { wwwroot: base, root: base, sesskey: 'TEST_SESSION_ONLY', userId: 27, siteId: 1 };
const header = cfg => `<script>M.cfg = ${JSON.stringify(cfg)};</script>`;
const index = rows => `<!doctype html><html><head>${header(config)}</head><body id="page-mod-forum-index"><header id="page-header"><h1>Curso de prueba</h1></header><table class="generaltable"><thead><tr><th>Foro</th><th>Descripción</th><th>Debates</th><th>Mensajes no leídos</th><th>Rastreo</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
const row = (id,name,count) => `<tr><td><a href="view.php?f=${id}">${name}</a></td><td></td><td>95</td><td>${count===null?'-':count===0?'<span class="read">0</span>':`<span class="unread"><a href="view.php?f=${id}#unread">${count}</a><a href="markposts.php?f=${id}&mark=read&sesskey=SECRET" title="Marcar todos como leídos"><img alt="Marcar todos como leídos"></a></span>`}</td><td>Sí</td></tr>`;
function env(html = `<main id="region-main"></main>`, url = base+'/my/') {
  const dom = new JSDOM(`<!doctype html><head>${header(config)}</head><body>${html}</body>`, { url, runScripts:'outside-only' });
  const w = dom.window;
  w.structuredClone = structuredClone;
  w.eval(source('forums-core.js'));
  return { dom, w, C:w.FPForumsCore };
}
test('Clásico: cuenta mensajes, conserva desconocidos y nunca reutiliza enlaces de marcar leído', () => {
  const {C,dom}=env();
  const result=C.parseIndex(index(row(20,'Dudas',7)+row(21,'General',0)+row(22,'Sin rastreo',null)),base+'/mod/forum/index.php?id=2',config);
  assert.deepEqual(Array.from(result.forums,f=>f.unread),[7,0,null]);
  assert.equal(result.forums[0].url,base+'/mod/forum/view.php?f=20');
  assert.ok(!JSON.stringify(result).includes('SECRET'));
  dom.window.close();
});
test('Cabecera sin columna de lectura nunca confunde 95 debates con mensajes sin leer',()=>{
  const {C,dom}=env();
  const html=index(row(20,'Dudas',null)).replace('<th>Mensajes no leídos</th>','<th>Otro</th>');
  assert.equal(C.parseIndex(html,base+'/mod/forum/index.php?id=2',config).forums[0].unread,null);dom.window.close();
});
test('Moodle 5.1: usa las alertas, el interruptor de seguimiento y el estado de error',()=>{
  const {C,dom}=env();
  const modern=(id,count,tracked,err=false)=>`<tr data-mdl-overview-cmid="${id}" ${err?'class="bg-danger-subtle"':''}><td data-mdl-overview-item="name"><a href="../mod/forum/view.php?id=${id}">Foro ${id}</a></td><td><input type="checkbox" data-type="forum-track-toggle" ${tracked?'checked':''}></td><td data-mdl-overview-item="actions" ${count?`data-mdl-overview-alertcount="${count}"`:''}>123</td></tr>`;
  const html=`<table class="course-overview-table">${modern(10,5,true)}${modern(11,0,true)}${modern(12,0,false)}${modern(13,7,true,true)}</table>`;
  assert.deepEqual(Array.from(C.parseIndex(html,base+'/course/overview.php?id=2',config).forums,f=>f.unread),[5,0,null,null]);dom.window.close();
});
test('Detecta sesión caducada, cuenta distinta y páginas desconocidas; no devuelve un cero falso',()=>{
  const {C,dom}=env();
  assert.throws(()=>C.parseIndex('<form><input name="username"></form>',base+'/login/index.php',config),/sesión/);
  assert.throws(()=>C.parseIndex('<p>No permitido</p>',base+'/course/view.php?id=2',config),/reconoce/);
  assert.throws(()=>C.parseIndex(index('').replace('"userId":27','"userId":28'),base+'/mod/forum/index.php?id=2',config),/cuenta/);
  dom.window.close();
});
test('Direcciones de cursos: mismo campus y subdirectorio; elimina acciones y duplicados',()=>{
  const {C,dom}=env();
  assert.equal(C.manualCourses(base+'/course/view.php?id=3&delete=1\n'+base+'/course/view.php?id=3',base).length,1);
  assert.equal(C.manualCourses(base+'/course/view.php?id=3&sesskey=X',base)[0].url,base+'/course/view.php?id=3');
  for(const url of ['javascript:alert(1)','https://otra.example/course/view.php?id=3','https://campus.example/otro/course/view.php?id=3',base+'/mod/forum/markposts.php?id=3'])assert.throws(()=>C.manualCourses(url,base));
  dom.window.close();
});
test('Descubre todas las páginas, incluidos cursos ocultos en Mis cursos, y deduplica adicionales',async()=>{
  const {C,w,dom}=env();const calls=[];
  const request=async(url,init)=>{const args=JSON.parse(init.body)[0].args;calls.push(args);return{json:async()=>[{data:{courses:args.offset===0?[{id:2,fullname:'Uno'},{id:3,fullname:'Dos'}]:args.offset===2?[{id:4,fullname:'Tres'}]:[],nextoffset:args.offset===0?2:3}}]};};
  const out=await C.discover({...config,root:base},request,w.document,w.location.href,base+'/course/view.php?id=4',new w.AbortController().signal);
  assert.deepEqual(Array.from(out.courses,c=>c.id),[2,3,4]);assert.equal(out.complete,true);assert.equal(calls.length,3);assert.ok(calls.every(x=>x.classification==='allincludinghidden'));dom.window.close();
});
test('API no disponible: recupera enlaces pero declara explícitamente el resultado parcial',async()=>{
  const {C,w,dom}=env('<a href="../course/view.php?id=7">Mi curso</a>');
  const request=async()=>{throw new Error('No disponible');};
  const out=await C.discover({...config,root:base},request,w.document,w.location.href,'',new w.AbortController().signal);
  assert.equal(out.complete,false);assert.equal(out.courses[0].id,7);assert.ok(out.warnings.length);dom.window.close();
});
async function integrated(handler) {
  const {w,dom,C}=env();const saved={},calls=[];let listener;
  w.chrome={runtime:{id:'test-extension',onMessage:{addListener(fn){listener=fn;}}},storage:{local:{get:async()=>({}),set:async data=>Object.assign(saved,data)}}};
  w.fetch=async(url,init)=>{calls.push({url,init});const body=await handler(url,init,w);return{ok:true,status:200,url,text:async()=>body};};
  w.eval(source('forums-ui.js'));w.eval(source('forums-content.js'));
  const cmd=(action,data)=>w.FPForumsController.command(action,data);
  await cmd('state');
  return {w,dom,C,cmd,calls,saved,listener};
}
async function finished(cmd) {for(let n=0;n<200;n++){const s=await cmd('state');if(!s.running)return s;await new Promise(r=>setTimeout(r,5));}throw Error('La consulta no terminó');}
test('Integración: consulta índices únicamente, conserva errores parciales y actualiza los recuentos',async()=>{
  let count=4;
  const e=await integrated(async(url,init)=>{
    if(url.includes('/lib/ajax/')){const {offset}=JSON.parse(init.body)[0].args;return JSON.stringify([{data:{courses:offset?[]:[{id:2,fullname:'Bien'},{id:3,fullname:'Sin acceso'}],nextoffset:2}}]);}
    if(url.endsWith('id=3'))return '<div class="errorbox">Sin acceso</div>';
    return index(row(20,'Dudas',count)+row(21,'No medible',null));
  });
  await e.cmd('start');let s=await finished(e.cmd);assert.equal(s.progress,2);assert.equal(s.complete,false);assert.equal(s.courses.find(c=>c.id===2).forums[0].unread,4);assert.ok(s.courses.find(c=>c.id===3).error);
  count=0;await e.cmd('start');s=await finished(e.cmd);assert.equal(s.courses.find(c=>c.id===2).forums[0].unread,0);
  assert.ok(e.calls.every(c=>/\/lib\/ajax\/service.php|\/mod\/forum\/index.php/.test(c.url)));
  assert.ok(e.calls.every(c=>c.init.credentials==='same-origin'));
  assert.ok(!e.calls.some(c=>/markposts|settracking|discuss.php/.test(c.url)));
  assert.equal(Object.keys(e.saved).length,0);e.dom.window.close();
});
test('Opciones por campus/cuenta, sin guardar credenciales ni resultados; guardar no escanea',async()=>{
  const e=await integrated(()=>{throw Error('No debería consultar');});
  await e.cmd('save',{auto:true,extra:base+'/course/view.php?id=8&sesskey=SECRET'});
  assert.equal(e.calls.length,0);assert.equal(Object.keys(e.saved)[0],'fpForumsOptions:'+base+':27');
  assert.equal(JSON.stringify(e.saved).includes('SECRET'),false);assert.equal(JSON.stringify(e.saved).includes('TEST_SESSION'),false);e.dom.window.close();
});
test('Cancelar interrumpe la petición y deja visible que el resultado es parcial',async()=>{
  const e=await integrated((url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('abort')))));
  await e.cmd('start');await new Promise(r=>setTimeout(r,5));await e.cmd('cancel');const s=await finished(e.cmd);
  assert.equal(s.phase,'cancelled');assert.equal(s.complete,false);assert.equal(s.running,false);e.dom.window.close();
});
test('UI: nombres no ejecutan HTML, errores y seguimiento desconocido no se ocultan',async()=>{
  const {w,dom}=env();w.eval(source('forums-ui.js'));const host=w.document.createElement('section');w.document.body.append(host);
  const state={root:base,options:{auto:false,extra:''},running:false,phase:'done',progress:2,total:2,complete:false,warnings:['Listado parcial'],checkedAt:null,courses:[{name:'<img src=x onerror=alert(1)>',url:base+'/course/view.php?id=2',forums:[{name:'<script>alert(1)</script>',url:base+'/mod/forum/view.php?id=3',unread:null}]},{name:'Otro',url:base+'/course/view.php?id=4',forums:[],error:'Sin acceso'}]};
  const close=w.FPForumsUI.mount(host,async()=>state);await new Promise(r=>setTimeout(r,10));
  assert.equal(host.shadowRoot.querySelectorAll('img,script').length,0);assert.match(host.shadowRoot.textContent,/Sin seguimiento/);assert.match(host.shadowRoot.textContent,/Resultado parcial/);assert.match(host.shadowRoot.textContent,/Sin acceso/);
  close();dom.window.close();
});
test('No crea el panel ni hace consultas en páginas que no son Moodle o sin sesión',()=>{
  for(const html of ['<body><main></main></body>',`<head>${header({...config,userId:0})}</head><body class="notloggedin"><main></main></body>`]){
    const dom=new JSDOM(html,{url:base+'/my/',runScripts:'outside-only'});dom.window.eval(source('forums-core.js'));dom.window.eval(source('forums-content.js'));assert.equal(dom.window.FPForumsController,undefined);dom.window.close();
  }
});
