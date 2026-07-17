# OpenClaw 招聘助手工作区

基于 [OpenClaw](https://docs.openclaw.ai) 的 AI 招聘助手，接入企业微信智能机器人，通过腾讯文档 MCP 操作智能表完成候选人信息录入、面试流程跟进和招聘数据复盘。

## 目录

- [环境要求](#环境要求)
- [1. 安装 OpenClaw](#1-安装-openclaw)
- [2. 配置 AI 模型](#2-配置-ai-模型)
- [3. 接入企业微信](#3-接入企业微信)
- [4. 注册腾讯文档 MCP 服务](#4-注册腾讯文档-mcp-服务)
- [5. 配置腾讯文档授权](#5-配置腾讯文档授权)
- [6. 部署本工作区](#6-部署本工作区)
- [7. 验证一切正常](#7-验证一切正常)
- [8. 日常使用](#8-日常使用)

---

## 环境要求

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | ≥ 20 | [下载](https://nodejs.org) |
| npm | ≥ 10 | 随 Node.js 自带 |
| Git | ≥ 2.0 | [下载](https://git-scm.com) |
| mcporter | 0.8.1 | `npm install -g mcporter@0.8.1` |

> **操作系统**：Windows / macOS / Linux 均可。下文示例以 Windows 为主，macOS/Linux 将路径改为 `~/.openclaw` 即可。

---

## 1. 安装 OpenClaw

```bash
# 全局安装 OpenClaw CLI
npm install -g openclaw

# 验证安装
openclaw --version
# → OpenClaw 2026.7.1
```

初始化会在用户目录创建 `~/.openclaw` 文件夹，包含配置文件和默认工作区：

```
~/.openclaw/
├── openclaw.json          ← 主配置文件
├── workspace/             ← Agent 工作区（SKILL.md、SOUL.md 等）
├── agents/                ← Agent 运行时数据
└── exec-approvals.json    ← 命令执行权限（可选）
```

---

## 2. 配置 AI 模型

本工作区使用 **DeepSeek**，也支持 OpenAI / Anthropic / 其他兼容 OpenAI API 的模型。

### 2.1 获取 API Key

1. 注册 [DeepSeek 开放平台](https://platform.deepseek.com)
2. 在 [API Keys](https://platform.deepseek.com/api_keys) 页面创建 Key
3. 复制 Key 备用

### 2.2 配置 Provider 和模型

编辑 `~/.openclaw/openclaw.json`，添加以下配置：

```json
{
  "plugins": {
    "entries": {
      "deepseek": { "enabled": true }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "deepseek": {
        "baseUrl": "https://api.deepseek.com",
        "api": "openai-completions",
        "models": [
          {
            "id": "deepseek-v4-flash",
            "name": "DeepSeek V4 Flash",
            "reasoning": true,
            "input": ["text"],
            "contextWindow": 1000000,
            "maxTokens": 384000
          }
        ]
      }
    }
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

然后在终端设置环境变量：

```bash
# Windows PowerShell
$env:DEEPSEEK_API_KEY = "sk-xxxxxxxxxxxxxxxx"

# macOS / Linux
export DEEPSEEK_API_KEY="sk-xxxxxxxxxxxxxxxx"
```

> 或者用 CLI 交互式配置：`openclaw configure --section model`

### 2.3 使用其他模型

OpenAI 兼容的任何 API 都可以。例如用 OpenAI：

```json
{
  "plugins": { "entries": { "openai": { "enabled": true } } },
  "models": {
    "providers": {
      "openai": {
        "baseUrl": "https://api.openai.com/v1",
        "api": "openai-completions",
        "models": [
          { "id": "gpt-5.2", "name": "GPT-5.2", "contextWindow": 400000, "maxTokens": 128000 }
        ]
      }
    }
  },
  "agents": {
    "defaults": { "model": { "primary": "openai/gpt-5.2" } }
  },
  "auth": {
    "profiles": {
      "openai:default": { "provider": "openai", "mode": "api_key" }
    }
  }
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
   - **Token**（回调验证 Token）
   - **EncodingAESKey**（消息加解密密钥）

### 3.2 配置回调地址

1. 在机器人详情页配置 **回调 URL**：
   ```
   https://<你的服务器域名>:18789/plugins/wecom/agent
   ```
   > 本地开发可以用 Tailscale Funnel 或 ngrok 暴露端口

2. 在机器人详情页配置 **可信 IP**（选填，可留空）

### 3.3 安装企业微信插件

```bash
# 全局安装企微 OpenClaw 插件
npm install -g @wecom/wecom-openclaw-plugin
```

### 3.4 配置 openclaw.json

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

### 3.5 启动和测试

```bash
# 启动 Gateway
openclaw gateway start

# 检查企业微信通道状态
openclaw health
# → 企业微信: configured ✓
```

在企业微信里 @机器人 发一条消息，收到回复即为成功。

---

## 4. 注册腾讯文档 MCP 服务

腾讯文档通过 **mcporter** 代理 MCP 协议。你需要注册 4 个 MCP 服务：

| 服务名 | 用途 | MCP Endpoint |
|--------|------|-------------|
| `tencent-saas-docs` | 通用文档操作（创建/搜索/管理） | `https://saas.docs.qq.com/api/v6/open/agent/mcp` |
| `slide-mcp` | PPT 精细编辑 | `https://saas.docs.qq.com/api/v6/slide/mcp` |
| `doc-mcp` | Word 精细编辑 | `https://saas.docs.qq.com/api/v6/doc/mcp` |
| `sheet-mcp` | Excel 精细编辑 | `https://saas.docs.qq.com/api/v6/sheet/mcp` |

### 4.1 安装 mcporter

```bash
npm install -g mcporter@0.8.1
mcporter --version
```

### 4.2 注册服务（用同一个 Token）

```bash
# 将你的腾讯文档 Token 设为变量
TDOC_TOKEN="你的腾讯文档 Token"

# 注册四个服务
mcporter config add "tencent-saas-docs" "https://saas.docs.qq.com/api/v6/open/agent/mcp" \
    --header "Authorization=$TDOC_TOKEN" \
    --transport http \
    --scope home

mcporter config add "slide-mcp" "https://saas.docs.qq.com/api/v6/slide/mcp" \
    --header "Authorization=$TDOC_TOKEN" \
    --transport http \
    --scope home

mcporter config add "doc-mcp" "https://saas.docs.qq.com/api/v6/doc/mcp" \
    --header "Authorization=$TDOC_TOKEN" \
    --transport http \
    --scope home

mcporter config add "sheet-mcp" "https://saas.docs.qq.com/api/v6/sheet/mcp" \
    --header "Authorization=$TDOC_TOKEN" \
    --transport http \
    --scope home
```

### 4.3 验证服务注册

```bash
mcporter list
# 应显示 tencent-saas-docs, slide-mcp, doc-mcp, sheet-mcp 四个服务
```

---

## 5. 配置腾讯文档授权

腾讯文档 Token 通过 OAuth 2.0 获取。

### 5.1 一键授权（推荐）

本工作区提供了自动化脚本：

```bash
cd ~/.openclaw/workspace/skills/tencent-saas-docs

# 第一步：生成授权链接
bash ./setup.sh tdoc_check_and_start_auth
# → AUTH_REQUIRED:https://saas.docs.qq.com/scenario/open-claw.html?nlc=1&authType=1&code=...

# 在浏览器打开链接，用 QQ/微信 扫码授权

# 第二步：获取 Token
bash ./setup.sh tdoc_fetch_token
# → TOKEN_READY ✓
```

### 5.2 手动设置 Token

如果已有 Token（从 [腾讯文档开放平台](https://saas.docs.qq.com/scenario/open-claw.html?nlc=1) 直接获取）：

```bash
bash ./setup.sh tdoc_set_token "你的Token"
```

也可以直接调 mcporter：

```bash
mcporter config add "tencent-saas-docs" "https://saas.docs.qq.com/api/v6/open/agent/mcp" \
    --header "Authorization=你的Token" \
    --transport http \
    --scope home
```

### 5.3 验证授权

```bash
mcporter call "tencent-saas-docs" "manage.recent_online_file" --args '{"num":5}'
# 正常返回文件列表则授权成功
```

### 5.4 故障排查

| 错误码 | 原因 | 解决 |
|--------|------|------|
| `400006` | Token 鉴权失败 | 重新执行一键授权流程 |
| `400007` | 调用次数耗尽 | 升级腾讯文档专业版 |
| `400016` | 文档类型不匹配 | 确认操作的是正确类型的文档 |
| `AUTH_REQUIRED` | 未授权 | 打开授权链接扫码 |
| `expired` | Token 已过期 | 重新获取 Token |

---

## 6. 部署本工作区

```bash
# 克隆到 OpenClaw 工作区目录
git clone https://github.com/day18708433173-crypto/openclaw-workspace.git ~/.openclaw/workspace

# 或者如果已有 openclaw 配置，只需覆盖 workspace
cd ~/.openclaw/workspace
git init
git remote add origin https://github.com/day18708433173-crypto/openclaw-workspace.git
git pull origin master
```

### 工作区文件说明

| 文件 | 用途 |
|------|------|
| `AGENTS.md` | Agent 运行约定 |
| `SOUL.md` | Agent 角色定义（招聘助手） |
| `TOOLS.md` | 智能表字段映射和 mcporter 调用模板 |
| `MEMORY.md` | 跨会话持久记忆 |
| `USER.md` | 用户信息 |
| `IDENTITY.md` | Agent 身份定义 |
| `skills/BasicInformation/SKILL.md` | 简历解析录入 |
| `skills/recruitment-funnel/SKILL.md` | 招聘转化漏斗复盘 |
| `skills/recruitment-progress/SKILL.md` | 岗位招聘进度 |
| `skills/recruitment-channel/SKILL.md` | 渠道来源统计 |
| `skills/tencent-saas-docs/SKILL.md` | 腾讯文档操作指南 |
| `skills/tencent-saas-docs/setup.sh` | 腾讯文档 Token 配置脚本 |

---

## 7. 验证一切正常

### 7.1 整体健康检查

```bash
openclaw health
```

期望输出：

```
企业微信: configured
Gateway event loop: ok
Agents: main (default)
```

### 7.2 测试腾讯文档连接

```bash
mcporter call "tencent-saas-docs" "smartsheet.list_records" \
  file_id:PTfdpsNTAQbnqbRxOP sheet_id:BB08J2 limit:5
```

正常返回候选人的 JSON 数据。

### 7.3 测试企业微信消息

在企业微信里 @机器人 发送 `月度复盘`，应自动统计当月招聘漏斗数据。

### 7.4 查看已安装 Skill

```bash
openclaw sessions list
```

`skillsSnapshot` 中应包含 `BasicInfromation`、`recruitment-funnel`、`recruitment-progress`、`recruitment-channel`。

---

## 8. 日常使用

### 招聘数据录入

在企业微信里 @机器人 发送 PDF 简历 + 岗位 + 渠道信息：

```
@机器人 录入基本信息
[发送 PDF 简历文件]
岗位：产品经理  渠道：BOSS
```

### 数据复盘口令

| 你说 | 机器人做什么 |
|------|------------|
| `月度复盘` / `季度复盘` | 统计当前周期转化漏斗（初筛→一面→二面→OFFER） |
| `招聘进度` `产品经理3人 前端2人` | 按岗位统计目标 vs 已接受OFFER vs 流程中 |
| `渠道统计 2026年7月` | 按渠道（BOSS/猎聘/内推/校招）对比转化率 |
| `年度复盘` / `半年复盘` | 统计年度/半年度数据 |

### 管理命令

```bash
# 清空会话上下文（bot 变笨了用这个）
openclaw sessions compact "agent:main:wecom:group:你的群ID"

# 查看 token 用量
openclaw sessions list

# 重启 Gateway
openclaw gateway stop && openclaw gateway start
```

---

## 常见问题

**Q: bot 回复 "Exec failed: run node inline script"？**

A: 这是 OpenClaw 的 exec 沙箱默认策略。已在新版 Skill 中规避——改用 `mcporter call` 的 `key:value` 参数格式替代 JSON。如果仍有此问题，运行 `openclaw exec-policy preset yolo` 放宽限制。

**Q: 腾讯文档 Token 多久过期？**

A: 约 30 天。过期后重新执行 `bash ./setup.sh tdoc_check_and_start_auth` 即可。

**Q: 如何换模型？**

A: 编辑 `openclaw.json` → `agents.defaults.model.primary`，改为其他模型 ID 即可。DeepSeek V4 Pro（`deepseek/deepseek-v4-pro`）适合更复杂的分析任务但更贵。

**Q: 机器人收不到消息？**

A: 检查 Gateway 是否在运行（`openclaw health`），确认企业微信回调 URL 可达，查看日志 `openclaw gateway logs`。
