function render(tmpl, ctx) {
  if (typeof tmpl !== 'string') return tmpl;
  return tmpl.replace(/\$\{\{(.+?)\}\}/g, (_, expr) =>
    Function(...Object.keys(ctx), `return (${expr.trim()})`)(...Object.values(ctx))
  );
}

function stepConfig(params) {
  return typeof params === 'object' && params !== null && !Array.isArray(params) ? params : {};
}

function parseSelector(path) {
  const tokens = [];
  const source = String(path);
  let i = 0;

  while (i < source.length) {
    if (source[i] === '.') {
      i++;
      continue;
    }

    if (source[i] === '[') {
      const end = source.indexOf(']', i);
      if (end === -1) return null;
      const value = source.slice(i + 1, end);
      if (value === '*') tokens.push({ type: 'wildcard' });
      else if (/^\d+$/.test(value)) tokens.push({ type: 'key', key: Number(value) });
      else if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        tokens.push({ type: 'key', key: value.slice(1, -1) });
      } else {
        return null;
      }
      i = end + 1;
      continue;
    }

    let end = i;
    while (end < source.length && source[end] !== '.' && source[end] !== '[') end++;
    const key = source.slice(i, end);
    if (key) tokens.push({ type: 'key', key: /^\d+$/.test(key) ? Number(key) : key });
    i = end;
  }

  return tokens;
}

function readKey(value, key) {
  if (value == null || typeof value !== 'object') return null;
  if (Array.isArray(value) && typeof key !== 'number') return null;
  return value[key] ?? null;
}

function project(values, token) {
  const next = [];

  for (const value of values) {
    if (token.type === 'wildcard') {
      if (Array.isArray(value)) next.push(...value);
      continue;
    }

    next.push(readKey(value, token.key));
  }

  return next;
}

function selectByPath(data, path) {
  if (path === undefined || path === null || path === '') return data;
  const tokens = parseSelector(path);
  if (!tokens) return null;
  const hasWildcard = tokens.some(token => token.type === 'wildcard');

  let values = [data];
  for (const token of tokens) {
    const input = values;
    values = project(values, token);
    if (!hasWildcard) values = values.filter(value => value !== null);
    if (!values.length) {
      if (hasWildcard && token.type === 'wildcard' && input.some(Array.isArray)) return [];
      return null;
    }
  }

  if (hasWildcard) return values;
  return values.length === 1 ? values[0] : values;
}

function resolveSource(env, from) {
  if (!from) return env.data;
  const source = render(from, context(env));
  if (source === 'data') return env.data;
  if (source === 'state') return env.state;

  const [head, ...rest] = String(source).split('.');
  if (Object.prototype.hasOwnProperty.call(env.state, head)) {
    return rest.length ? selectByPath(env.state[head], rest.join('.')) : env.state[head];
  }

  return selectByPath(env.data, source);
}

function context(env, extra = {}) {
  return {
    args: env.args,
    data: env.data,
    state: env.state,
    item: env.item,
    index: env.index,
    ...extra,
  };
}

function saveAs(env, params, value) {
  const cfg = stepConfig(params);
  if (cfg.as) env.state[cfg.as] = value;
}

function normalizeItems(value, op) {
  if (Array.isArray(value)) return value;
  throw new Error(`${op} expected an array input.`);
}

async function browserFetch(session, params, env) {
  if (!session) throw new Error('browserFetch requires a browser session.');

  const cfg = stepConfig(params);
  const url = render(cfg.url ?? params, context(env));
  const options = {
    method: cfg.method ?? 'GET',
    credentials: cfg.credentials ?? 'include',
  };
  if (cfg.headers) options.headers = cfg.headers;
  if (cfg.body !== undefined) options.body = render(cfg.body, context(env));

  return await session.evaluate(`(async () => {
    const res = await fetch(${JSON.stringify(url)}, ${JSON.stringify(options)});
    return res.json();
  })()`);
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(workers);
  return results;
}

