---
name: hc-stats
description: 岗位招聘进度与可视化。按岗位统计目标HC vs 已接受OFFER vs 流程中人数，先发文字分析再发进度图表。收到「招聘进度」「岗位进度」「HC进度」「HC完成度」「招到几个」「还有多少」等指令时使用。
---

# 岗位招聘进度（文字 + 图表）

收到进度查询 → 确认目标人数 → 拉全量数据 → 按岗位分组 → **分两条消息**输出（先文字，后图表）。

> 表配置（file_id / sheet_id / 字段映射）见 [TOOLS.md](../../TOOLS.md)。

---

## 触发词

`招聘进度` `岗位进度` `HC进度` `HC完成度` `招到几个` `还有多少` `进度`

---

## 流程

### Step 1：确认目标人数

从用户消息中提取目标人数，如「产品经理3人、前端2人」。

**如果用户没提供目标人数，追问：**

> 请提供各岗位的目标招聘人数，例如：产品经理 3人、前端开发 2人

如果用户没指定哪些岗位，列出**所有有候选人的岗位**，目标人数列标 `?`。

### Step 2：拉全量数据

**直接用 exec 执行下面这条命令拉数。不要写临时文件绕开 mcporter。**

```
mcporter call tencent-saas-docs "smartsheet.list_records" file_id:DUFRmZHBzTlRBUWJucWJSeE9Q sheet_id:BB08J2 limit:100
```

> ⚠️ 参数用 `key:value` 格式，不要用 `--args` + JSON。

若 `has_more` 为 true，继续翻页拉完。**不做时间筛选**，取全部记录。

### Step 3：按岗位分组

```
已接受OFFER = 应聘岗位匹配 且 OFFER是否接受 = "已接受"

流程中（尚未结束的候选人）：
  待一面     = 一面结果 = "待安排" 或 为空
  待二面     = 一面结果 = "通过" 且 二面结果 = "待安排" 或为空
  待接受OFFER = 二面结果 = "通过" 且 OFFER是否接受 = "待确认" 或为空

不统计（已结束但未录用）= 一面结果="未通过/取消" / 二面结果="未通过/取消" / OFFER="未接受"

差额 = max(目标 - 已接受OFFER, 0)
在途 = 待一面 + 待二面 + 待接受OFFER
```

目标人数未知（`?`）时，文字里差额写 `?`，图表 JSON 的 `target` / `gap` 填 `null`。

### Step 4：最终响应（严格模板）

#### 文本部分

只发一句结论正文，不夹带 `MEDIA:`；控制在 50 个汉字左右，不加“结论：”等标签，不加标题、emoji、换行、岗位明细或成组数字。

优先判断缺口最大的岗位及其在途人数能否覆盖缺口：储备不足时建议优先拓宽来源；储备足够但集中在早期阶段时建议加快面试安排；全部达标时建议维持候选人备选池。目标人数未知时，不判断缺口，提醒先补齐 HC 目标。

示例：

```
前端开发缺口最大且候选人储备不足，建议优先拓宽渠道并加快首轮面试。
```

目标均未知时输出：`当前缺少岗位HC目标，建议先补齐目标人数再判断招聘优先级。`

#### 图片部分

1. 将 Step 3 结果写成 JSON，调用图表脚本：

```bash
node skills/hc-stats/scripts/render-charts.js --out media/hc-stats.png --cleanup-after-seconds 300
```

JSON 从 stdin 传入，格式：

```json
{
  "title": "岗位招聘进度",
  "jobs": [
    {
      "name": "产品经理",
      "target": 3,
      "accepted": 2,
      "gap": 1,
      "waitingR1": 2,
      "waitingR2": 1,
      "waitingOffer": 1
    },
    {
      "name": "前端开发",
      "target": 2,
      "accepted": 0,
      "gap": 2,
      "waitingR1": 1,
      "waitingR2": 0,
      "waitingOffer": 0
    }
  ]
}
```

> 中文标题写进 JSON 的 `title`。`target` / `gap` 未知时填 `null`。

Windows 示例（用 `--json-file` 直接读取 UTF-8，避免 PowerShell 管道改写中文）：

```powershell
$jsonPath = "$env:TEMP\hc-stats.json"
[System.IO.File]::WriteAllText($jsonPath, '{"title":"岗位招聘进度","jobs":[{"name":"产品经理","target":3,"accepted":2,"gap":1,"waitingR1":2,"waitingR2":1,"waitingOffer":1},{"name":"前端开发","target":2,"accepted":0,"gap":2,"waitingR1":1,"waitingR2":0,"waitingOffer":0}]}', [System.Text.UTF8Encoding]::new($false))
node skills/hc-stats/scripts/render-charts.js --json-file $jsonPath --out media/hc-stats.png --cleanup-after-seconds 300
```

2. 确认 PNG 已生成且大小 > 0。
3. **单独再发一条消息**（勿与文字统计合并），用 `MEDIA:` 发出图片：

```
MEDIA: C:\Users\Administrator\.openclaw\workspace\media\hc-stats.png
```

路径必须是**绝对路径**。`MEDIA:` 语法见 `wecom-send-media` skill。

最终响应只能由“一句结论正文 + 一行 `MEDIA:`”组成；发送层会自动拆分文字和图片。不要描述发送动作，不要输出任何前言或收尾。

4. 清理由图表脚本的 `--cleanup-after-seconds 300` 自动完成；禁止再执行 PowerShell、内联 Node 或其他清理命令。

图表含两块：左侧「目标 vs 已接受」分组柱 + 右侧「在途构成」堆叠条。

---

## 铁律

- **严格响应结构** — 最终响应只含一句结论正文和一行 `MEDIA:`，除此之外不得有任何文本
- **可见文本仅一句** — 只输出结论正文；禁止“结论：”“消息1/2”“图表已发出”“核心数据一览”、明细、完成说明或执行过程
- **图片消息无文案** — 第二条只保留 `MEDIA:` 指令，不添加“HC进度图”等标题
- **拉数只用 mcporter** — Step 2 参数用 `key:value`；失败则原样报错，不要用脚本绕开拉数
- **出图只用本 skill 脚本** — `scripts/render-charts.js`，不要临时另写绘图脚本
- **发图后必须清理** — 绘图时传 `--cleanup-after-seconds 300`；不得另起清理命令
- **缺目标就追问** — 没提供目标人数时不猜测（可先列岗位标 `?`）
- **只读不写** — 只查智能表
- **全量拉取** — 不做时间筛选，取全部记录
