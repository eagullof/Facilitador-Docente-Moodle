document.addEventListener('DOMContentLoaded', () => {
  const host = document.getElementById('fp-forums-popup');
  const tabButton = document.getElementById('tab-forums-tab');
  let dispose, generation = 0;
  async function connect() {
    const current = ++generation;
    dispose?.();
    host.replaceChildren();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (current !== generation) return;
    dispose = FPForumsUI.mount(host, async (action, data) => {
      if (!tab?.id) throw new Error('Abre Moodle en una pestaña para consultar los foros.');
      let response;
      try { response = await chrome.tabs.sendMessage(tab.id, { type: 'fp-forums', action, data }); }
      catch (_) { throw new Error('Abre Moodle, inicia sesión y recarga esa pestaña. Después vuelve a Foros.'); }
      if (!response) throw new Error('La pestaña activa no es una página de Moodle con la sesión iniciada.');
      if (!response.ok) throw new Error(response.error);
      return response.data;
    });
  }
  tabButton.addEventListener('shown.bs.tab', connect);
  tabButton.addEventListener('hidden.bs.tab', () => { generation++; dispose?.(); });
  chrome.tabs.onActivated.addListener(() => { if (tabButton.classList.contains('active')) void connect(); });
  chrome.tabs.onUpdated.addListener((_id, change, tab) => { if (change.status === 'complete' && tab.active && tabButton.classList.contains('active')) void connect(); });
});
