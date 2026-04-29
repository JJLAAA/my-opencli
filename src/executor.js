function render(tmpl, ctx) {
  if (typeof tmpl !== 'string') return tmpl;
  return tmpl.replace(/\$\{\{(.+?)\}\}/g, (_, expr) =>
    Function(...Object.keys(ctx), `return (${expr.trim()})`)(...Object.values(ctx))
  );
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

export async function executePipeline(pipeline, args, session) {
  let data = null;

  for (const step of pipeline) {
    const [op, params] = Object.entries(step)[0];

    if (op === 'fetch') {
      const url = render(params.url ?? params, { args, data });
      data = await fetch(url).then(r => r.json());

    } else if (op === 'navigate') {
      await session.navigate(render(params, { args, data }));

    } else if (op === 'evaluate') {
      data = await session.evaluate(render(params, { args, data }));

    } else if (op === 'intercept') {
      const cfg = typeof params === 'object' && params !== null ? params : {};
      const trigger = cfg.trigger ?? '';
      const capturePattern = cfg.capture ?? '';
      const timeout = cfg.timeout ?? 8;
      const selectPath = cfg.select ?? null;

      if (!capturePattern) {
        // no capture pattern — pass data through
      } else {
        await session.installInterceptor(capturePattern);

        // dispatch trigger
        if (trigger) {
          if (trigger.startsWith('navigate:')) {
            await session.navigate(render(trigger.slice(9), { args, data }));
          } else if (trigger.startsWith('evaluate:')) {
            await session.evaluate(render(trigger.slice(9), { args, data }));
          } else if (trigger.startsWith('click:')) {
            await session.click(trigger.slice(6));
          } else if (trigger === 'scroll' || trigger.startsWith('scroll:')) {
            const dir = trigger.includes(':') ? trigger.slice(7) : 'down';
            await session.scroll(dir);
          }
        }

        await session.waitForCapture(timeout);
        const responses = await session.getInterceptedRequests();
        if (responses.length === 1) data = responses[0];
        else if (responses.length > 1) data = responses;
        // if 0 matches, keep original data

        if (selectPath && data) data = selectByPath(data, selectPath);
      }

    } else if (op === 'select') {
      data = selectByPath(data, render(params, { args, data }));

    } else if (op === 'filter') {
      const items = Array.isArray(data) ? data : [data];
      data = items.filter((item, index) =>
        Function('item', 'index', 'args', 'data', `return !!(${params})`)(item, index, args, data)
      );

    } else if (op === 'map') {
      const root = data;
      let source = data;

      // inline select support
      const hasSelect = typeof params === 'object' && params !== null && 'select' in params;
      if (hasSelect) {
        source = selectByPath(data, params.select);
      }

      const items = Array.isArray(source) ? source
        : (source && typeof source === 'object' && Array.isArray(source.data)) ? source.data
        : [source];

      data = items.map((item, index) => {
        const ctx = { item, index, args, data: source, root };
        return Object.fromEntries(
          Object.entries(params)
            .filter(([k]) => k !== 'select')
            .map(([k, v]) => [k, render(v, ctx)])
        );
      });

    } else if (op === 'sort') {
      if (Array.isArray(data)) {
        const key = typeof params === 'object' && params ? String(params.by ?? '') : String(params);
        const reverse = typeof params === 'object' && params ? params.order === 'desc' : false;
        data = [...data].sort((a, b) => {
          const l = a && typeof a === 'object' ? a[key] : undefined;
          const r = b && typeof b === 'object' ? b[key] : undefined;
          const cmp = String(l ?? '').localeCompare(String(r ?? ''), undefined, { numeric: true });
          return reverse ? -cmp : cmp;
        });
      }

    } else if (op === 'limit') {
      const n = typeof params === 'number'
        ? params
        : Number(render(String(params), { args, data }));
      if (Array.isArray(data)) data = data.slice(0, n);

    } else {
      throw new Error(`Unknown pipeline step: "${op}"`);
    }
  }

  return data;
}
