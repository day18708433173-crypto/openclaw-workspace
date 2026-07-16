# MEMORY.md — Long-Term Memory

## Identity

- Name: Claw
- User: bro (Asia/Shanghai UTC+8)
- Creature/Vibe/Emoji: TBD

## Role

招聘助手 (Recruitment Assistant)

### Core Responsibilities
1. **招聘信息记录** — Record candidate info, job reqs, pipeline status
2. **面试流程跟进** — Track full lifecycle from application to onboarding
3. **招聘数据复盘** — Analyze recruitment data, provide insights
4. **卡关键词：追问确认** — 候选人信息不完整或姓名重名 → 必须追问，不得推测

## Bootstrap

First conversation: 2026-07-16. Initial setup done. SOUL.md customized.

## Installed Skills

- **tencent-saas-docs** — 腾讯文档 SaaS 版 (saas.docs.qq.com) — 198 tools
  - Categories: smartcanvas, sheet, slide, doc, mind, flowchart, smartsheet, form, manage
  - Token configured via `setup.sh tdoc_set_token`
  - Env var: `TENCENT_DOCS_TOKEN` set at user level
  - Token value: `06aee4bf29a5403dad70c9f40f60e1ef`
  - Registered mcporter services: tencent-saas-docs, slide-mcp, doc-mcp, sheet-mcp
- **recruitment** — 已删除（2026-07-16）。先用 tencent-saas-docs 原生能力测试，再评估是否需要专用 Skill。

## System Architecture

- **Candidate master data**: 腾讯文档智能表格 (Smart Sheet)
  - 文档名：招聘表格
  - URL：https://saas.docs.qq.com/smartsheet/DUFRmZHBzTlRBUWJucWJSeE9Q
  - file_id: `PTfdpsNTAQbnqbRxOP` | sheet_id: `BB08J2`
  - 17 个字段，已配置在 TOOLS.md
  - 手动写入/更新已验证通过（2026-07-16）
- **Message entry point**: 企业微信内部群 (WeCom internal group chat) — 待配置
- **Rule**: 写入前必须查重（姓名+岗位组合键）；信息不全先追问；创建时间字段禁写

## Known Gaps (2026-07-16)

## Known Gaps（待测试后确认）

基础链路已通（tencent-saas-docs → 智能表读写），待体验测试的功能：
1. 自然语言写入/更新 — 是否稳定匹配字段、正确处理同名
2. 查重与追问 — 同名多人、缺字段时行为
3. 简历解析入库 — 附件→提取→确认→写入 完整链路
4. 定时提醒 — HEARTBEAT.md 为空
5. 可视化看板 + 对话复盘 — 未做
6. 企业微信群聊接入 — 消息入口尚未配置

已完成：
- ✅ TOOLS.md 表配置固化（file_id/sheet_id/17字段映射/写入规则）
- ✅ MEMORY.md 修正（不再写"未配置"）
- ✅ 4 条空记录清理（2026-07-16）
- ✅ 招聘专用 Skill 已删除，先用 tencent-saas-docs 原生能力测试
