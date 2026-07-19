---
name: channel-stats
description: 候选人渠道统计与可视化。按渠道(BOSS/猎聘/内推/校招)统计投递量与转化率，先发文字分析再发图表。收到「渠道统计」「渠道分析」「来源统计」「渠道对比」「渠道效果」等指令时使用。
---

# 渠道统计（文字 + 图表）

收到渠道统计指令 → 确认周期 → 拉数据 → 按渠道分组 → **分两条消息**输出（先文字，后图表）。

> 表配置（file_id / sheet_id / 字段映射）见 [TOOLS.md](../../TOOLS.md)。

---

## 触发词

`渠道统计` `渠道分析` `来源统计` `渠道对比` `渠道效果` `哪个渠道`

---

## 流程

### Step 1：确认统计周期

从用户消息中提取周期（如「7月」「Q1」「上半年」「2026年」或「7月3日至7月18日」）。支持任意起止日期和跨月、跨年区间；按用户给出的起止日期闭区间统计，并在标题中写明准确日期范围。

若结束日期早于开始日期，先请用户更正，不执行统计。用户已给出明确起止日期时，不要强制改成整月、整季或整年。

**如果用户没指定周期，追问：**

> 请指定统计周期，例如：渠道统计 本月 / Q1 / 上半年

周期边界：月度=当月1日~月末，季度=当季首月1日~季末，年度=1/1~12/31。时间比较用毫秒时间戳。

### Step 2：拉全量数据

**直接用 exec 执行下面这条命令拉数。不要写临时文件绕开 mcporter。**

```
mcporter call tencent-saas-docs "smartsheet.list_records" file_id:DUFRmZHBzTlRBUWJucWJSeE9Q sheet_id:BB08J2 limit:100
```

> ⚠️ 参数用 `key:value` 格式，不要用 `--args` + JSON。

若 `has_more` 为 true，继续翻页拉完。按 `创建时间` 筛选周期内记录。

### Step 3：按渠道分组

渠道枚举：`BOSS` `猎聘` `内推` `校招`；为空或不在枚举内归为 `未知`。

每个渠道统计：

```
投递人数    = 该渠道记录数
一面通过    = 一面结果 = "通过"
二面通过    = 二面结果 = "通过"
OFFER接受   = OFFER是否接受 = "已接受"
一面转化率  = 一面通过 / 投递人数 × 100%
总转化率    = OFFER接受 / 投递人数 × 100%
```

分母为 0 时百分比显示 `—`。百分比保留一位小数。

### Step 4：最终响应（严格模板）

#### 文本部分

只发一句结论正文，不夹带 `MEDIA:`；控制在 50 个汉字左右，不加“结论：”等标签，不加标题、emoji、换行、渠道明细或成组数字。

综合 OFFER 接受人数、总转化率和投递量判断渠道表现；投递少于 3 人时标记为样本不足，不因偶然的高转化率直接建议加大投入。

示例：

```
BOSS渠道量效领先，建议优先加大投放，并复盘内推和校招的低转化环节。
```

无数据时输出：`该周期暂无有效渠道数据，建议先完善候选人来源记录。`

#### 图片部分

1. 将 Step 3 结果写成 JSON，调用图表脚本：

```bash
node skills/channel-stats/scripts/render-charts.js --title "渠道来源统计 — 2026年7月" --out media/channel-stats.png --cleanup-after-seconds 300
```

JSON 从 stdin 传入，格式：

```json
{
  "title": "渠道来源统计 — 2026年7月",
  "channels": [
    {"name": "BOSS", "applied": 12, "r1Pass": 8, "r2Pass": 5, "offer": 3},
    {"name": "猎聘", "applied": 6, "r1Pass": 5, "r2Pass": 3, "offer": 2}
  ]
}
```

> 中文标题请写进 JSON 的 `title` 字段（脚本会自动补 `subtitle` / `leftTitle` / `rightTitle`）。
> 周期内没有记录时传入 `"channels": []`，图中会显示「该周期暂无数据」，不要伪造 `N/A` 渠道。

Windows 示例（用 `--json-file` 直接读取 UTF-8，避免 PowerShell 管道改写中文）：

```powershell
$jsonPath = "$env:TEMP\channel-stats.json"
[System.IO.File]::WriteAllText($jsonPath, '{"title":"渠道来源统计 — 2026年7月","channels":[{"name":"BOSS","applied":12,"r1Pass":8,"r2Pass":5,"offer":3},{"name":"猎聘","applied":6,"r1Pass":5,"r2Pass":3,"offer":2}]}', [System.Text.UTF8Encoding]::new($false))
node skills/channel-stats/scripts/render-charts.js --json-file $jsonPath --out media/channel-stats.png --cleanup-after-seconds 300
```

2. 确认 PNG 已生成且大小 > 0。
3. **单独再发一条消息**（勿与文字统计合并），用 `MEDIA:` 发出图片：

```
MEDIA: C:\Users\Administrator\.openclaw\workspace\media\channel-stats.png
```

路径必须是**绝对路径**。`MEDIA:` 语法见 `wecom-send-media` skill。

最终响应只能由“一句结论正文 + 一行 `MEDIA:`”组成；发送层会自动拆分文字和图片。不要描述发送动作，不要输出任何前言或收尾。

4. 清理由图表脚本的 `--cleanup-after-seconds 300` 自动完成；禁止再执行 PowerShell、内联 Node 或其他清理命令。

图表含两块：投递人数柱状图 + OFFER 转化率柱状图。

---

## 铁律

- **严格响应结构** — 最终响应只含一句结论正文和一行 `MEDIA:`，除此之外不得有任何文本
- **可见文本仅一句** — 只输出结论正文；禁止“结论：”“消息1/2”“图表已发出”“核心数据一览”、明细、完成说明或执行过程
- **图片消息无文案** — 第二条只保留 `MEDIA:` 指令，不添加“渠道对比图”等标题
- **拉数只用 mcporter** — Step 2 参数用 `key:value`；失败则原样报错，不要用脚本绕开拉数
- **出图只用本 skill 脚本** — `scripts/render-charts.js`，不要临时另写绘图脚本
- **发图后必须清理** — 绘图时传 `--cleanup-after-seconds 300`；不得另起清理命令
- **缺周期就追问** — 没指定时间段时不猜测
- **只读不写** — 只查智能表
- **渠道为空记「未知」**
