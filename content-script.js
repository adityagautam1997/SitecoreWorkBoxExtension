(function () {
  const cfg = (window.workboxConfig = window.workboxConfig || {
    observerConfig: { childList: true, subtree: true },
    workboxSelector: '.scWorkBoxData',
    workboxWrapperSelector: '.scWorkboxContentContainer',
    workboxIframeSelector: 'iframe[src*="xmlcontrol=Workbox"]',
    pathSpanClass: 'scWorkBoxItemPath',
    processedAttr: 'data-path-processed',
    pathLabel: 'Item Path: ',
    cacheKey: 'workboxItemPaths',
    cacheTTL: 86400000,
    checkInterval: 1000,
    maxChecks: 10,
    graphQLFields: 'path',
    encryptionKey:"FhxImvR3U4uIZUSR"
  });

  let initialized = false;

  const getIframeDoc = (iframe) => {
    try {
      return iframe.contentDocument || iframe.contentWindow.document;
    } catch (e) {
      console.warn('Cannot access iframe content:', e);
      return null;
    }
  };

  const isWorkboxPresent = (doc = document) => {
    if (doc.querySelector(cfg.workboxWrapperSelector)) return true;
    const iframe = doc.querySelector(cfg.workboxIframeSelector);
    const iframeDoc = iframe && getIframeDoc(iframe);
    return iframeDoc && !!iframeDoc.querySelector(cfg.workboxWrapperSelector);
  };

  const getCache = () => {
    try {
      const cache = JSON.parse(localStorage.getItem(cfg.cacheKey) || '{}');
      if (typeof Object.values(cache.items || {})[0] === 'string') {
        cache.items = Object.fromEntries(
          Object.entries(cache.items).map(([k, v]) => [k, { itemPath: v }])
        );
        saveCache(cache);
      }
      return { items: cache.items || {}, timestamp: cache.timestamp || 0 };
    } catch {
      return { items: {}, timestamp: 0 };
    }
  };

  const saveCache = (data) => {
    try {
      localStorage.setItem(cfg.cacheKey, JSON.stringify({
        items: data.items,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Cache save error:', e);
    }
  };

  const validCache = (data) => Date.now() - data.timestamp < cfg.cacheTTL;

const getApiKey = () => new Promise((res) => {
    chrome.storage.local.get(['environments'], ({ environments }) => {
        const h = window.location.hostname.toLowerCase();
        const findKey = (env) => {
            if (!env) return null;
            const domainMatch = !env.domain || 
                h === env.domain.replace(/^https?:\/\//, '').replace(/\/.*/, '').toLowerCase();
            return domainMatch && env.apiKey ? decryptString(env.apiKey) : null;
        };
        res(findKey(environments?.dev) || findKey(environments?.qa) || findKey(environments?.prod) || null);
    });
});
  const fetchPaths = async (ids) => {
    const apiKey = (await getApiKey())?.trim();
    if (!apiKey) return {};
    const query = `query { ${ids.map((id, i) => `item${i}: item(path: "${id}", language: "en") { ${cfg.graphQLFields} }`).join('\n')} }`;
    const res = await fetch(`${location.origin}/sitecore/api/graph/edge?sc_apikey=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query })
    });
    const { data = {} } = await res.json();
    return Object.fromEntries(ids.map((id, i) => [id, { itemPath: data[`item${i}`]?.path || 'Path not available' }]));
  };

  const processItems = async (doc = document) => {
    const items = doc.querySelectorAll(`${cfg.workboxSelector}:not([${cfg.processedAttr}])`);
    if (!items.length) return;

    const cache = getCache();
    const useCache = validCache(cache);
    const uncached = [], updates = [];

    items.forEach((el) => {
      const cont = el.querySelector('div');
      const idMatch = cont?.getAttribute('onclick')?.match(/\{([A-F0-9-]+)\}/i);
      if (!idMatch) return;

      const id = `{${idMatch[1]}}`;
      if (el.querySelector(`.${cfg.pathSpanClass}`)) return;

      const pathDiv = Object.assign(doc.createElement('div'), { className: cfg.pathSpanClass });
      pathDiv.style = 'color:#000;font-size:12px;margin-top:4px';
      pathDiv.innerHTML = `<span style="font-weight:600">${cfg.pathLabel}</span><span>Loading...</span>`;

      cont?.parentNode?.insertBefore(pathDiv, cont.nextSibling);
      el.setAttribute(cfg.processedAttr, 'true');

      if (useCache && cache.items[id]) {
        pathDiv.querySelector('span:last-child').textContent = cache.items[id].itemPath;
      } else {
        uncached.push(id);
        updates.push({ el, span: pathDiv.querySelector('span:last-child') });
      }
    });

    if (!uncached.length) return;
    const newPaths = await fetchPaths(uncached);
    const updatedCache = getCache();
    uncached.forEach((id, i) => {
      const path = newPaths[id]?.itemPath || 'Path not available';
      updates[i].span.textContent = path;
      updatedCache.items[id] = { itemPath: path };
    });
    saveCache(updatedCache);
  };

  const observeDOM = (doc = document) => {
    const container = doc.querySelector(cfg.workboxWrapperSelector) || doc.body;
    const obs = new MutationObserver(() => {
      clearTimeout(window.workboxProcessingTimeout);
      window.workboxProcessingTimeout = setTimeout(() => processItems(doc), 300);
    });
    obs.observe(container, cfg.observerConfig);
  };

  const initHelper = () => {
    if (initialized) return;
    if (!validCache(getCache())) localStorage.removeItem(cfg.cacheKey);
    processItems();
    observeDOM();

    const iframe = document.querySelector(cfg.workboxIframeSelector);
    const doc = iframe && getIframeDoc(iframe);
    if (doc && isWorkboxPresent(doc)) {
      processItems(doc);
      observeDOM(doc);
    }
    initialized = true;
  };

  const autoInit = () => {
    if (isWorkboxPresent()) return initHelper();

    let checks = 0;
    const interval = setInterval(() => {
      if (isWorkboxPresent()) {
        clearInterval(interval);
        initHelper();
      } else if (++checks >= cfg.maxChecks) {
        clearInterval(interval);
        console.log('Workbox not found');
      }
    }, cfg.checkInterval);

    new MutationObserver(() => {
      if (!initialized && isWorkboxPresent()) initHelper();
    }).observe(document.body, cfg.observerConfig);
  };
  function decryptString(encryptedStr) {
    if (!encryptedStr) return '';
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedStr, cfg.encryptionKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error('Decryption error:', e);
        return '';
    }
  }
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', autoInit)
    : autoInit();
})();
