const { execSync } = require('child_process');

// Build the args as a JSON object
const args = {
  file_id: 'PTfdpsNTAQbnqbRxOP',
  sheet_id: 'BB08J2',
  records: []
};

// Create the record
const record = {
  field_values: [
    {field: '候选人姓名', text_value: {items: [{text: '白雪', type: 'text'}]}},
    {field: '电话', string_value: '18209004083'},
    {field: '邮箱', string_value: '3135227118@QQ.com'}
  ]
};

// Stringify the record and push it as a JSON string
args.records.push(JSON.stringify(record));

// Write args to temp file
const fs = require('fs');
const tmpFile = process.env.TEMP + '\\td_args_' + Date.now() + '.json';
fs.writeFileSync(tmpFile, JSON.stringify(args), 'utf8');

try {
  // Read back and pass to mcporter
  const data = fs.readFileSync(tmpFile, 'utf8');
  const result = execSync(
    `mcporter call "tencent-saas-docs" "smartsheet.add_records" --args '${data.replace(/'/g, "''")}'`,
    { encoding: 'utf8', timeout: 30000, shell: 'powershell' }
  );
  console.log(result);
} catch(e) {
  console.log('STDOUT:', e.stdout || '');
  console.log('STDERR:', e.stderr || '');
} finally {
  try { fs.unlinkSync(tmpFile); } catch(e) {}
}
