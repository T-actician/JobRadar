// Publishes the installer built by `npm run dist` as a GitHub Release. Installed copies of JobRadar then update themselves.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { version } = require('../package.json');

const REPO = 'T-actician/JobRadar';
const GH = process.platform === 'win32' ? 'gh.exe' : 'gh';
const tag = `v${version}`;
const files = [`release/JobRadar-Setup-${version}.exe`, `release/JobRadar-Setup-${version}.exe.blockmap`, 'release/latest.yml'];

const missing = files.filter((f) => !fs.existsSync(f));
if (missing.length) {
  console.error(`Missing build files: ${missing.join(', ')}\nRun "npm run dist" first.`);
  process.exit(1);
}
let exists = true;
try { execFileSync(GH, ['release', 'view', tag, '--repo', REPO], { stdio: 'ignore' }); } catch { exists = false; }
if (exists) {
  console.error(`Release ${tag} already exists. Raise the version first:\n  npm version <new version> --no-git-tag-version`);
  process.exit(1);
}
// npm splits a quoted note into separate words on Windows, so join them back together
const notes = process.argv.slice(2).join(' ') || `JobRadar ${version}`;
execFileSync(GH, ['release', 'create', tag, ...files, '--repo', REPO, '--title', `JobRadar ${version}`, '--notes', notes], { stdio: 'inherit' });
console.log(`\nPublished ${tag}. Installed copies will update themselves within a few hours.`);
