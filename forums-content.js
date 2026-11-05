(() => {
  'use strict';
  if (globalThis.FPForumsController) return;
  const C = globalThis.FPForumsCore;
  const cfg = C?.config(document, location.href);
  if (!cfg) return;
  const optionsKey = cfg.userId ? 'fpForumsOptions:' + cfg.root + ':' + cfg.userId : null;
  let options = { auto: false, extra: '' };
  let controller;
  let state = { root: cfg.root, options, canPersist: !!optionsKey, running: false, phase: 'idle', progress: 0, total: 0, courses: [], warnings: [], complete: true, checkedAt: null };
  const ready = (async () => {
    if (optionsKey) {
      const saved = (await chrome.storage.local.get(optionsKey))[optionsKey];
      if (saved && typeof saved.extra === 'string') options = { auto: saved.auto === true, extra: saved.extra.slice(0,100000) };
    }
    state.options = options;
  })();

  async function request(url, init, signal) {
    if (!url.startsWith(cfg.root + '/')) throw new Error('Dirección ajena al campus.');
    const timeout = new AbortController();
    const abort = () => timeout.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 20000);
    try {
      if (signal.aborted) throw new Error('Consulta cancelada.');
      const response = await fetch(url, { ...init, credentials: 'same-origin', cache: 'no-store', signal: timeout.signal });
      if (response.url && !response.url.startsWith(cfg.root + '/')) throw new Error('La sesión necesita iniciar sesión de nuevo.');
      if (!response.ok) throw new Error('Moodle ha respondido con un error HTTP ' + response.status + '.');
      // Consume the body inside the timeout and do not expose response/session URLs to the UI.
      const body = await response.text();
      return { url: response.url || url, text: async () => body, json: async () => JSON.parse(body) };
    } catch (e) {
      if (signal.aborted) throw new Error('Consulta cancelada.');
      if (timeout.signal.aborted) throw new Error('Moodle ha tardado demasiado en responder. Inténtalo de nuevo.');
      if (e instanceof TypeError) throw new Error('No se ha podido conectar con Moodle. Comprueba la conexión y tu sesión.');
      throw e;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }

  async function scan() {
    const signal = controller.signal;
    try {
      const current = C.config(document, location.href);
      if (!current || current.sesskey !== cfg.sesskey || current.userId !== cfg.userId) throw new Error('Recarga Moodle para actualizar la sesión.');
      const found = await C.discover(cfg, request, document, location.href, options.extra, signal);
      state.total = found.courses.length;
      state.complete = found.complete;
      state.warnings.push(...found.warnings);
      state.phase = 'scanning';
      if (!state.total) state.warnings.push('No se han encontrado cursos. Abre Mis cursos o añade sus direcciones en Opciones.');
      let next = 0;
      const worker = async () => {
        while (next < found.courses.length && !signal.aborted) {
          const course = found.courses[next++];
          try {
            const response = await request(cfg.root + '/mod/forum/index.php?id=' + course.id, {}, signal);
            const result = C.parseIndex(await response.text(), response.url, cfg);
            state.courses.push({ ...course, name: result.title || course.name, forums: result.forums });
          } catch (e) {
            if (signal.aborted) break;
            state.complete = false;
            state.courses.push({ ...course, forums: [], error: e.message });
          }
          state.progress++;
        }
      };
      // Two requests at most; never fetch forum/view.php or discuss.php during a scan.
      await Promise.all([worker(), worker()]);
      if (signal.aborted) throw new Error('Consulta cancelada. Los resultados son parciales.');
      state.phase = 'done';
      state.checkedAt = new Date().toISOString();
    } catch (e) {
      state.complete = false;
      state.phase = signal.aborted ? 'cancelled' : 'error';
      state.warnings.push(e.message);
    } finally {
      state.running = false;
    }
  }

  async function command(action, data = {}) {
    await ready;
    if (action === 'start' && !state.running) {
      C.manualCourses(options.extra, cfg.root);
      controller = new AbortController();
      state = { ...state, running: true, phase: 'discovering', courses: [], progress: 0, total: 0, warnings: [], complete: true, checkedAt: null };
      void scan();
    } else if (action === 'cancel') {
      controller?.abort();
    } else if (action === 'save') {
      if (state.running) throw new Error('Espera a que termine la consulta para cambiar las opciones.');
      if (typeof data.extra !== 'string' || data.extra.length > 100000) throw new Error('La lista de cursos es demasiado larga.');
      const extra = C.manualCourses(data.extra, cfg.root).map(c => c.url).join('\n');
      options = { auto: data.auto === true, extra };
      if (optionsKey) await chrome.storage.local.set({ [optionsKey]: options });
      state.options = options;
    }
    return structuredClone(state);
  }
  globalThis.FPForumsController = { command };
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.type !== 'fp-forums' || sender.id !== chrome.runtime.id) return;
    if (!['state', 'start', 'cancel', 'save'].includes(message.action)) return;
    command(message.action, message.data).then(data => reply({ ok: true, data }), e => reply({ ok: false, error: e.message }));
    return true;
  });
  window.addEventListener('pagehide', () => controller?.abort());

  void ready.then(() => {
    const relative = location.pathname.slice(new URL(cfg.root).pathname.replace(/\/$/, '').length);
    if (!/^\/my(?:\/|$)/.test(relative)) return;
    const container = document.querySelector('#region-main') || document.querySelector('main, [role="main"]');
    if (!container || document.getElementById('fp-forums-dashboard')) return;
    const host = document.createElement('section');
    host.id = 'fp-forums-dashboard';
    host.style.cssText = 'display:block;margin:0 0 24px;width:100%;';
    container.prepend(host);
    globalThis.FPForumsUI.mount(host, command);
    if (options.auto) void command('start');
  }).catch(() => { /* El popup mostrará el error de almacenamiento si procede. */ });
})();
