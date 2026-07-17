# OpenClaw 招聘助手工作区

基于 [OpenClaw](https://docs.openclaw.ai) 的 AI 招聘助手，接入企业微信智能机器人，通过腾讯文档 MCP 操作智能表完成候选人信息录入、面试流程跟进和招聘数据复盘。

## 目录

- [环境要求](#环境要求)
- [1. 安装并初始化 OpenClaw](#1-安装并初始化-openclaw)
- [2. 接入企业微信](#2-接入企业微信)
- [3. 部署本工作区](#3-部署本工作区)
- [4. 配置腾讯文档](#4-配置腾讯文档)
- [5. 启动 & 验证](#5-启动--验证)
- [6. 日常使用](#6-日常使用)

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

---

## 5. 启动 & 验证

### 5.1 确认 Gateway 运行中

```bash
openclaw gateway status
# 应显示 Gateway 正在运行（running）
```

> `openclaw onboard --install-daemon` 已自动安装并启动了系统服务，正常情况下开机自启，无需手动操作。

如果 Gateway 没运行：

```bash
openclaw daemon start
```

### 5.2 健康检查

```bash
openclaw health
```

期望：

```
企业微信: configured
Gateway event loop: ok
Agents: main (default)
```

### 5.3 企微消息测试

在企业微信里 @机器人 发送 `月度复盘`，应自动拉数据并返回漏斗统计。

### 5.4 查看 Skill 加载情况

```bash
openclaw sessions list
```

`skillsSnapshot.skills` 中应包含 `BasicInfromation`、`recruitment-funnel`、`recruitment-progress`、`recruitment-channel`。

---

## 6. 日常使用

### 数据录入

在企业微信里 @机器人 发送 PDF 简历 + 岗位 + 渠道信息：

```
@机器人 录入基本信息
[发送 PDF 简历文件]
岗位：产品经理  渠道：BOSS
```

### 数据复盘口令

| 你说 | 机器人做什么 |
|------|------------|
| `月度复盘` / `季度复盘` / `年度复盘` | 统计当前周期转化漏斗（初筛→一面→二面→OFFER） |
| `招聘进度` `产品经理3人 前端2人` | 按岗位统计目标 vs 已接受OFFER vs 流程中 |
| `渠道统计 2026年7月` | 按渠道（BOSS/猎聘/内推/校招）对比转化率 |

### 管理命令

```bash
# 找到你的会话 key
openclaw sessions list

# 清空会话上下文（bot 变笨/跑偏了用）
openclaw sessions compact "agent:main:wecom:group:你的群ID"

# 查看 token 用量
openclaw sessions list

# 重启 Gateway
openclaw gateway restart
```

---

## 常见问题

**Q: bot 回复 "Exec failed: run node inline script"？**

A: 这是 OpenClaw 的 exec 沙箱默认策略。Skill 文件已改用 `mcporter call` 的 `key:value` 参数格式规避。如果仍出现，运行：

```bash
openclaw exec-policy preset yolo
```

**Q: 腾讯文档 Token 多久过期？**

A: 约 30 天。过期后重新执行 `bash ./setup.sh tdoc_check_and_start_auth` → 扫码 → `bash ./setup.sh tdoc_fetch_token`。

**Q: 如何换模型？**

A: 编辑 `openclaw.json` → `agents.defaults.model.primary`，改为 `deepseek/deepseek-v4-pro`（更聪明但更贵）或其他模型。

**Q: 机器人收不到消息？**

A:
1. 确认 Gateway 在运行：`openclaw health`
2. 确认回调 URL 可从外网访问（ngrok/Tailscale 隧道是否在线）
3. 前台运行查看日志：`openclaw gateway run --verbose`

**Q: Windows 上 setup.sh 跑不了？**

A: 安装 [Git Bash](https://git-scm.com) 后在 Git Bash 终端中运行。或者直接用第 4.3 节的手动 mcporter 命令，跳过 setup.sh。
