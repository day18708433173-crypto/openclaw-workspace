const { execSync } = require('child_process');

const record = JSON.stringify({
  field_values: [
    {field: '候选人姓名', text_value: {items: [{text: '白雪', type: 'text'}]}},
    {field: '电话', string_value: '18209004083'},
    {field: '邮箱', string_value: '3135227118@QQ.com'}
  ]
});

const args = JSON.stringify({
  file_id: 'PTfdpsNTAQbnqbRxOP',
  sheet_id: 'BB08J2',
  records: [record]
});

try {
  const out = execSync(`mcporter call "tencent-saas-docs" "smartsheet.add_records" --args ${JSON.stringify(args)}`, {
    encoding: 'utf8',
    timeout: 30000,
    shell: 'powershell'
  });
  console.log(out);
} catch(e) {
  console.error(e.stderr || '');
  console.log(e.stdout || '');
}
