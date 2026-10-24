import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const bundle = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const repository = process.argv[3];
if (repository !== 'SavingBigHead/readest') throw new Error('Expected SavingBigHead/readest');
for (const name of [
  'PERSONAL_TAURI_KEY', 'PERSONAL_TAURI_PASSWORD',
  'PERSONAL_ANDROID_KEYSTORE', 'PERSONAL_ANDROID_PASSWORD',
]) {
  const value = bundle.secrets[name];
  if (!value) throw new Error('Missing local signing value: ' + name);
  const result = spawnSync('gh', ['secret', 'set', name, '--repo', repository], {
    input: value, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) throw new Error('Could not set ' + name + '. Check GitHub CLI login and repository access.');
  console.log('Configured ' + name);
}
