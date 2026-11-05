(() => {
  'use strict';
  if (globalThis.FPForumsUI) return;
  function mount(host, command) {
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    root.replaceChildren();
    const style = document.createElement('style');
    style.textContent = `
      :host{display:block;color:#1a2540;font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color-scheme:light}
      *{box-sizing:border-box} .panel{border:1px solid #e6eaf1;border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 2px 9px rgba(34,52,94,.025)}
      .head{padding:19px 18px 17px;background:#fff;border-bottom:1px solid #e6eaf1} .eyebrow{font-size:10px;letter-spacing:.1em;font-weight:700;color:#3457cf;margin:0 0 5px}
      h2{font-size:20px;margin:0;color:#1a2540;font-weight:760;letter-spacing:-.04em} p{margin:6px 0} .muted{font-size:12px;color:#68758c}
      .body{padding:18px} .tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
      button,select,input,textarea{font:inherit} button,select{border:1px solid #dfe5ee;border-radius:9px;background:white;color:#344765;padding:9px 12px}
      button{cursor:pointer;font-weight:600} button.primary{background:#3457cf;border-color:#3457cf;color:white} button:disabled{opacity:.5;cursor:wait}
      :focus-visible{outline:3px solid #a9baf7;outline-offset:2px} a{color:#3457cf;text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}
      .summary{font-size:24px;font-weight:700;margin:10px 0 0} .status{min-height:20px;color:#68758c;font-size:12px}
      .notice{padding:10px 12px;margin:10px 0;border-radius:7px;background:#fff9e9;border:1px solid #f3e4be;color:#785921;font-size:12px}
      .course{border-top:1px solid #e6eaf1;padding:14px 0 7px} h3{font-size:14px;margin:0 0 8px} ul{list-style:none;padding:0;margin:0}
      li{display:flex;gap:10px;justify-content:space-between;align-items:center;padding:8px 0} .badge{flex-shrink:0;font-size:12px;font-weight:700;background:#edf1ff;color:#3457cf;padding:3px 8px;border-radius:12px}
      .unknown{background:#fff3d9;color:#775323;font-size:11px} .list{max-height:520px;overflow:auto} details{margin-top:16px;border-top:1px solid #e6eaf1;padding-top:12px}
      summary{cursor:pointer;font-weight:600} label{display:block;margin-top:12px} label.check{display:flex;align-items:start;gap:8px} input[type=checkbox]{margin-top:4px;accent-color:#3457cf}
      textarea{margin-top:6px;width:100%;min-height:90px;padding:9px;border:1px solid #dfe5ee;border-radius:9px;resize:vertical;font-size:12px}
      .help{font-size:12px;color:#68758c;margin-top:12px} .error{color:#9a2828} .footer{font-size:11px;color:#8a95a8;margin-top:14px}
      [hidden]{display:none!important} @media(max-width:420px){.head,.body{padding:14px}h2{font-size:20px}.summary{font-size:22px}li{align-items:start}}
    `;
    root.append(style);
    const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
    const panel = el('div', undefined, 'panel'); root.append(panel);
    const head = el('div', undefined, 'head'); panel.append(head);
    head.append(el('p', 'CONSULTA DE FOROS', 'eyebrow'), el('h2', 'Foros sin leer'), el('p', 'Tus cursos, reunidos en una sola consulta.', 'muted'));
    const body = el('div', undefined, 'body'); panel.append(body);
    const site = el('p', '', 'muted'); body.append(site);
    const tools = el('div', undefined, 'tools'); body.append(tools);
    const start = el('button', 'Consultar foros', 'primary'); start.type = 'button';
    const cancel = el('button', 'Cancelar'); cancel.type = 'button'; cancel.hidden = true;
    const filter = el('select'); filter.setAttribute('aria-label', 'Mostrar foros');
    for (const [value,text] of [['pending','Pendientes y sin seguimiento'],['all','Todos los foros']]) { const o=el('option',text);o.value=value;filter.append(o); }
    tools.append(start,cancel,filter);
    const total = el('p','','summary'), status=el('p','Pulsa Consultar foros para revisar tus cursos.','status');
    status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const warnings=el('div'), list=el('div',undefined,'list'); body.append(total,status,warnings,list);
    const details=el('details'), ds=el('summary','Opciones');details.append(ds);body.append(details);
    const autoLabel=el('label',undefined,'check'), auto=el('input');auto.type='checkbox';
    autoLabel.append(auto,el('span','Consultar automáticamente al abrir el Área personal'));details.append(autoLabel);
    const extraLabel=el('label','Cursos adicionales (una dirección por línea)'), extra=el('textarea');
    extra.placeholder='https://tu-campus/course/view.php?id=123'; extraLabel.append(extra);details.append(extraLabel);
    details.append(el('p','Úsalo si falta algún curso en la detección automática. Se guardan solo estas opciones, por campus y cuenta.','muted'));
    const save=el('button','Guardar opciones');save.type='button';details.append(save);
    const saved=el('p','','muted');saved.setAttribute('role','status');details.append(saved);
    const help=el('p',undefined,'help');body.append(help);
    help.append(document.createTextNode('«Sin seguimiento» significa que Moodle no ofrece un contador verificable. Revísalo en '));
    const preferences=el('a','Preferencias del foro');preferences.target='_blank';preferences.rel='noopener';help.append(preferences,document.createTextNode(' y en los ajustes de cada foro.'));
    body.append(el('p','Se consultan los contadores disponibles en Moodle. Abrir un mensaje puede marcarlo como leído; consultar este panel no lo hace.','footer'));
    let state, timer, disposed=false, optionsLoaded=false;
    const link=(text,url)=>{const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener';return a;};
    function render(s) {
      state=s;site.textContent=s.root;preferences.href=s.root+'/user/forum.php';status.classList.remove('error');
      start.disabled=s.running;start.textContent=s.phase==='idle'?'Consultar foros':'Actualizar';cancel.hidden=!s.running;
      auto.disabled=s.running;extra.disabled=s.running;save.disabled=s.running;
      if(!optionsLoaded){auto.checked=s.options.auto;extra.value=s.options.extra;optionsLoaded=true;}
      const forums=s.courses.flatMap(c=>c.forums), count=forums.reduce((n,f)=>n+(f.unread||0),0), unknown=forums.filter(f=>f.unread===null).length;
      total.textContent=s.phase==='idle'?'':count+' mensajes sin leer detectados';
      status.textContent=s.running?(s.phase==='discovering'?'Buscando tus cursos…':`Consultando cursos: ${s.progress} de ${s.total}…`):s.phase==='idle'?'Pulsa Consultar foros para revisar tus cursos.':`${s.progress} de ${s.total} cursos revisados`+(s.checkedAt?' · '+new Date(s.checkedAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'')+(s.complete?'':' · Resultado parcial');
      warnings.replaceChildren();
      for(const text of s.warnings)warnings.append(el('p',text,'notice'));
      if(unknown)warnings.append(el('p',`${unknown} foro(s) sin contador verificable. No se incluyen en el total.`,'notice'));
      list.replaceChildren();
      for(const c of [...s.courses].sort((a,b)=>a.name.localeCompare(b.name,'es'))){
        const shown=c.forums.filter(f=>filter.value==='all'||f.unread===null||f.unread>0);
        if(!shown.length&&!c.error&&filter.value!=='all')continue;
        const section=el('section',undefined,'course'), h=el('h3');h.append(link(c.name,c.url));section.append(h);
        if(c.error)section.append(el('p',c.error,'notice'));
        const ul=el('ul');section.append(ul);
        for(const f of shown){const li=el('li');li.append(link(f.name,f.url+(f.unread>0?'#unread':'')),el('span',f.unread===null?'Sin seguimiento':String(f.unread),f.unread===null?'badge unknown':'badge'));ul.append(li);}
        if(!c.forums.length&&!c.error)section.append(el('p','Sin foros accesibles en este curso.','muted'));
        list.append(section);
      }
      if(s.phase==='done'&&!count&&!unknown&&s.complete&&s.total) list.prepend(el('p','No hay mensajes pendientes en los foros consultados.','muted'));
    }
    async function run(action,data){
      clearTimeout(timer);
      try{const s=await command(action,data);if(disposed)return;render(s);if(action==='save'){saved.textContent=s.canPersist===false?'Opciones aplicadas solo en esta pestaña: Moodle no identifica la cuenta para guardarlas.':'Opciones guardadas.';extra.value=s.options.extra;}}
      catch(e){if(!disposed){status.textContent=e.message;status.classList.add('error');start.disabled=false;}return;}
      // Periodic state reads only; they never initiate a Moodle scan.
      if(!disposed)timer=setTimeout(()=>run('state'),state?.running?700:4000);
    }
    start.addEventListener('click',()=>{status.classList.remove('error');run('start');});
    cancel.addEventListener('click',()=>run('cancel'));
    save.addEventListener('click',()=>run('save',{auto:auto.checked,extra:extra.value}));
    filter.addEventListener('change',()=>{if(state)render(state);});
    void run('state');
    return ()=>{disposed=true;clearTimeout(timer);};
  }
  globalThis.FPForumsUI={mount};
})();
