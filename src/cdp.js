import { WebSocket } from 'ws';
import { request } from 'node:http';
import { configuredCdpEndpoint } from './config.js';

export function httpRequest(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method };
    request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (!data) return resolve(null);
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject).end();
  });
}

class CDPSession {
  constructor(wsUrl) {
    this._wsUrl = wsUrl;
    this._id = 0;
    this._pending = new Map();
    this._handlers = [];
  }

  async connect() {
    this._ws = new WebSocket(this._wsUrl);
    await new Promise((res, rej) => {
      this._ws.once('open', res);
      this._ws.once('error', rej);
    });
    this._ws.on('message', raw => {
      const msg = JSON.parse(raw);
      if (msg.id != null && this._pending.has(msg.id)) {
        const { resolve, reject } = this._pending.get(msg.id);
        this._pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
      this._handlers.forEach(h => h(msg));
    });
    return this;
  }

  send(method, params = {}) {
    const id = ++this._id;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this._ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(eventMethod, fn) {
    const handler = msg => {
      if (msg.method === eventMethod) {
        this._handlers = this._handlers.filter(h => h !== handler);
        fn(msg);
      }
    };
    this._handlers.push(handler);
  }

  async navigate(url) {
    await this.send('Page.enable');
    const loaded = new Promise(resolve => this.once('Page.loadEventFired', resolve));
    await this.send('Page.navigate', { url });
    await loaded;
    // Allow time for SPA JS initialization
    await new Promise(r => setTimeout(r, 800));
  }

  async evaluate(code) {
    const result = await this.send('Runtime.evaluate', {
      expression: code,
      awaitPromise: true,
      returnByValue: true,
      timeout: 30000,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'Evaluation failed');
    }
    return result.result?.value;
  }

  async installInterceptor(pattern) {
    const patternExpr = JSON.stringify(pattern);
    const js = `(
    () => {
      function __defHidden(obj, key, val) {
        try {
          Object.defineProperty(obj, key, { value: val, writable: true, enumerable: false, configurable: true });
        } catch { obj[key] = val; }
      }
      function __disguise(fn, name) {
        const nativeStr = 'function ' + name + '() { [native code] }';
        const _origToString = Function.prototype.toString;
        const _patchedFns = window.__dFns || (function() {
          const m = new Map();
          Object.defineProperty(window, '__dFns', { value: m, enumerable: false, configurable: true });
          Object.defineProperty(Function.prototype, 'toString', {
            value: function() {
              const override = m.get(this);
              return override !== undefined ? override : _origToString.call(this);
            },
            writable: true, configurable: true
          });
          return m;
        })();
        _patchedFns.set(fn, nativeStr);
        try { Object.defineProperty(fn, 'name', { value: name, configurable: true }); } catch {}
        return fn;
      }

      if (!window.__tap_intercepted) __defHidden(window, '__tap_intercepted', []);
      if (!window.__tap_intercepted_errors) __defHidden(window, '__tap_intercepted_errors', []);
      __defHidden(window, '__tap_interceptor_patched_pattern', ${patternExpr});
      const __checkMatch = (url) => window.__tap_interceptor_patched_pattern && url.includes(window.__tap_interceptor_patched_pattern);

      if (!window.__tap_interceptor_patched) {
        const __origFetch = window.fetch;
        window.fetch = __disguise(async function(...args) {
          const reqUrl = typeof args[0] === 'string' ? args[0]
            : (args[0] && args[0].url) || '';
          const response = await __origFetch.apply(this, args);
          if (__checkMatch(reqUrl)) {
            try {
              const clone = response.clone();
              const json = await clone.json();
              window.__tap_intercepted.push(json);
            } catch(e) { window.__tap_intercepted_errors.push({ url: reqUrl, error: String(e) }); }
          }
          return response;
        }, 'fetch');

        const __XHR = XMLHttpRequest.prototype;
        const __origOpen = __XHR.open;
        const __origSend = __XHR.send;
        __XHR.open = __disguise(function(method, url) {
          Object.defineProperty(this, '__iurl', { value: String(url), writable: true, enumerable: false, configurable: true });
          return __origOpen.apply(this, arguments);
        }, 'open');
        __XHR.send = __disguise(function() {
          if (__checkMatch(this.__iurl)) {
            this.addEventListener('load', function() {
              try {
                window.__tap_intercepted.push(JSON.parse(this.responseText));
              } catch(e) { window.__tap_intercepted_errors.push({ url: this.__iurl, error: String(e) }); }
            });
          }
          return __origSend.apply(this, arguments);
        }, 'send');

        __defHidden(window, '__tap_interceptor_patched', true);
      }
    }
    )()`;
    await this.evaluate(js);
  }

  async waitForCapture(timeout = 8) {
    const deadline = Date.now() + timeout * 1000;
    while (Date.now() < deadline) {
      const count = await this.evaluate('(window.__tap_intercepted || []).length');
      if (count > 0) return;
      await new Promise(r => setTimeout(r, 100));
    }
  }

  async getInterceptedRequests() {
    return await this.evaluate('(() => { const d = window.__tap_intercepted || []; window.__tap_intercepted = []; return d; })()') ?? [];
  }

  async click(selector) {
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
  }

  async scroll(direction) {
    if (direction === 'down') await this.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    else await this.evaluate('window.scrollTo(0, 0)');
  }

  close() { this._ws?.close(); }
}

export async function openSession() {
  const base = configuredCdpEndpoint();
  const target = await httpRequest(`${base}/json/new`, 'PUT');
  const session = new CDPSession(target.webSocketDebuggerUrl);
  await session.connect();
  return { session, targetId: target.id, base };
}

export async function closeTab(base, targetId) {
  try { await httpRequest(`${base}/json/close/${targetId}`, 'GET'); } catch {}
}

export async function cdpVersion(base = configuredCdpEndpoint()) {
  return await httpRequest(`${base}/json/version`, 'GET');
}

export async function closeBrowser(base = configuredCdpEndpoint()) {
  const version = await cdpVersion(base);
  if (!version?.webSocketDebuggerUrl) throw new Error(`CDP endpoint does not expose Browser websocket: ${base}`);

  const session = new CDPSession(version.webSocketDebuggerUrl);
  await session.connect();
  try {
    await session.send('Browser.close');
  } finally {
    session.close();
  }
}
