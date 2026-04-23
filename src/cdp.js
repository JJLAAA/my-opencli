import { WebSocket } from 'ws';
import { request } from 'node:http';

function httpRequest(url, method = 'GET') {
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
    // 等待 JS 初始化（B站是 SPA，适当延长）
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

  close() { this._ws?.close(); }
}

export async function openSession() {
  const base = (process.env.OPENCLI_CDP_ENDPOINT ?? 'http://localhost:9222').replace(/\/$/, '');
  const target = await httpRequest(`${base}/json/new`, 'PUT');
  const session = new CDPSession(target.webSocketDebuggerUrl);
  await session.connect();
  return { session, targetId: target.id, base };
}

export async function closeTab(base, targetId) {
  try { await httpRequest(`${base}/json/close/${targetId}`, 'GET'); } catch {}
}
