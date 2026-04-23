function render(tmpl, ctx) {
  if (typeof tmpl !== 'string') return tmpl;
  return tmpl.replace(/\$\{\{(.+?)\}\}/g, (_, expr) =>
    Function(...Object.keys(ctx), `return (${expr.trim()})`)(...Object.values(ctx))
  );
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

    } else if (op === 'filter') {
      const items = Array.isArray(data) ? data : [data];
      data = items.filter((item, index) =>
        Function('item', 'index', 'args', `return !!(${params})`)(item, index, args)
      );

    } else if (op === 'map') {
      const items = Array.isArray(data) ? data : [data];
      data = items.map((item, index) => {
        const ctx = { item, index, args };
        return Object.fromEntries(
          Object.entries(params).map(([k, v]) => [k, render(v, ctx)])
        );
      });

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
