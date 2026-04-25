# Migrate to Bun Single Executable with External Adapters

## Goal

把 CLI 从 Node.js 项目迁移为 Bun 编译的单一可执行文件，适配器从外部目录动态加载，不依赖用户本地 Node/npm 环境。

## Background

当前问题：
- 使用方需要有 Node.js 环境 + npm install
- 不适合作为 AI Agent 工具调用（环境依赖重）

目标形态：
- Agent 下载一个二进制文件即可使用
- 适配器放在 `~/.mycli/adapters/<site>/<command>.js`，随时新增无需重新编译

## Requirements

1. **运行时迁移**：用 Bun 替代 Node.js 作为运行时（`bun run` 兼容现有代码）
2. **适配器路径**：从 `./adapters/` 改为 `~/.mycli/adapters/`，支持 `MYCLI_ADAPTERS_DIR` 环境变量覆盖
3. **单一可执行文件**：`bun build --compile bin/cli.js --outfile mycli` 输出单文件二进制
4. **动态加载保留**：二进制运行时仍可 `import()` 外部 `.js` 适配器文件
5. **现有适配器迁移**：把 `adapters/` 目录下的文件移到文档说明的默认位置，或提供 install 子命令

## Acceptance Criteria

- [ ] `bun build --compile` 成功生成 `mycli` 二进制
- [ ] 无 Node/npm 环境下，二进制可正常运行
- [ ] 外部适配器（`~/.mycli/adapters/bilibili/hot.js`）可被正确加载执行
- [ ] `MYCLI_ADAPTERS_DIR` 环境变量可覆盖默认路径
- [ ] 原有 `adapters/bilibili/hot.js` 和 `adapters/linuxdo/news.js` 功能不变

## Technical Notes

- Bun 的 `import()` 在编译后的二进制中仍支持加载外部文件（已知可行）
- `pathToFileURL` 在 Bun 中行为与 Node 一致，无需改动
- `ws` 依赖需确认 Bun 兼容性（Bun 内置 WebSocket，可能可以去掉这个依赖）
- CDP 的 `node:http` 需改为 Bun 兼容写法（Bun 支持 `node:http`，应无需改动）
