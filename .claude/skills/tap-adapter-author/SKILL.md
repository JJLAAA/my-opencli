---
name: tap-adapter-author
description: Use when writing a TAP adapter for a new site or command. Guides from reconnaissance through pipeline assembly, installation, and verification.
allowed-tools: Bash, Read, Write, Edit
---

# tap-adapter-author

你是给 TAP 写适配器的 agent。目标：**从零到 `tap <site> <command>` 输出正确数据的完整闭环**。

TAP 适配器是纯声明式的——没有自定义函数，只有 pipeline 步骤。

---

## 顶层决策树

```
START
  │
  ▼
用户想抓什么数据 / 哪个站点？
  │
  ▼
判断获取模式（→ references/patterns.md）
  │
  ├─ Pattern A: 公开 JSON API         → 直接 fetch
  ├─ Pattern B: 需要登录态的 API      → navigate + evaluate(fetch in browser)
  ├─ Pattern C: XHR/fetch 请求被隐藏  → intercept
  └─ Pattern D: 数据在页面 DOM 里     → navigate + evaluate(DOM)
  │
  ▼
验证 API 端点可访问（curl / fetch 测试）
  │
  ▼
解码字段结构
  │
  ▼
设计 args + columns
  │
  ▼
组装 pipeline（→ references/patterns.md 模板）
  │
  ▼
安装到 ~/.tap/adapters/<site>/<command>.js
  │
  ▼
运行 tap <site> <command> 验证
  │
  ▼
DONE
```

---

## Runbook

```
[ ] 1. 明确目标
       [ ] 站点域名是什么？
       [ ] 想抓什么数据（列表 / 单条 / 排行）？
       [ ] 用户需要哪些参数（limit / keyword / category）？

[ ] 2. 侦察获取模式
       [ ] 在浏览器打开目标页面，打开 DevTools → Network 过滤 XHR/Fetch
       [ ] 观察：请求是否有 JSON 响应？URL 是否可以直接 curl？
       [ ] 判定 Pattern（A / B / C / D），见 references/patterns.md

[ ] 3. 验证端点
       [ ] Pattern A：直接 curl 或 fetch 验证
       [ ] Pattern B：需要浏览器 cookie → 检查是否需要先登录
       [ ] Pattern C：在 Network Tab 找到被拦截的请求 URL
       [ ] Pattern D：确认数据在 DOM 里可用 document.querySelector 取到
       [ ] 确认：响应 200 + 非 HTML + 含目标数据

[ ] 4. 解码字段
       [ ] 找到 API 响应中目标字段的路径（可能有嵌套，如 data.list[0].title）
       [ ] 列出要展示的字段和类型
       [ ] 对比页面可见值确认字段映射正确（数量级 / 单位 / 格式）

[ ] 5. 设计接口
       [ ] args：用户可配的参数，如 [{ name: 'limit', default: 20 }]
       [ ] columns：表格列名，顺序：标识列 → 业务数字 → 元信息
       [ ] 命名用 camelCase，单位清晰（如 playCount 不是 play）

[ ] 6. 组装 pipeline
       [ ] 按 Pattern 选对应模板（references/patterns.md）
       [ ] 用 select 步骤提取嵌套路径（如 data.list）
       [ ] map 步骤映射字段，用 ${{ }} 表达式
       [ ] 末尾加 limit: '${{ args.limit }}'

[ ] 7. 安装适配器
       [ ] mkdir -p ~/.tap/adapters/<site>/
       [ ] 写入 ~/.tap/adapters/<site>/<command>.js

[ ] 8. 验证
       [ ] 运行 tap <site> <command>（需要 --format table 或 --format json）
       [ ] 检查行数、字段值是否与页面一致
       [ ] 如有 limit 参数，测试 tap <site> <command> --limit 5
```

---

## 降级路径

| 卡在 | 现象 | 跳去 |
|------|------|------|
| Step 2 | Network 没有 XHR | 尝试 Pattern D（DOM 提取）|
| Step 3 | curl 返回 403 | 需要 cookie → 改用 Pattern B |
| Step 3 | 返回 HTML | API 路径不对，重新看 Network |
| Step 3 | 返回 `{"data":[]}` 空数组 | 参数不对，检查 Network 请求参数 |
| Step 4 | 字段含义不清楚 | 对比页面排序推断（如排序后看哪列跟着变）|
| Step 6 | 嵌套结构复杂 | 先用 evaluate 在浏览器跑 JS 确认路径，再翻译成 select 步骤 |
| Step 8 | 输出空 | 检查 select 路径是否正确，在浏览器 console 验证 |
| Step 8 | 字段全是 undefined | map 里的 ${{ item.xxx }} 路径写错，检查实际字段名 |

---

## 参考文件

| 文件 | 什么时候翻 |
|------|----------|
| `references/patterns.md` | Step 2-6：判断 Pattern + 完整 pipeline 模板 |
| `references/field-mapping.md` | Step 6：${{ }} 表达式速查 |
| `references/adapter-template.md` | Step 6-7：完整适配器结构 |

---

## 关键约定

- 适配器只能用 pipeline 声明式步骤，不能写自定义逻辑函数
- `columns` 数组顺序决定表格列顺序，必须与 map 步骤输出的 key 对应
- 需要浏览器的适配器（Pattern B/C/D）要求本地 Chrome 以 `--remote-debugging-port=9222` 启动
- 适配器路径：`~/.tap/adapters/<site>/<command>.js`（`<site>` 通常是域名主体，如 `bilibili`、`linuxdo`）
- 调试过程中的临时 JSON 文件只落在 `/tmp/`，不要留在项目目录
