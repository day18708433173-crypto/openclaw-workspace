# OpenClaw 招聘助手工作区

> 📄 **[点击查看方案文档 →](招聘提效场景AI应用方案.docx)**
>
> 方案中包括系统架构设计、功能详解、Demo 效果预览及成本分析。

基于 [OpenClaw](https://docs.openclaw.ai) 的 AI 招聘助手，接入企业微信智能机器人，通过腾讯文档 MCP 操作智能表完成候选人信息录入、面试流程跟进和招聘数据复盘。

## 目录

- [环境要求](#环境要求)
- [1. 安装并初始化 OpenClaw](#1-安装并初始化-openclaw)
- [2. 接入企业微信](#2-接入企业微信)
- [3. 部署本工作区](#3-部署本工作区)
- [4. 配置腾讯文档](#4-配置腾讯文档)

---

## 环境要求

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | ≥ 20 | [下载](https://nodejs.org) |
| npm | ≥ 10 | 随 Node.js 自带 |
| Git | ≥ 2.0 | [下载](https://git-scm.com) |
| mcporter | 0.8.1 | `npm install -g mcporter@0.8.1` |

> **操作系统**：Windows / macOS / Linux 均可。下文路径中 `~` 表示用户目录（Windows: `C:\Users\<用户名>`，macOS/Linux: `/Users/<用户名>`）。

---

## 1. 安装并初始化 OpenClaw

在 **PowerShell** 中执行：

```powershell
# 安装
npm install -g openclaw@latest

# 运行配置向导
openclaw onboard --install-daemon
```

第二条命令会进入交互式配置向导，按提示操作：

1. **模型服务商** — 选择你有 API Key 的服务商（DeepSeek / OpenAI 等，推荐 DeepSeek）
2. **输入 API Key** — 粘贴你的 Key（仅保存在本机，不会上传）
3. **安装后台服务** — 选择**确认**，电脑开机后机器人自动保持在线
4. 其他选项暂时保持默认即可

配置完成后验证：

```powershell
openclaw gateway status
# 看到 Gateway 正在运行（running）即可
```

> 向导会自动完成：创建 `~/.openclaw/` 目录、配置 AI 模型、安装系统服务。
> 如果后续想换模型，编辑 `~/.openclaw/openclaw.json` 中的 `agents.defaults.model.primary` 字段即可。

---

## 2. 接入企业微信

参考企业微信官方文档 **2.2.2 章节**：[在本地终端部署 OpenClaw 并关联机器人](https://open.work.weixin.qq.com/help2/pc/cat?doc_id=21657)

---

## 3. 部署本工作区

```bash
# 备份原工作区（如果有的话）
mv ~/.openclaw/workspace ~/.openclaw/workspace.bak 2>/dev/null

# 克隆
git clone https://github.com/day18708433173-crypto/openclaw-workspace.git ~/.openclaw/workspace
```

克隆后的 `~/.openclaw/workspace/` 目录：

```
workspace/
├── AGENTS.md                           ← Agent 运行约定
├── SOUL.md                             ← 角色定义（招聘助手）
├── TOOLS.md                            ← 智能表字段映射
├── MEMORY.md                           ← 跨会话持久记忆
├── README.md                           ← 本文件
├── skills/
│   ├── BasicInformation/SKILL.md       ← 简历解析 & 录入
│   ├── recruitment-funnel/SKILL.md     ← 招聘漏斗复盘
│   ├── recruitment-progress/SKILL.md   ← 岗位招聘进度
│   ├── recruitment-channel/SKILL.md    ← 渠道来源统计
│   └── tencent-saas-docs/              ← 腾讯文档 MCP 操作指南 & setup.sh
```

---

## 4. 配置腾讯文档

参考 [https://docs.qq.com/scenario/open-claw.html?nlc=1](https://docs.qq.com/scenario/open-claw.html?nlc=1)，按页面引导完成授权即可。

> 授权后可实现企业微信机器人与腾讯文档的关联，支持创建、修改等操作。
