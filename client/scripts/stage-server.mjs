import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '../../server');
const dest = path.resolve(here, '../server');

function keep(src) {
  const base = path.basename(src);
  if (base === 'node_modules' || base === '.git') return false;
  if (base === '.env' || base.startsWith('.env.')) return false;
  if (base.startsWith('.mock')) return false;
  if (/casinworks-sdpm|service-account|credentials/i.test(base)) return false;
  return true;
}

if (!fs.existsSync(source)) {
  console.warn(`stage-server: source not found at ${source}`);
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(source, dest, { recursive: true, filter: keep });
console.log(`stage-server: copied API into ${dest}`);
