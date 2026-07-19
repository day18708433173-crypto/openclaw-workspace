# TOOLS.md — 本地配置与业务速查

Skills 定义 _怎么用工具_；本文件放 _你这套环境特有的配置_。

---

## 招聘智能表

| 属性 | 值 |
|------|-----|
| 文档名 | 招聘表格 |
| URL | https://saas.docs.qq.com/smartsheet/DUFRmZHBzTlRBUWJucWJSeE9Q?tab=BB08J2&viewId=vUQPXH |
| MCP service | `tencent-saas-docs` |
| file_id | `DUFRmZHBzTlRBUWJucWJSeE9Q` |
| sheet_id | `BB08J2` |
| view_id | `vUQPXH` |
| 所有者 | 吹泡泡° ᐝ |

### 字段映射（field_id → 字段名 → 类型）

| field_id | 字段名 | 类型 | 写入规则 |
|----------|--------|------|----------|
| `fTxDpU` | 候选人姓名 | text | **必填**，用于查重匹配 |
| `fuSx02` | 应聘岗位 | text | **必填** |
| `fHYWeN` | 渠道 | singleSelect | 可选，枚举：BOSS/猎聘/内推/校招 |
| `f7TNED` | 电话 | phoneNumber | 可选 |
| `f68CTP` | 邮箱 | email | 可选 |
| `fiAYNL` | 一面时间 | dateTime | 可选，格式 `yyyy-mm-dd hh:mm`，值用毫秒时间戳字符串 |
| `fENKNa` | 一面面试官 | text | 可选 |
| `fzEGBd` | 一面评价 | text | 可选 |
| `fLcCeK` | 一面结果 | singleSelect | 可选，枚举：未通过/通过/取消 |
| `frdYrS` | 二面时间 | dateTime | 可选，格式同上面 |
| `fhuQVX` | 二面面试官 | text | 可选 |
| `fIDFz7` | 二面评价 | text | 可选 |
| `fYT8aR` | 二面结果 | singleSelect | 可选，枚举：未通过/通过/取消 |
| `fzlnrN` | OFFER是否接受 | singleSelect | 可选，枚举：待确认/已接受/未接受 |
| `fAAuPt` | 最后更新时间 | dateTime | **Agent 每次写入/更新时必须同步更新**，格式同上面 |
| `fQqtac` | 创建时间 | dateTime | **系统自动填充，Agent 不得手动写入** |

### 写入权限与禁写规则

- **允许写入**：所有字段（除创建时间）
- **禁止覆盖**：创建时间（`fQqtac`）由系统自动填充，不可手动写入
- **每次更新必须同步**：最后更新时间（`fAAuPt`）设为当前毫秒时间戳
- **候选人姓名 + 应聘岗位** 作为查重/定位组合键（同名不同岗 = 不同候选流程）

### 口语更新铁律（流程中改表）

中间进度更新**不必单独 skill**：听懂口语后，用 `tencent-saas-docs` / `smartsheet.*` 直接改表。

1. **先定位再写** — `list_records`，用「候选人姓名 + 应聘岗位」找到记录；缺其一就追问
2. **只改提到的字段** — 用户没说的评价/时间/结果不要清空或瞎填
3. **单选只写枚举** — 一面/二面结果：未通过|通过|取消；OFFER：待确认|已接受|未接受；渠道：BOSS|猎聘|内推|校招
4. **时间用毫秒时间戳字符串** — 「明天下午3点」先换算再写入对应 `*时间` 字段
5. **每次 `update_records` / `add_records` 必须带上**「最后更新时间」= 当前毫秒时间戳
6. **禁止写「创建时间」**
7. **回执格式** — `✅ 已更新：张三 — 产品经理｜一面结果=通过`

#### 口语 → 字段对照（示例）

| 用户说 | 写入字段 |
|--------|----------|
| 张三一面过了 / 一面通过 | 一面结果=通过 |
| 张三一面挂了 | 一面结果=未通过 |
| 一面评价：沟通不错，技术一般 | 一面评价 |
| 约二面… / 二面通过 / 二面评价… | 对应二面* 字段 |
| Offer 已发待确认 / 接受了 / 拒了 | OFFER是否接受=待确认/已接受/未接受 |

### 记录值格式速查

```
文本:      {"field":"候选人姓名","text_value":{"items":[{"text":"张三","type":"text"}]}}
单选:      {"field":"渠道","option_value":{"items":[{"text":"BOSS"}]}}
日期时间:   {"field":"一面时间","string_value":"1784029896594"}  (毫秒时间戳字符串)
电话:      {"field":"电话","string_value":"13800138000"}
邮箱:      {"field":"邮箱","string_value":"user@example.com"}
```

### mcporter 调用模板

```bash
# 查记录
mcporter call tencent-saas-docs "smartsheet.list_records" \
  file_id=DUFRmZHBzTlRBUWJucWJSeE9Q sheet_id=BB08J2 limit:100

# 加记录
mcporter call tencent-saas-docs "smartsheet.add_records" \
  file_id=DUFRmZHBzTlRBUWJucWJSeE9Q sheet_id=BB08J2 records:[...]

# 更新记录
mcporter call tencent-saas-docs "smartsheet.update_records" \
  file_id=DUFRmZHBzTlRBUWJucWJSeE9Q sheet_id=BB08J2 records:[...]
```

### 环境备注

- `tencent-docs` skill 已安装于 `skills/tencent-docs`
- Token：环境变量 `TENCENT_DOCS_TOKEN`
- 招聘智能表使用企业文档服务 `tencent-saas-docs`；个人文档服务 `tencent-docs` 不适用于该链接
- mcporter services：tencent-saas-docs、tencent-docs、slide-mcp、doc-mcp、sheet-mcp
