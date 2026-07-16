#!/bin/bash
#
# 腾讯文档 MCP 文件导入辅助脚本
#
# 功能：
#   完成文件导入的前两步操作：
#   1. 计算文件的 MD5 和大小
#   2. 调用 manage.apply_upload 获取 COS 上传链接和 obj_key 和 task_id
#   3. 使用 curl 将文件 PUT 上传到 COS
#   4. 输出 obj_key、file_name、file_md5、file_size、task_id 供后续调用 manage.complete_upload
#
# 用法：
#   bash import_file.sh <file_path>
#
# 依赖：
#   - mcporter（已配置 tencent-saas-docs 服务）
#   - curl
#   - md5sum 或 md5（macOS）
#
# 输出（成功时）：
#   IMPORT_READY
#   FILE_KEY:<file_key>
#   FILE_NAME:<file_name>
#   FILE_MD5:<file_md5>
#
# 输出（失败时）：
#   ERROR:<error_message>
#

set -euo pipefail

# ── 参数校验 ──────────────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
    echo "ERROR:missing_argument - 用法: bash import_file.sh <file_path>"
    exit 1
fi

FILE_PATH="$1"

if [[ ! -f "$FILE_PATH" ]]; then
    echo "ERROR:file_not_found - 文件不存在: $FILE_PATH"
    exit 1
fi

# ── 提取文件名（格式支持性由后端 manage.apply_upload 判定）────────────────────
_BASENAME=$(basename "$FILE_PATH")
FILE_NAME="${_BASENAME%.*}"
FILE_EXT="${_BASENAME##*.}"

# ── 计算文件大小 ──────────────────────────────────────────────────────────────
if [[ "$(uname)" == "Darwin" ]]; then
    FILE_SIZE=$(stat -f%z "$FILE_PATH")
else
    FILE_SIZE=$(stat -c%s "$FILE_PATH")
fi

if [[ "$FILE_SIZE" -le 0 ]]; then
    echo "ERROR:empty_file - 文件为空: $FILE_PATH"
    exit 1
fi

# ── 计算文件 MD5 ─────────────────────────────────────────────────────────────
if command -v md5sum &>/dev/null; then
    FILE_MD5=$(md5sum "$FILE_PATH" | awk '{print $1}')
elif command -v md5 &>/dev/null; then
    FILE_MD5=$(md5 -q "$FILE_PATH")
else
    echo "ERROR:no_md5_tool - 未找到 md5sum 或 md5 命令"
    exit 1
fi

echo "📄 文件名: $FILE_NAME"
echo "📄 文件后缀: $FILE_EXT"
echo "📏 大小: $FILE_SIZE bytes"
echo "🔑 MD5:  $FILE_MD5"
echo ""

# ── Step 1: 调用 manage.apply_upload 获取 COS 上传链接 ─────────────────────────
echo "⏳ 正在获取上传链接..."

APPLY_UPLOAD_ARGS=$(cat <<EOF
{"name": "$FILE_NAME", "ext": "$FILE_EXT", "file_size": $FILE_SIZE, "md5": "$FILE_MD5"}
EOF
)

APPLY_UPLOAD_RESULT=$(mcporter call "tencent-saas-docs" "manage.apply_upload" --args "$APPLY_UPLOAD_ARGS" 2>&1) || {
    echo "ERROR:apply_upload_failed - manage.apply_upload 调用失败: $APPLY_UPLOAD_RESULT"
    exit 1
}

# 解析返回的 upload_url 和 obj_key
UPLOAD_URL=$(echo "$APPLY_UPLOAD_RESULT" | jq -r '.upload_url // empty' 2>/dev/null || echo "")
OBJ_KEY=$(echo "$APPLY_UPLOAD_RESULT" | jq -r '.obj_key // empty' 2>/dev/null || echo "")
TASK_ID=$(echo "$APPLY_UPLOAD_RESULT" | jq -r '.task_id // empty' 2>/dev/null || echo "")

if [[ -z "$UPLOAD_URL" ]]; then
    echo "ERROR:no_upload_url - 未获取到上传链接，apply_upload 返回: $APPLY_UPLOAD_RESULT"
    exit 1
fi

if [[ -z "$OBJ_KEY" ]]; then
    echo "ERROR:no_obj_key - 未获取到 obj_key，apply_upload 返回: $APPLY_UPLOAD_RESULT"
    exit 1
fi

echo "✅ 获取上传链接成功"
echo ""

# ── Step 2: 使用 curl PUT 上传文件到 COS ─────────────────────────────────────
echo "⏳ 正在上传文件到 COS..."

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@$FILE_PATH" \
    "$UPLOAD_URL") || {
    echo "ERROR:upload_failed - curl 上传文件失败"
    exit 1
}

if [[ "$HTTP_STATUS" -ge 200 && "$HTTP_STATUS" -lt 300 ]]; then
    echo "✅ 文件上传成功 (HTTP $HTTP_STATUS)"
else
    echo "ERROR:upload_http_error - COS 上传返回 HTTP $HTTP_STATUS"
    exit 1
fi

echo ""

# ── 输出结果 ──────────────────────────────────────────────────────────────────
echo "IMPORT_READY"
echo "OBJ_KEY:$OBJ_KEY"
echo "FILE_NAME:$FILE_NAME"
echo "FILE_EXT:$FILE_EXT"
echo "FILE_MD5:$FILE_MD5"
echo "TASK_ID:$TASK_ID"
echo "FILE_SIZE:$FILE_SIZE"
echo ""
echo "📋 下一步：调用 manage.complete_upload 触发导入"
echo "   mcporter call \"tencent-saas-docs\" \"manage.complete_upload\" --args '{\"task_id\": \"$TASK_ID\", \"file_size\": \"$FILE_SIZE\", \"obj_key\": \"$OBJ_KEY\", \"name\": \"$FILE_NAME\", \"ext\": \"$FILE_EXT\", \"md5\": \"$FILE_MD5\"}'"
