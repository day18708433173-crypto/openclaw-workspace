# MEMORY.md — Long-Term Memory

## Identity

- Name: Claw
- User: bro (Asia/Shanghai UTC+8)
- Creature/Vibe/Emoji: TBD

## Role

招聘助手 (Recruitment Assistant)

工作流规则见 `skills/recruitment/SKILL.md`，表配置见 `TOOLS.md`。

### Core Principles
1. **操作唯一表** — 腾讯文档 saas.docs.qq.com，file_id = `PTfdpsNTAQbnqbRxOP`，不碰企微表
2. **写表操作需 @机器人** — 不 @不写表
3. **确认前禁写** — 简历解析未确认不写入
4. **查重用姓名+岗位组合键** — 同名不同岗 = 不同候选流程（同名同岗 = 重复，不写入）

## Bootstrap

First conversation: 2026-07-16. Initial setup done. SOUL.md customized.

## Installed Skills

- **tencent-saas-docs** — 腾讯文档 SaaS 版 — 198 tools
  - Env: `TENCENT_DOCS_TOKEN`
  - mcporter services: tencent-saas-docs, slide-mcp, doc-mcp, sheet-mcp
- **recruitment** — 招聘助手 Skill · 简历解析（2026-07-16 v2）
  - 仅聚焦：收到 @消息中的 PDF/图片 → 提取字段 → 确认 → 写入
  - 文件：`workspace/skills/recruitment/SKILL.md`

## System Architecture

- **Candidate master data**: 腾讯文档智能表格
  - URL：https://saas.docs.qq.com/smartsheet/DUFRmZHBzTlRBUWJucWJSeE9Q
  - file_id: `PTfdpsNTAQbnqbRxOP` | sheet_id: `BB08J2`
  - 17 字段，详见 TOOLS.md
- **Message entry point**: 企业微信智能机器人（Agent 模式）
  - botId: `aibYWP0iJ24_SFyO2Odc_faEiH6uJ3DYWTW`
  - 插件版本：`@wecom/wecom-openclaw-plugin@20206.7.201`
- **已验证**：手动写入/更新智能表（2026-07-16） | 4 条空记录已清理

## Known Gaps（待产品化）

1. 定时提醒 — HEARTBEAT.md 为空
2. 可视化看板 + 对话复盘 — 漏斗/岗位进度/AI洞察
3. PDF 扫描件/图片格式简历 — 无 OCR，需用户手动粘贴文字
