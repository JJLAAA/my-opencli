# 适配器模板与安装

---

## 最小模板

```js
export default {
  args: [
    { name: 'limit', default: 20 },
    // { name: 'keyword', default: '' },
  ],
  columns: ['rank', 'title'],   // 列名顺序 = 表格列顺序
  pipeline: [
    // 步骤按顺序执行，每步的输出是下一步的输入
  ],
};
```

---

## 完整示例：bilibili 热门

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  columns: ['rank', 'title', 'author', 'play'],
  pipeline: [
    { navigate: 'https://www.bilibili.com' },
    { evaluate: `(async () => {
        const res = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=50&pn=1', {
          credentials: 'include',
        });
        const data = await res.json();
        return (data?.data?.list || []).map(v => ({
          title:  v.title,
          author: v.owner?.name,
          play:   v.stat?.view,
        }));
      })()` },
    { map: {
      rank:   '${{ index + 1 }}',
      title:  '${{ item.title }}',
      author: '${{ item.author }}',
      play:   '${{ item.play }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

---

## 完整示例：公开 API + select 路径提取

```js
export default {
  args: [
    { name: 'limit', default: 20 },
    { name: 'category', default: 'hot' },
  ],
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
# 基础验证
tap <site> <command>

# 指定格式
tap <site> <command> --format json
tap <site> <command> --format table

# 带参数
tap <site> <command> --limit 5
tap <site> <command> --keyword "搜索词"
```

---

## 命名规范

- `<site>`：站点域名主体，小写，如 `bilibili`、`linuxdo`、`github`
- `<command>`：数据类型或动作，小写，如 `hot`、`news`、`trending`
- `columns` 字段名：camelCase，含义清晰，必要时带单位（如 `playCount` 而非 `play`）

---

## 常见结构问题排查

| 问题 | 原因 | 修复 |
|------|------|------|
| 所有行输出 `undefined` | `map` 里的字段路径错误 | 在浏览器 console 确认 `item.xxx` 路径 |
| 输出空数组 | `select` 路径不对 | `console.log(data)` 检查实际结构 |
| `columns` 不对齐 | `map` 输出的 key 和 `columns` 不一致 | 对齐两处的字段名 |
| 表格列顺序不对 | `columns` 顺序决定列顺序 | 调整 `columns` 数组顺序 |
| 需要浏览器但报错 | Chrome 未开启调试端口 | 启动 Chrome 加 `--remote-debugging-port=9222` |
