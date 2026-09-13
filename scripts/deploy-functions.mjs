// Déploie les Cloud Functions avec un délai de découverte allongé : le délai
// par défaut de la CLI (10 s) échoue sur « User code failed to load » avec
// firebase-functions 7.
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'firebase',
  ['deploy', '--only', 'functions', '--project', 'patro-management-2024'],
  { stdio: 'inherit', shell: true, env: { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: '90' } }
);
process.exit(result.status ?? 1);