async function executeSteps(pipeline, env) {
  for (const step of pipeline) {
    const [op, params] = Object.entries(step)[0];

    if (op === 'fetch') {
      const cfg = stepConfig(params);
      const url = render(cfg.url ?? params, context(env));
      env.data = await fetch(url).then(r => r.json());
      saveAs(env, params, env.data);

    } else if (op === 'browserFetch') {
      env.data = await browserFetch(env.session, params, env);
      saveAs(env, params, env.data);

    } else if (op === 'navigate') {
      await env.session.navigate(render(params, context(env)));

    } else if (op === 'evaluate') {
      env.data = await env.session.evaluate(render(params, context(env)));
      saveAs(env, params, env.data);

    } else if (op === 'intercept') {
      const cfg = stepConfig(params);
      const trigger = cfg.trigger ?? '';
      const capturePattern = cfg.capture ?? '';
      const timeout = cfg.timeout ?? 8;
      const selectPath = cfg.select ?? null;

      if (!capturePattern) {
        // no capture pattern — pass data through
      } else {
        await env.session.installInterceptor(capturePattern);

        // dispatch trigger
        if (trigger) {
          if (trigger.startsWith('navigate:')) {
            await env.session.navigate(render(trigger.slice(9), context(env)));
          } else if (trigger.startsWith('evaluate:')) {
            await env.session.evaluate(render(trigger.slice(9), context(env)));
          } else if (trigger.startsWith('click:')) {
            await env.session.click(trigger.slice(6));
          } else if (trigger === 'scroll' || trigger.startsWith('scroll:')) {
            const dir = trigger.includes(':') ? trigger.slice(7) : 'down';
            await env.session.scroll(dir);
          }
        }

        await env.session.waitForCapture(timeout);
        const responses = await env.session.getInterceptedRequests();
        if (responses.length === 1) env.data = responses[0];
        else if (responses.length > 1) env.data = responses;
        // if 0 matches, keep original data

        if (selectPath && env.data) env.data = selectByPath(env.data, selectPath);
        saveAs(env, params, env.data);
      }

    } else if (op === 'select') {
      const cfg = stepConfig(params);
      if (cfg.from || cfg.path !== undefined || cfg.as) {
        const source = resolveSource(env, cfg.from);
        env.data = selectByPath(source, render(cfg.path ?? '', context(env)));
      } else {
        env.data = selectByPath(env.data, render(params, context(env)));
      }
      saveAs(env, params, env.data);

    } else if (op === 'filter') {
      const items = Array.isArray(env.data) ? env.data : [env.data];
      env.data = items.filter((item, index) =>
        Function('item', 'index', 'args', 'data', 'state', `return !!(${params})`)(
          item,
          index,
          env.args,
          env.data,
          env.state
        )
      );

    } else if (op === 'map') {
      const root = env.data;
      let source = env.data;

      // inline select support
      const hasSelect = typeof params === 'object' && params !== null && 'select' in params;
      if (hasSelect) {
        source = selectByPath(env.data, params.select);
      }

      const items = Array.isArray(source) ? source
        : (source && typeof source === 'object' && Array.isArray(source.data)) ? source.data
        : [source];

      env.data = items.map((item, index) => {
        const ctx = context(env, { item, index, data: source, root });
        return Object.fromEntries(
          Object.entries(params)
            .filter(([k]) => k !== 'select')
            .map(([k, v]) => [k, render(v, ctx)])
        );
      });

    } else if (op === 'mapOne') {
      env.data = Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, render(v, context(env))])
      );

    } else if (op === 'foreach') {
      const cfg = stepConfig(params);
      const items = normalizeItems(resolveSource(env, cfg.from), 'foreach');
      const requestedConcurrency = Number(render(String(cfg.concurrency ?? 4), context(env)));
      const concurrency = Math.max(1, Number.isFinite(requestedConcurrency) ? requestedConcurrency : 4);
      env.data = await runWithConcurrency(items, concurrency, async (item, index) => {
        const child = {
          args: env.args,
          session: env.session,
          state: { ...env.state },
          data: item,
          item,
          index,
        };
        return await executeSteps(cfg.steps ?? [], child);
      });
      saveAs(env, params, env.data);

    } else if (op === 'sort') {
      if (Array.isArray(env.data)) {
        const key = typeof params === 'object' && params ? String(params.by ?? '') : String(params);
        const reverse = typeof params === 'object' && params ? params.order === 'desc' : false;
        env.data = [...env.data].sort((a, b) => {
          const l = a && typeof a === 'object' ? a[key] : undefined;
          const r = b && typeof b === 'object' ? b[key] : undefined;
          const cmp = String(l ?? '').localeCompare(String(r ?? ''), undefined, { numeric: true });
          return reverse ? -cmp : cmp;
        });
      }

    } else if (op === 'limit') {
      const n = typeof params === 'number'
        ? params
        : Number(render(String(params), context(env)));
      if (Array.isArray(env.data)) env.data = env.data.slice(0, n);

    } else {
      throw new Error(`Unknown pipeline step: "${op}"`);
    }
  }

  return env.data;
}

export async function executePipeline(pipeline, args, session) {
  return await executeSteps(pipeline, {
    args,
    session,
    state: {},
    data: null,
    item: undefined,
    index: undefined,
  });
}
