# deterministic-cli: 基于 CDP 的确定性 CLI 工程实现

## Goal

按照 `deterministic-cli.md` 的设计，实现一个轻量 CLI 框架，以 bilibili 热门视频适配器为例验证端到端流程。用户已有持久化登录态的 Chrome profile，通过 CDP 直连借用登录态调 B站内部 API，无需 LLM 参与执行。

## Requirements

* 实现 `src/cdp.js`：CDP 会话管理（连接、导航、evaluate、关闭 tab）
* 实现 `src/executor.js`：pipeline 执行器，支持 fetch/navigate/evaluate/map/filter/limit
* 实现 `src/output.js`：table / json 输出
* 实现 `bin/cli.js`：CLI 入口，解析 `<site> <command> [--key value]`
* 实现 `adapters/bilibili/hot.js`：B站热门视频适配器
* `package.json` 配置，唯一依赖 `ws`

## Acceptance Criteria

* [ ] `node bin/cli.js bilibili hot --limit 5` 输出 5 条热门视频（table 格式）
* [ ] `node bin/cli.js bilibili hot --format json` 输出 JSON
* [ ] CDP 端点通过 `OPENCLI_CDP_ENDPOINT` 环境变量配置，默认 `http://localhost:9222`
* [ ] 执行完毕后临时 tab 被关闭

## Out of Scope

* HackerNews 等其他适配器
* Bun 编译为二进制
* 多并发 fetch 优化
* 适配器热重载

## Technical Approach

* 纯 ESM，Node.js 运行
* CDP 直连：`/json/new` 创建 tab → WebSocket → navigate 建立 Cookie 上下文 → evaluate 调内部 API
* pipeline DSL 与文档保持一致，模板语法 `${{ expr }}`
* 用户需提前以 `--user-data-dir + --remote-debugging-port=9222` 启动 Chrome

## Technical Notes

* 文档路径：`deterministic-cli.md`
* CDP `/json/new` 返回新 tab 的 webSocketDebuggerUrl
* navigate 后 300ms 等待，SPA 可能需要调整
* `Function()` 动态执行仅用于可信适配器
