# OpenClaw 招聘助手工作区

基于 [OpenClaw](https://docs.openclaw.ai) 的 AI 招聘助手，接入企业微信智能机器人，通过腾讯文档 MCP 操作智能表完成候选人信息录入、面试流程跟进和招聘数据复盘。

## 目录

- [环境要求](#环境要求)
- [1. 安装 OpenClaw](#1-安装-openclaw)
- [2. 配置 AI 模型](#2-配置-ai-模型)
- [3. 接入企业微信](#3-接入企业微信)
- [4. 部署本工作区](#4-部署本工作区)
- [5. 配置腾讯文档](#5-配置腾讯文档)
- [6. 启动 & 验证](#6-启动--验证)
- [7. 日常使用](#7-日常使用)

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

## 1. 安装 OpenClaw

```bash
npm install -g openclaw
openclaw --version
# → OpenClaw 2026.7.1
```

安装后在用户目录生成 `~/.openclaw/` 文件夹：

```
~/.openclaw/
├── openclaw.json          ← 主配置文件
├── workspace/             ← Agent 工作区（Skill、记忆等）
├── agents/                ← Agent 运行时数据
└── exec-approvals.json    ← 命令执行权限（自动生成）
```

---

## 2. 配置 AI 模型

本工作区使用 **DeepSeek**。OpenClaw 的 DeepSeek 插件已内置模型定义，无需手动配置模型参数。

### 2.1 获取 API Key

1. 注册 [DeepSeek 开放平台](https://platform.deepseek.com)
2. 在 [API Keys](https://platform.deepseek.com/api_keys) 页面创建 Key
3. 复制 Key 备用

### 2.2 配置 openclaw.json

在 `~/.openclaw/openclaw.json` 中添加：

```json
{
  "plugins": {
    "entries": {
      "deepseek": { "enabled": true }
    },
    "allow": ["deepseek"]
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "deepseek/deepseek-v4-flash"
      }
    }
  },
  "auth": {
    "profiles": {
      "deepseek:default": {
        "provider": "deepseek",
        "mode": "api_key"
      }
    }
  }
}
```

### 2.3 设置 API Key

**Windows PowerShell：**

```powershell
$env:DEEPSEEK_API_KEY = "sk-xxxxxxxxxxxxxxxx"
```

> 这是临时环境变量，关终端就没了。永久设置：在系统环境变量中添加 `DEEPSEEK_API_KEY`。

**macOS / Linux（永久）：**

```bash
# 写入 shell 配置文件
echo 'export DEEPSEEK_API_KEY="sk-xxxxxxxxxxxxxxxx"' >> ~/.bashrc
source ~/.bashrc
```

### 2.4 换其他模型

DeepSeek 插件内置了 `deepseek-v4-flash` / `deepseek-v4-pro` / `deepseek-chat` / `deepseek-reasoner` 四个模型，改 `agents.defaults.model.primary` 即可切换。

用 OpenAI 的话，安装 OpenAI 插件后同理配置：

```json
{
  "plugins": { "entries": { "openai": { "enabled": true } } },
  "agents": { "defaults": { "model": { "primary": "openai/gpt-5.2" } } },
  "auth": { "profiles": { "openai:default": { "provider": "openai", "mode": "api_key" } } }
}
```

```bash
export OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxx"
```

---

## 3. 接入企业微信

### 3.1 创建企业微信智能机器人

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/wework_admin)
2. 进入 **应用管理 → 智能机器人**
3. 点击 **创建智能机器人**
4. 选择 **Agent 模式**（不是 WebSocket 模式）
5. 记录以下信息：
   - **Bot ID**（机器人 ID）
   - **Secret**（机器人密钥）

### 3.2 配置回调地址

在机器人详情页配置 **回调 URL**：

```
https://<你的服务器域名>:18789/plugins/wecom/agent
```

> 本地开发用 ngrok：`ngrok http 18789`，把生成的 https 地址填到回调 URL。或用 Tailscale Funnel。

### 3.3 配置 openclaw.json

```json
{
  "plugins": {
    "entries": {
      "wecom-openclaw-plugin": { "enabled": true }
    },
    "allow": ["wecom-openclaw-plugin"]
  },
  "channels": {
    "wecom": {
      "enabled": true,
      "botId": "你的 Bot ID",
      "secret": "你的 Secret"
    }
  },
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "loopback"
  }
}
```

> OpenClaw 启动时会自动安装 `wecom-openclaw-plugin`，无需手动 npm install。

### 3.4 启动和测试

```bash
# 安装 Gateway 服务（Windows 上用 schtasks，macOS 用 launchd，Linux 用 systemd）
openclaw daemon install
openclaw daemon start

# 检查状态
openclaw health
# → 企业微信: configured ✓
```

如果不想装系统服务，也可以前台运行：

```bash
openclaw gateway run
```

在企业微信里 @机器人 发一条消息，收到回复即为成功。

---

## 4. 部署本工作区

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

## 5. 配置腾讯文档

腾讯文档通过 **mcporter** 代理 MCP 协议，需要注册 4 个 MCP 服务 + 获取 Token。

### 5.1 安装 mcporter

```bash
npm install -g mcporter@0.8.1
mcporter --version
# → 0.8.1
```

### 5.2 一键授权（推荐）

workspace 内置了自动化脚本，一次性完成 Token 获取 + 4 个 MCP 服务注册：

```bash
cd ~/.openclaw/workspace/skills/tencent-saas-docs

# 第一步：生成授权链接
bash ./setup.sh tdoc_check_and_start_auth
# → AUTH_REQUIRED:https://saas.docs.qq.com/scenario/open-claw.html?nlc=1&authType=1&code=...

# 在浏览器打开链接，用 QQ/微信 扫码授权

# 第二步：获取 Token 并自动注册所有 MCP 服务
bash ./setup.sh tdoc_fetch_token
# → TOKEN_READY ✓
```

> 这一步会自动注册 `tencent-saas-docs`、`slide-mcp`、`doc-mcp`、`sheet-mcp` 四个 MCP 服务。

### 5.3 手动设置（跳过 OAuth）

已知 Token，直接一步注册：

```bash
bash ./setup.sh tdoc_set_token "你的Token"
```

或者手动用 mcporter 注册四个服务：

```bash
TDOC_TOKEN="你的Token"

mcporter config add "tencent-saas-docs" "https://saas.docs.qq.com/api/v6/open/agent/mcp" \
    --header "Authorization=$TDOC_TOKEN" --transport http --scope home

mcporter config add "slide-mcp" "https://saas.docs.qq.com/api/v6/slide/mcp" \
    --header "Authorization=$TDOC_TOKEN" --transport http --scope home

mcporter config add "doc-mcp" "https://saas.docs.qq.com/api/v6/doc/mcp" \
    --header "Authorization=$TDOC_TOKEN" --transport http --scope home

mcporter config add "sheet-mcp" "https://saas.docs.qq.com/api/v6/sheet/mcp" \
    --header "Authorization=$TDOC_TOKEN" --transport http --scope home
```

> Token 获取地址：[https://saas.docs.qq.com/scenario/open-claw.html?nlc=1](https://saas.docs.qq.com/scenario/open-claw.html?nlc=1)

### 5.4 验证

```bash
mcporter list
# 应显示 4 个 healthy 的服务：tencent-saas-docs, slide-mcp, doc-mcp, sheet-mcp

mcporter call "tencent-saas-docs" "smartsheet.list_records" \
  file_id:PTfdpsNTAQbnqbRxOP sheet_id:BB08J2 limit:1
# 正常返回 JSON 则一切就绪
```

### 5.5 故障排查

| 错误码 | 原因 | 解决 |
|--------|------|------|
| `400006` | Token 鉴权失败 | 重新授权 |
| `400007` | 调用次数耗尽 | 升级腾讯文档专业版 |
| `expired` | Token 过期 | 重新获取 |
| `not_authorized` | 未完成扫码 | 在浏览器中完成授权 |
| Windows 上跑不了 bash | 没装 Git Bash | 用第 5.3 节手动 mcporter 命令代替 |

---

## 6. 启动 & 验证

### 6.1 启动 Gateway

```bash
# 安装系统服务后启动（推荐，开机自启）
openclaw daemon install
openclaw daemon start

# 或者前台运行（调试用，看实时日志）
openclaw gateway run --verbose
```

### 6.2 健康检查

```bash
openclaw health
```

期望：

```
企业微信: configured
Gateway event loop: ok
Agents: main (default)
```

### 6.3 企微消息测试

在企业微信里 @机器人 发送 `月度复盘`，应自动拉数据并返回漏斗统计。

### 6.4 查看 Skill 加载情况

```bash
openclaw sessions list
```

`skillsSnapshot.skills` 中应包含 `BasicInfromation`、`recruitment-funnel`、`recruitment-progress`、`recruitment-channel`。

---

## 7. 日常使用

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

A: 安装 [Git Bash](https://git-scm.com) 后在 Git Bash 终端中运行。或者直接用第 5.3 节的手动 mcporter 命令，跳过 setup.sh。
