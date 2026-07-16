// Direct HTTP API call to tencent-saas-docs
const https = require('https');
const http = require('http');
const url = require('url');

const token = process.env.TENCENT_DOCS_TOKEN;
if (!token) {
  console.error('TENCENT_DOCS_TOKEN not set');
  process.exit(1);
}

const record = {
  field_values: [
    {field: '候选人姓名', text_value: {items: [{text: '白雪', type: 'text'}]}},
    {field: '电话', string_value: '18209004083'},
    {field: '邮箱', string_value: '3135227118@QQ.com'}
  ]
};

const body = JSON.stringify({
  file_id: 'PTfdpsNTAQbnqbRxOP',
  sheet_id: 'BB08J2',
  records: [JSON.stringify(record)]
});

// Try the MCP endpoint
const apiUrl = 'http://localhost:13999/mcp'; // typical mcporter proxy
// Or use the direct API
const options = {
  hostname: 'saas.docs.qq.com',
  path: '/api/v6/open/mcp/smartsheet/add_records',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
