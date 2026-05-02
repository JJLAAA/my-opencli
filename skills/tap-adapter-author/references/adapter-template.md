# 适配器模板与安装

---

## 最小模板

```js
export default {
  description: 'Fetch ranked items from example.com.',
  args: [
    { name: 'limit', default: 20, description: 'Maximum number of items to return.' },
    // { name: 'keyword', default: '', description: 'Search keyword.' },
  ],
  output: {
    type: 'list',
    itemName: 'item',
    fields: {
      rank: {
        type: 'integer',
        description: 'One-based rank in the returned result set.',
      },
      title: {
        type: 'string',
        description: 'Item title.',
      },
    },
  },
  columns: ['rank', 'title'],   // 只用于 table 输出
  pipeline: [
    // 步骤按顺序执行，每步的输出是下一步的输入
  ],
};
```

---

## 完整示例：登录态 API

```js
export default {
  description: 'Fetch popular videos from example.com using the logged-in browser session.',
  args: [{ name: 'limit', default: 20, description: 'Maximum number of videos to return.' }],
  output: {
    type: 'list',
    itemName: 'video',
    fields: {
      rank: {
        type: 'integer',
        description: 'One-based rank in the returned result set.',
      },
      title: {
        type: 'string',
        description: 'Video title.',
      },
      author: {
        type: 'string',
        description: 'Uploader display name.',
      },
      viewCount: {
        type: 'integer',
        description: 'Video view count.',
        unit: 'views',
      },
    },
  },
  columns: ['rank', 'title', 'author', 'viewCount'],
  pipeline: [
    { navigate: 'https://example.com' },
    { evaluate: `(async () => {
        const res = await fetch('https://api.example.com/popular?size=50', {
          credentials: 'include',
        });
        const data = await res.json();
        return (data?.data?.list || []).map(item => ({
          title: item.title,
          author: item.owner?.name,
          viewCount: item.stat?.view,
        }));
      })()` },
    { map: {
      rank:      '${{ index + 1 }}',
      title:     '${{ item.title }}',
      author:    '${{ item.author }}',
      viewCount: '${{ item.viewCount }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

---

## 完整示例：公开 API + select 路径提取

```js
export default {
  description: 'Fetch entries from the public example.com listing API.',
  args: [
    { name: 'limit', default: 20, description: 'Maximum number of entries to return.' },
    { name: 'category', default: 'hot', description: 'Listing category to fetch.' },
  ],
  output: {
    type: 'list',
    itemName: 'entry',
    fields: {
      rank: {
        type: 'integer',
        description: 'One-based rank in the returned result set.',
      },
      title: {
        type: 'string',
        description: 'Entry title.',
      },
      score: {
        type: 'number',
        description: 'Entry score from the source ranking API.',
      },
      date: {
        type: 'string',
        description: 'Entry creation date.',
        format: 'date',
      },
    },
  },
  columns: ['rank', 'title', 'score', 'date'],
  pipeline: [
    { fetch: 'https://api.example.com/list?cat=${{ args.category }}&size=50' },
    { select: 'data.items' },
    { map: {
      rank:  '${{ index + 1 }}',
      title: '${{ item.title }}',
      score: '${{ item.score }}',
      date:  '${{ new Date(item.created_at * 1000).toLocaleDateString("zh-CN") }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

---

## 安装命令

```bash
# 创建目录
mkdir -p ~/.tap/adapters/<site>/

# 写入适配器（替换 <site> 和 <command>）
# 用 Write 工具写到 ~/.tap/adapters/<site>/<command>.js
```

---

## 验证命令

```bash
# JSON envelope 验证
tap <site> <command>

# 带参数
tap <site> <command> --limit 5
tap <site> <command> --keyword "搜索词"
```

---

## 命名规范

- `<site>`：站点域名主体，小写，如 `bilibili`、`linuxdo`、`github`
- `<command>`：数据类型或动作，小写，如 `hot`、`news`、`trending`
- 顶层 `description`：一句话说明 adapter 返回什么数据、来自哪个站点/范围，用于 `tap schema` 全局命令发现
- `args[].description`：说明参数业务含义和取值方式，避免 Agent 猜参数
- `output.fields` 字段名：camelCase，含义清晰，必要时带单位（如 `viewCount` 而非 `play`）
- `columns` 只用于 table 输出；JSON schema 以 `output.fields` 为准

---

## 常见结构问题排查

| 问题 | 原因 | 修复 |
|------|------|------|
| 所有行输出 `undefined` | `map` 里的字段路径错误 | 在浏览器 console 确认 `item.xxx` 路径 |
| 输出空数组 | `select` 路径不对 | `console.log(data)` 检查实际结构 |
| JSON 输出缺字段 | `map` 输出的 key 和 `output.fields` 不一致 | 对齐 schema 和 map 字段名 |
| 表格列顺序不对 | `columns` 顺序决定列顺序 | 调整 `columns` 数组顺序 |
| 需要浏览器但报错 | Chrome 未开启调试端口 | 启动 Chrome 加 `--remote-debugging-port=9222` |
