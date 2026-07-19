---
name: funnel-stats
description: 招聘转化漏斗复盘与可视化。统计初筛→一面→二面→OFFER 各阶段人数与通过率，先发文字分析再发漏斗图表。收到「招聘复盘」「月度复盘」「季度复盘」「转化漏斗」「招聘漏斗」「通过率」等指令时使用。
---

# 招聘漏斗（文字 + 图表）

收到复盘指令 → 确定周期 → 拉数据 → 算指标 → **分两条消息**输出（先文字，后图表）。

> 表配置（file_id / sheet_id / 字段映射）见 [TOOLS.md](../../TOOLS.md)。

---

## 触发词

`招聘复盘` `月度复盘` `季度复盘` `半年复盘` `年度复盘` `转化漏斗` `招聘漏斗` `通过率` `复盘`

---

## 流程

### Step 1：确定周期

| 用户说 | 时间范围 |
|--------|---------|
| 月度复盘 / 本月 | 当前月 1 日 ~ 月末 |
| 季度复盘 / 本季度 | 当前季度首月 1 日 ~ 季末 |
| 半年复盘 / 上半年 | 1/1~6/30 或 7/1~12/31 |
| 年度复盘 / 今年 | 1/1 ~ 12/31 |

用户指定了具体时间（如「5月」「Q1」「去年」或「7月3日至7月18日」）则以用户为准。支持任意起止日期和跨月、跨年区间；按用户给出的起止日期闭区间统计，并在标题中写明准确日期范围。时间比较用毫秒时间戳。

若结束日期早于开始日期，先请用户更正，不执行统计。用户已给出明确起止日期时，不要强制改成整月、整季或整年。

**如果用户没说周期，追问：**

> 要复盘哪个周期？月度 / 季度 / 半年度 / 年度？

### Step 2：拉全量数据

**直接用 exec 执行下面这条命令拉数。不要写临时文件绕开 mcporter。**

```
mcporter call tencent-saas-docs "smartsheet.list_records" file_id:DUFRmZHBzTlRBUWJucWJSeE9Q sheet_id:BB08J2 limit:100
```

> ⚠️ 参数用 `key:value` 格式，不要用 `--args` + JSON。

若 `has_more` 为 true，继续翻页拉完。按 `创建时间`（string_value，毫秒时间戳字符串）筛选周期内记录。

### Step 3：筛选 & 计算

```
初筛通过人数 = 周期内记录总数（录入即初筛通过）
一面通过人数 = 一面结果 = "通过" 的记录数
二面通过人数 = 二面结果 = "通过" 的记录数
OFFER接受人数 = OFFER是否接受 = "已接受" 的记录数

一面通过率   = 一面通过人数 / 初筛通过人数 × 100%
二面通过率   = 二面通过人数 / 一面通过人数 × 100%
OFFER接受率  = OFFER接受人数 / 二面通过人数 × 100%
总通过率     = OFFER接受人数 / 初筛通过人数 × 100%
```

分母为 0 时显示 `—`。百分比保留一位小数（如 `72.0%`）。

### Step 4：最终响应（严格模板）

#### 文本部分

只发一句结论正文，不夹带 `MEDIA:`；控制在 50 个汉字左右，不加“结论：”等标签，不加标题、emoji、换行、阶段明细或成组数字。

找出相邻阶段流失人数最多的环节，并给出对应招聘动作：初筛→一面侧重校准画像与筛选标准；一面→二面侧重统一面试标准和面试官判断；二面→OFFER侧重提升决策效率、OFFER竞争力和候选人跟进。

示例：

```
一面至二面流失最明显，建议统一面试标准并复盘候选人与岗位的匹配度。
```

无数据时输出：`该周期暂无有效漏斗数据，建议先确保招聘流程节点完整记录。`

#### 图片部分

1. 将 Step 3 结果写成 JSON，调用图表脚本：

```bash
node skills/funnel-stats/scripts/render-charts.js --out media/funnel-stats.png --cleanup-after-seconds 300
```

JSON 从 stdin 传入，格式：

```json
{
  "title": "招聘转化复盘 — 2026年7月",
  "stages": [
    {"name": "初筛通过", "count": 25},
    {"name": "一面通过", "count": 18},
    {"name": "二面通过", "count": 10},
    {"name": "OFFER接受", "count": 6}
  ],
  "rates": [
    {"name": "一面通过率", "rate": 72.0},
    {"name": "二面通过率", "rate": 55.6},
    {"name": "OFFER接受率", "rate": 60.0},
    {"name": "总通过率", "rate": 24.0}
  ]
}
```

> 中文标题请写进 JSON 的 `title` 字段。`rate` 为数值（无 `%` 符号）；分母为 0 时该 rate 填 `null`，图上显示 `—`。
> 周期内完全没有记录时，各阶段 `count` 填 `0`、各 `rate` 填 `null`，图中会显示「该周期暂无数据」和「暂无可计算转化率」。

Windows 示例（用 `--json-file` 直接读取 UTF-8，避免 PowerShell 管道改写中文）：

```powershell
$jsonPath = "$env:TEMP\funnel-stats.json"
[System.IO.File]::WriteAllText($jsonPath, '{"title":"招聘转化复盘 — 2026年7月","stages":[{"name":"初筛通过","count":25},{"name":"一面通过","count":18},{"name":"二面通过","count":10},{"name":"OFFER接受","count":6}],"rates":[{"name":"一面通过率","rate":72.0},{"name":"二面通过率","rate":55.6},{"name":"OFFER接受率","rate":60.0},{"name":"总通过率","rate":24.0}]}', [System.Text.UTF8Encoding]::new($false))
node skills/funnel-stats/scripts/render-charts.js --json-file $jsonPath --out media/funnel-stats.png --cleanup-after-seconds 300
```

2. 确认 PNG 已生成且大小 > 0。
3. **单独再发一条消息**（勿与文字统计合并），用 `MEDIA:` 发出图片：

```
MEDIA: C:\Users\Administrator\.openclaw\workspace\media\funnel-stats.png
```

路径必须是**绝对路径**。`MEDIA:` 语法见 `wecom-send-media` skill。

最终响应只能由“一句结论正文 + 一行 `MEDIA:`”组成；发送层会自动拆分文字和图片。不要描述发送动作，不要输出任何前言或收尾。

4. 清理由图表脚本的 `--cleanup-after-seconds 300` 自动完成；禁止再执行 PowerShell、内联 Node 或其他清理命令。

图表含两块：左侧漏斗人数条 + 右侧阶段通过率柱状图。

---

## 铁律

- **严格响应结构** — 最终响应只含一句结论正文和一行 `MEDIA:`，除此之外不得有任何文本
- **可见文本仅一句** — 只输出结论正文；禁止“结论：”“消息1/2”“图表已发出”“核心数据一览”、明细、完成说明或执行过程
- **图片消息无文案** — 第二条只保留 `MEDIA:` 指令，不添加“招聘漏斗图”等标题
- **拉数只用 mcporter** — Step 2 参数用 `key:value`；失败则原样报错，不要用脚本绕开拉数
- **出图只用本 skill 脚本** — `scripts/render-charts.js`，不要临时另写绘图脚本
- **发图后必须清理** — 绘图时传 `--cleanup-after-seconds 300`；不得另起清理命令
- **缺周期就追问** — 没指定时间段时不猜测
- **只读不写** — 只查智能表
- **全量拉取、内存过滤** — 拉完所有记录后在思考中计算
