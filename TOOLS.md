# TOOLS.md — 招聘助手业务配置

## 招聘智能表

| 属性 | 值 |
|------|-----|
| 文档名 | 招聘表格 |
| URL | https://saas.docs.qq.com/smartsheet/DUFRmZHBzTlRBUWJucWJSeE9Q |
| file_id | `PTfdpsNTAQbnqbRxOP` |
| sheet_id | `BB08J2` |
| 所有者 | 听雨 |

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
| `fLcCeK` | 一面结果 | singleSelect | 可选，枚举：待安排/未通过/通过/取消 |
| `frdYrS` | 二面时间 | dateTime | 可选，格式同上面 |
| `fhuQVX` | 二面面试官 | text | 可选 |
| `fIDFz7` | 二面评价 | text | 可选 |
| `fYT8aR` | 二面结果 | singleSelect | 可选，枚举：待安排/未通过/通过/取消 |
| `fW0nTJ` | OFFER是否发放 | singleSelect | 可选，枚举：无需发放/暂未发放/已经发放 |
| `fzlnrN` | OFFER是否接受 | singleSelect | 可选，枚举：待确认/已接受/未接受 |
| `fAAuPt` | 最后更新时间 | dateTime | **Agent 每次写入/更新时必须同步更新**，格式同上面 |
| `fQqtac` | 创建时间 | dateTime | **系统自动填充，Agent 不得手动写入** |

### 写入权限与禁写规则

- **允许写入**：所有字段（除创建时间）
- **禁止覆盖**：创建时间（`fQqtac`）由系统自动填充，不可手动写入
- **每次更新必须同步**：最后更新时间（`fAAuPt`）设为当前毫秒时间戳
- **候选人姓名 + 应聘岗位** 作为查重组合键（同名不同岗 = 不同候选流程）

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
mcporter call "tencent-saas-docs" "smartsheet.list_records" \
  --args '{"file_id":"PTfdpsNTAQbnqbRxOP","sheet_id":"BB08J2","limit":100}'

# 加记录
mcporter call "tencent-saas-docs" "smartsheet.add_records" \
  --args '{"file_id":"PTfdpsNTAQbnqbRxOP","sheet_id":"BB08J2","records":[...]}'

# 更新记录
mcporter call "tencent-saas-docs" "smartsheet.update_records" \
  --args '{"file_id":"PTfdpsNTAQbnqbRxOP","sheet_id":"BB08J2","records":[...]}'
```

---

## 规则：简历临时文件清理

- 从聊天中下载的简历 PDF 等临时文件，处理完信息后**必须立即删除**，不得留存在 inbound 目录中

## Set Up Notes

- tencent-saas-docs skill installed, 198 tools available
- Token configured via env `TENCENT_DOCS_TOKEN`
- mcporter services: tencent-saas-docs, slide-mcp, doc-mcp, sheet-mcp
