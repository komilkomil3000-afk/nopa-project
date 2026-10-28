const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getCommandOutput(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function resolveUserIdentity() {
  const userName = getCommandOutput('git config user.name');
  const userEmail = getCommandOutput('git config user.email');
  const remoteUrl = getCommandOutput('git remote get-url origin');
  const systemUser = process.env.USERNAME || process.env.USER || getCommandOutput('whoami') || 'unknown';

  let githubUser = '';
  if (remoteUrl) {
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\//);
    if (match && match[1]) {
      githubUser = match[1];
    }
  }

  const parts = [];
  if (githubUser) {
    parts.push(`GitHub: ${githubUser}`);
  }
  if (userName && !userName.toLowerCase().includes('your name') && !userName.toLowerCase().includes('example')) {
    parts.push(`Git: ${userName}${userEmail ? ` <${userEmail}>` : ''}`);
  }
  if (systemUser) {
    parts.push(`System: ${systemUser}`);
  }

  return parts.length > 0 ? parts.join(' | ') : `System: ${systemUser}`;
}

function getNowFormatted() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function appendChangelog({
  agentRole = 'Autonomous AI Agent',
  components = 'app | admin_panel',
  files = [],
  description = [],
  verification = 'Checks completed',
  status = 'Completed'
}) {
  const changelogPath = path.resolve(__dirname, '..', 'AGENT_CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    console.error(`Error: ${changelogPath} not found.`);
    process.exit(1);
  }

  const identity = resolveUserIdentity();
  const timestamp = getNowFormatted();

  const fileLines = files.length > 0
    ? files.map(f => `  - \`${f.path}\`${f.action ? ` (${f.action})` : ''}`).join('\n')
    : '  - None recorded';

  const descLines = description.length > 0
    ? description.map(d => `  - ${d}`).join('\n')
    : '  - Routine updates and fixes';

  const entry = `
### [${timestamp}] - ${agentRole}
- **Triggered By:** ${identity}
- **Target Component(s):** ${components}
- **Files Modified / Created / Deleted:**
${fileLines}
- **Description of Changes:**
${descLines}
- **Verification / Checkpoints Executed:**
  - ${verification}
- **Status:** ${status}
`;

  fs.appendFileSync(changelogPath, entry.trimEnd() + '\n', 'utf-8');
  console.log(`[OK] Successfully appended entry to AGENT_CHANGELOG.md at ${timestamp}`);
}

module.exports = { appendChangelog, resolveUserIdentity };

// If executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const agentRole = getArg('--role') || getArg('-r') || 'Autonomous AI Agent';
  const components = getArg('--component') || getArg('-c') || 'app';
  const descRaw = getArg('--desc') || getArg('-d');
  const status = getArg('--status') || getArg('-s') || 'Completed';
  const verification = getArg('--verify') || getArg('-v') || 'Automated verification';

  // Files from git status if not specified
  let files = [];
  const filesRaw = getArg('--files') || getArg('-f');
  if (filesRaw) {
    files = filesRaw.split(',').map(s => ({ path: s.trim() }));
  } else {
    const gitStatus = getCommandOutput('git status --porcelain');
    if (gitStatus) {
      files = gitStatus.split('\n').filter(Boolean).map(line => {
        const actionCode = line.substring(0, 2).trim();
        const filePath = line.substring(3).trim();
        let action = 'Modified';
        if (actionCode.includes('A') || actionCode === '??') action = 'Created';
        else if (actionCode.includes('D')) action = 'Deleted';
        return { path: filePath, action };
      });
    }
  }

  const description = descRaw ? descRaw.split(';').map(s => s.trim()) : ['Manual / CLI logged changes'];

  appendChangelog({ agentRole, components, files, description, verification, status });
}
