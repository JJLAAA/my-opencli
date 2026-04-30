# TAP 适配器 Pattern 参考

四种获取模式，判断后套对应 pipeline 模板。

---

## 如何判断 Pattern

在浏览器打开目标页面 → DevTools → Network → 过滤 Fetch/XHR：

```
有 JSON 请求？
  ├─ 是 → 可以直接 curl 访问（不需要 cookie）？
  │         ├─ 是 → Pattern A（公开 API）
  │         └─ 否 → 需要登录 cookie？
  │                   ├─ 是 → Pattern B（浏览器 fetch）
  │                   └─ 签名/token 不可复现 → Pattern C（intercept）
  └─ 否 → 数据直接在 HTML 页面里 → Pattern D（DOM 提取）
```

---

## Pattern A — 公开 JSON API

**特征**：直接 curl 可拿到数据，无需认证。

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  columns: ['title', 'score', 'date'],
  pipeline: [
    { fetch: 'https://api.example.com/list?count=50' },
    { select: 'data.items' },           // 提取嵌套数组，按实际路径调整
    { map: {
      title: '${{ item.title }}',
      score: '${{ item.score }}',
      date:  '${{ item.created_at }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

**注意**：
- `fetch` URL 支持模板表达式，如 `'https://api.example.com/list?q=${{ args.keyword }}'`
- 如果数据直接在顶层数组，省略 `select` 步骤

---

## Pattern B — 带登录态的 API（浏览器 fetch）

**特征**：API 需要登录 cookie，但请求本身无复杂签名，在浏览器上下文里 fetch 即可。

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  columns: ['rank', 'title', 'author', 'views'],
  pipeline: [
    { navigate: 'https://example.com' },   // 加载页面以获取 cookie
    { evaluate: `(async () => {
        const res = await fetch('https://api.example.com/feed?ps=50', {
          credentials: 'include',
        });
        const json = await res.json();
        return json.data.list.map(item => ({
          title:  item.title,
          author: item.author.name,
          views:  item.stat.view,
        }));
      })()` },
    { map: {
      rank:   '${{ index + 1 }}',
      title:  '${{ item.title }}',
      author: '${{ item.author }}',
      views:  '${{ item.views }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

**注意**：
- `navigate` 负责带入 cookie，目标 URL 通常是站点首页或需要登录的任意页
- `evaluate` 里的 fetch 在浏览器沙箱里执行，自动携带 cookie
- 可以直接在 evaluate 里做初步字段提取，减少 map 步骤的复杂度

---

## Pattern C — 拦截隐藏的 XHR/fetch 请求

**特征**：API 请求含动态签名/token，无法直接复现，只能在页面行为触发后捕获响应。

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  columns: ['rank', 'title', 'hot'],
  pipeline: [
    { intercept: {
        capture: 'api/ranking',          // 匹配 URL 中包含该字符串的请求
        trigger: 'navigate:https://example.com/ranking',
        timeout: 10,                     // 等待秒数，默认 8
        select:  'data.list',            // 从响应中提取的路径（可选）
      }
    },
    { map: {
      rank:  '${{ index + 1 }}',
      title: '${{ item.title }}',
      hot:   '${{ item.hot_score }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

**trigger 前缀说明**：

| 前缀 | 效果 |
|------|------|
| `navigate:<url>` | 导航到 URL，等待页面加载完触发请求 |
| `evaluate:<js>` | 执行 JS（如点击按钮触发加载）|
| `click:<selector>` | 点击 CSS 选择器对应元素 |
| `scroll` | 滚动到页面底部（触发懒加载）|

**注意**：
- `capture` 是 URL 子字符串匹配，越精确越好
- 如果一个动作触发多个匹配请求，`intercept` 返回数组；只有一个则直接返回对象
- `select` 在拿到响应后立即提取路径，等价于之后加一个 `select` 步骤

---

## Pattern D — 从页面 DOM 提取

**特征**：数据直接渲染在 HTML 里，无对应 API。

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  columns: ['rank', 'title', 'url'],
  pipeline: [
    { navigate: 'https://example.com/list' },
    { evaluate: `
        Array.from(document.querySelectorAll('.list-item')).map((el, i) => ({
          rank:  i + 1,
          title: el.querySelector('.title')?.textContent?.trim(),
          url:   el.querySelector('a')?.href,
        }))
      ` },
    { map: {
      rank:  '${{ item.rank }}',
      title: '${{ item.title }}',
      url:   '${{ item.url }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

**注意**：
- `evaluate` 结果已经是数组时，`map` 步骤主要用于列名对齐，可以省略
- 如果页面是 SPA 且数据异步加载，navigate 后会等 800ms，通常够用；不够就改用 Pattern B/C
- `?.` 可选链很重要，DOM 元素可能不存在
