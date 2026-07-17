# 招聘提效场景 AI 应用方案

**Demo 链接：** https://github.com/day18708433173-crypto/openclaw-workspace

基于 [OpenClaw](https://docs.openclaw.ai) 的 AI 招聘助手，接入企业微信智能机器人，通过腾讯文档 MCP 操作智能表完成候选人信息录入、面试流程跟进和招聘数据复盘。

---

## 方案概述

核心思路：**不改变 HR 现有的工作习惯**，在企业微信 + 腾讯文档这套工具链上叠加 AI 能力，让机器人替代手工操作，而非替换整个系统。

### 设计原则

| 原则 | 说明 |
|------|------|
| **零切换成本** | HR 无需学习新系统。在企业微信群里 @机器人 即可完成所有操作——录入、查询、复盘都在聊天窗口内完成 |
| **最小化改造** | 不替换腾讯文档，不引入新数据库或后端服务。数据仍存储在腾讯文档智能表中，AI 通过 MCP 协议直接操作现有表格 |
| **自然语言驱动** | HR 不需要记住命令格式。说"录入基本信息"+"发PDF"就能录入，说"月度复盘"就能出报表。LLM 理解语义后自动匹配对应 Skill |
| **可审计可纠错** | 候选人有重名风险？查重后追问确认才写入。信息不完整？追问缺失字段。所有操作留痕于智能表 |

### 技术架构

```
企业微信（群聊/私聊）
    │
    ▼
WeChat Work Plugin（消息解密、附件下载、XML解析）
    │
    ▼
OpenClaw Gateway（Agent 运行时 + Skill 文件注入）
    │
    ▼
DeepSeek V4 Flash（理解自然语言 → 匹配Skill → 调用工具）
    │
    ▼
mcporter / MCP 协议
    │
    ▼
腾讯文档智能表（17字段，唯一数据源）
```

### 核心功能

| 功能 | 触发方式 | 说明 |
|------|---------|------|
| **简历录入** | `@机器人 录入基本信息` + PDF | LLM 解析简历 → 查重 → 写入智能表 |
| **流程更新** | `@机器人 面试流程信息` | 更新一面/二面/OFFER 各节点状态 |
| **招聘进度** | `招聘进度 产品经理3人` | 按岗位统计目标 vs 已接受OFFER vs 流程中 |
| **转化漏斗** | `月度复盘` / `季度复盘` | 初筛→一面→二面→OFFER 各阶段通过率 |
| **渠道分析** | `渠道统计 2026年7月` | BOSS/猎聘/内推/校招 转化效果对比 |

---

## 部署指南

### 环境要求

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | ≥ 20 | [下载](https://nodejs.org) |
| npm | ≥ 10 | 随 Node.js 自带 |
| Git | ≥ 2.0 | [下载](https://git-scm.com) |

> **操作系统**：Windows / macOS / Linux 均可。下文路径中 `~` 表示用户目录。

### 1. 安装并初始化 OpenClaw

在 **PowerShell** 中执行：

```powershell
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

第二条命令会进入交互式配置向导，按提示操作：

1. **模型服务商** — 选择你有 API Key 的服务商（推荐 DeepSeek）
2. **输入 API Key** — 粘贴你的 Key（仅保存在本机）
3. **安装后台服务** — 选择**确认**，电脑开机后机器人自动保持在线
4. 其他选项暂时保持默认

配置完成后验证：

```powershell
openclaw gateway status
# 看到 Gateway 正在运行即可
```

> 如果后续想换模型，编辑 `~/.openclaw/openclaw.json` 中的 `agents.defaults.model.primary` 字段。

### 2. 接入企业微信

参考企业微信官方文档 **2.2.2 章节**：[在本地终端部署 OpenClaw 并关联机器人](https://open.work.weixin.qq.com/help2/pc/cat?doc_id=21657)

### 3. 部署本工作区

```bash
# 备份原工作区（如果有的话）
mv ~/.openclaw/workspace ~/.openclaw/workspace.bak 2>/dev/null

# 克隆
git clone https://github.com/day18708433173-crypto/openclaw-workspace.git ~/.openclaw/workspace
```

克隆后 `~/.openclaw/workspace/` 目录结构：

```
workspace/
├── AGENTS.md                           ← Agent 运行约定
├── SOUL.md                             ← 角色定义（招聘助手）
├── TOOLS.md                            ← 智能表字段映射
├── MEMORY.md                           ← 跨会话持久记忆
├── README.md                           ← 本文件
├── 招聘提效场景AI应用方案.docx           ← 完整方案文档
├── skills/
│   ├── BasicInformation/SKILL.md       ← 简历解析 & 录入
│   ├── recruitment-funnel/SKILL.md     ← 招聘漏斗复盘
│   ├── recruitment-progress/SKILL.md   ← 岗位招聘进度
│   ├── recruitment-channel/SKILL.md    ← 渠道来源统计
│   └── tencent-saas-docs/              ← 腾讯文档 MCP 操作指南 & setup.sh
```

### 4. 配置腾讯文档

参考 [https://docs.qq.com/scenario/open-claw.html?nlc=1](https://docs.qq.com/scenario/open-claw.html?nlc=1)，按页面引导完成授权。

> 授权后可实现企业微信机器人与腾讯文档的关联，支持创建、修改等操作。
