/* Lectura de índices de Moodle. No abre discusiones ni cambia su estado. */
(() => {
  'use strict';
  if (globalThis.FPForumsCore) return;
  const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const plain = html => new DOMParser().parseFromString(String(html || ''), 'text/html').body.textContent.trim();
  const number = text => {
    const value = String(text ?? '').trim();
    if (!/^\d+(?:[.,\s\u00a0\u202f]\d{3})*$/.test(value)) return null;
    const n = Number(value.replace(/\D/g, ''));
    return Number.isSafeInteger(n) ? n : null;
  };

  function config(doc, pageUrl) {
    for (const script of doc.querySelectorAll('script:not([src])')) {
      const match = script.textContent.match(/\bM\.cfg\s*=\s*(\{[\s\S]*?\})\s*;/);
      if (!match) continue;
      try {
        const cfg = JSON.parse(match[1]);
        const root = new URL(cfg.wwwroot);
        const page = new URL(pageUrl);
        if (!/^https?:$/.test(root.protocol) || root.origin !== page.origin || root.username || root.password) continue;
        root.search = ''; root.hash = '';
        const base = root.href.replace(/\/$/, '');
        if (page.href !== base && !page.href.startsWith(base + '/')) continue;
        if (typeof cfg.sesskey !== 'string' || !cfg.sesskey) continue;
        if (doc.body?.classList.contains('notloggedin') || cfg.userId === 0) return null;
        return { root: base, sesskey: cfg.sesskey, userId: Number(cfg.userId) || null, siteId: Number(cfg.siteId) || 1 };
      } catch (_) { /* Otra etiqueta puede contener la configuración. */ }
    }
    return null;
  }

  function localUrl(href, base, root, path) {
    try {
      const u = new URL(href, base), r = new URL(root);
      if (u.origin !== r.origin || u.pathname !== r.pathname.replace(/\/$/, '') + path || u.username || u.password) return null;
      return u;
    } catch (_) { return null; }
  }

  function courseLink(href, base, root) {
    const u = localUrl(href, base, root, '/course/view.php');
    const id = u && Number(u.searchParams.get('id'));
    return Number.isSafeInteger(id) && id > 1 ? { id, url: root + '/course/view.php?id=' + id } : null;
  }

  function manualCourses(text, root) {
    const result = new Map();
    for (const line of String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)) {
      const c = courseLink(line, root + '/', root);
      if (!c) throw new Error('Cada línea debe ser una dirección de curso de este Moodle: …/course/view.php?id=123');
      result.set(c.id, { ...c, name: 'Curso ' + c.id });
    }
    if (result.size > 500) throw new Error('Añade como máximo 500 cursos.');
    return [...result.values()];
  }

  function visibleCourses(doc, pageUrl, root) {
    const courses = new Map();
    for (const a of doc.querySelectorAll('a[href]')) {
      const c = courseLink(a.getAttribute('href'), pageUrl, root);
      const name = a.textContent.trim().replace(/\s+/g, ' ');
      if (c && name) courses.set(c.id, { ...c, name });
    }
    return [...courses.values()];
  }

  function forumLink(href, base, root) {
    const u = localUrl(href, base, root, '/mod/forum/view.php');
    if (!u) return null;
    for (const key of ['f', 'id']) {
      const id = Number(u.searchParams.get(key));
      if (Number.isSafeInteger(id) && id > 0) return root + '/mod/forum/view.php?' + key + '=' + id;
    }
    return null;
  }

  function parseIndex(html, responseUrl, cfg) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const pageConfig = config(doc, responseUrl);
    if (doc.querySelector('input[name="username"], input[name="logintoken"]') || doc.body?.classList.contains('notloggedin')) {
      throw new Error('La sesión ha caducado. Entra de nuevo en Moodle y recarga la página.');
    }
    if (pageConfig && cfg.userId && pageConfig.userId && pageConfig.userId !== cfg.userId) {
      throw new Error('Ha cambiado la cuenta de Moodle. Recarga la página antes de consultar.');
    }
    if (doc.querySelector('.errorbox, [data-rel="fatalerror"]') || /error/.test(doc.body?.id || '')) {
      throw new Error('Moodle no permite consultar este curso o ha devuelto un error.');
    }
    const legacy = doc.body?.id === 'page-mod-forum-index';
    const modern = !!doc.querySelector('table.course-overview-table');
    const forums = new Map();
    for (const table of doc.querySelectorAll('table')) {
      const headers = [...table.querySelectorAll('thead th, tr:first-child th')];
      const unreadColumn = headers.findIndex(th => /unread|no leidos|sin leer|no llegits|non lus|ungelesen/.test(normalize(th.textContent)));
      for (const row of table.querySelectorAll('tr')) {
        // Exclude links embedded in descriptions: Moodle's name column is authoritative.
        const nameCell = row.querySelector('[data-mdl-overview-item="name"]');
        const anchors = [...(nameCell || row).querySelectorAll('a[href]')];
        const a = anchors.find(el => forumLink(el.getAttribute('href'), responseUrl, cfg.root));
        if (!a || a.closest('table') !== table) continue;
        const url = forumLink(a.getAttribute('href'), responseUrl, cfg.root);
        let unread = null;
        if (row.hasAttribute('data-mdl-overview-cmid')) {
          const action = row.querySelector('[data-mdl-overview-item="actions"]');
          const tracking = row.querySelector('input[data-type="forum-track-toggle"]');
          if (action && tracking?.checked && !row.classList.contains('bg-danger-subtle')) {
            unread = action.hasAttribute('data-mdl-overview-alertcount') ? number(action.getAttribute('data-mdl-overview-alertcount')) : 0;
          }
        } else {
          const cell = unreadColumn >= 0 ? row.cells[unreadColumn] : null;
          const countLink = row.querySelector('.unread a[href*="view.php"]');
          const read = row.querySelector('span.read');
          unread = countLink ? number(countLink.textContent) : read ? number(read.textContent) : cell ? number(cell.textContent) : null;
        }
        forums.set(url, { name: a.textContent.trim().replace(/\s+/g, ' ') || 'Foro', url, unread });
      }
    }
    const hasForumLinks = [...doc.querySelectorAll('a[href]')].some(a => forumLink(a.getAttribute('href'), responseUrl, cfg.root));
    if ((!legacy && !modern && !forums.size) || (hasForumLinks && !forums.size)) throw new Error('No se reconoce el índice de foros de esta versión o tema de Moodle.');
    const title = doc.querySelector('#page-header h1, header h1, h1')?.textContent.trim();
    return { forums: [...forums.values()], title };
  }

  async function discover(cfg, request, doc, pageUrl, extraText, signal) {
    const courses = new Map();
    let complete = true;
    const warnings = [];
    try {
      let offset = 0;
      for (let page = 0; page < 20; page++) {
        const url = cfg.root + '/lib/ajax/service.php?sesskey=' + encodeURIComponent(cfg.sesskey);
        const response = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([
          { index: 0, methodname: 'core_course_get_enrolled_courses_by_timeline_classification', args: { classification: 'allincludinghidden', limit: 100, offset, sort: 'fullname' } }
        ]) }, signal);
        const data = await response.json();
        if (!Array.isArray(data) || data[0]?.error || !Array.isArray(data[0]?.data?.courses)) throw new Error('Listado no disponible');
        const batch = data[0].data;
        for (const item of batch.courses) {
          const id = Number(item.id);
          if (Number.isSafeInteger(id) && id > 0 && id !== cfg.siteId) courses.set(id, { id, name: plain(item.fullname) || 'Curso ' + id, url: cfg.root + '/course/view.php?id=' + id });
        }
        const next = Number(batch.nextoffset);
        if (!Number.isInteger(next)) throw new Error('Paginación no reconocida');
        if (next <= offset) break;
        offset = next;
        if (page === 19) throw new Error('Límite de páginas alcanzado');
      }
    } catch (error) {
      if (signal.aborted) throw error;
      complete = false;
      warnings.push('No se ha podido obtener la lista completa de cursos. Se consultan los detectados; puedes añadir los que falten en Opciones.');
      for (const c of visibleCourses(doc, pageUrl, cfg.root)) courses.set(c.id, c);
      for (const path of ['/my/courses.php', '/my/']) {
        try {
          const response = await request(cfg.root + path, {}, signal);
          const page = new DOMParser().parseFromString(await response.text(), 'text/html');
          for (const c of visibleCourses(page, response.url || cfg.root + path, cfg.root)) courses.set(c.id, c);
        } catch (e) { if (signal.aborted) throw e; }
      }
    }
    for (const c of manualCourses(extraText, cfg.root)) if (!courses.has(c.id)) courses.set(c.id, c);
    return { courses: [...courses.values()], complete, warnings };
  }

  globalThis.FPForumsCore = { config, number, courseLink, manualCourses, visibleCourses, forumLink, parseIndex, discover };
})();
