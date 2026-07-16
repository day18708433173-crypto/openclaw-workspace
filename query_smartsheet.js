// Script to query Tencent Docs smart table
const { execSync } = require('child_process');

function mcporter(service, method, args) {
  const input = JSON.stringify(args);
  const cmd = `mcporter call "${service}" "${method}" --args '${input}'`;
  try {
    const out = execSync(cmd, { encoding: 'utf-8', shell: 'cmd.exe' });
    return out;
  } catch (e) {
    return { error: e.message, stderr: e.stderr?.toString() };
  }
}

// Step 1: Search for the file
const searchResult = mcporter('tencent-saas-docs', 'manage.search_file', {
  pattern: '招聘候选人主表',
  sort_rules: {},
  tag_info: {}
});
console.log('=== SEARCH RESULT ===');
console.log(searchResult);
