# 字段映射与模板表达式速查

TAP 用 `${{ expression }}` 语法在字符串值中嵌入动态计算。

---

## 上下文变量

| 变量 | 类型 | 可用步骤 | 说明 |
|------|------|----------|------|
| `item` | object | `map`, `filter` | 当前数组元素 |
| `index` | number | `map`, `filter` | 当前元素下标（0-based）|
| `args` | object | 所有步骤 | CLI 传入的参数，如 `args.limit` |
| `data` | any | `map`, `filter` | 当前管道的完整数据（map 前的数组）|
| `root` | any | `map` | map 开始前的原始 data（跨 select 时有用）|

---

## 常用表达式

```js
// 从 1 开始的排名
rank: '${{ index + 1 }}'

// 取嵌套字段
author: '${{ item.owner.name }}'

// 数字格式化（万）
views: '${{ Math.round(item.stat.view / 10000) + "万" }}'

// 百分比
rate: '${{ (item.rate * 100).toFixed(1) + "%" }}'

// 三元表达式
status: '${{ item.is_top ? "置顶" : "" }}'

// 字符串截断
title: '${{ item.title.slice(0, 50) }}'

// 日期格式化
date: '${{ new Date(item.created_at * 1000).toLocaleDateString("zh-CN") }}'

// 引用 args 参数
url: '${{ "https://example.com/item/" + item.id + "?ref=" + args.ref }}'
```

## output.fields schema 写法

每个最终输出字段都必须先在 `output.fields` 中声明，再在 `map` 中产出同名 key。

```js
output: {
  type: 'list',
  itemName: 'topic',
  fields: {
    title: {
      type: 'string',
      description: 'Topic title.',
      source: 'topic_list.topics[].title',
      examples: ['A sample title'],
    },
    replyCount: {
      type: 'integer',
      description: 'Number of replies in the topic.',
      unit: 'replies',
      source: 'topic_list.topics[].posts_count',
    },
  },
}
```

字段确认规则：

- 先记录 raw path 和 sample，再决定最终 output field 名称
- `description` 写业务含义，不写“title field”这类空泛说明
- 数字字段优先用带单位的名称和 `unit`，如 `viewCount`
- 时间字段写 `format`，如 `iso8601`、`unix-seconds`、`date`
- URL 字段写 `format: 'url'`
- ID 字段写 `format: 'id'`，并在 description 里说明是哪类 ID
- 含义不确定时不要写入最终 schema，先问用户确认

---

## select 步骤路径写法

`select` 用点号分隔路径，支持数组下标：

```js
{ select: 'data.list' }          // data.list
{ select: 'result.0.items' }     // result[0].items
{ select: 'data' }               // 取 data 字段
```

`map` 步骤也支持内联 `select`，在映射前先提取子路径：

```js
{ map: {
    select: 'data.list',         // 先提取 data.list，再映射每项
    title: '${{ item.title }}',
    score: '${{ item.score }}',
}}
```

---

## filter 步骤

filter 的 params 是一个 JS 表达式字符串（返回 truthy 则保留）：

```js
{ filter: 'item.score > 0' }
{ filter: 'item.title && item.title.length > 0' }
{ filter: 'index < 10' }                          // 等价于 limit，但可加条件
{ filter: '!item.is_ad' }
```

---

## sort 步骤

```js
{ sort: 'score' }                         // 按 score 升序
{ sort: { by: 'score', order: 'desc' } }  // 按 score 降序
```

排序用 `localeCompare` 做字符串比较，加 `numeric: true` 选项，所以数字字符串也能正确排序。

---

## limit 步骤

```js
{ limit: 20 }                      // 固定值
{ limit: '${{ args.limit }}' }     // 从 CLI 参数读取
```

---

## fetch 步骤动态 URL

```js
{ fetch: 'https://api.example.com/search?q=${{ args.keyword }}&size=${{ args.limit }}' }
{ fetch: { url: 'https://api.example.com/list' } }
```
