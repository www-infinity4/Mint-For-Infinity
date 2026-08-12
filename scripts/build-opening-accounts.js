'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { buildOpeningAccounts } = require('../catalog-bank');
(async () => {
  const input = path.resolve(process.argv[2] || 'catalogs/starquest-provenance.json');
  const output = path.resolve(process.argv[3] || 'catalogs/starquest-opening-accounts.json');
  const manifest = JSON.parse(fs.readFileSync(input, 'utf8'));
  const result = await buildOpeningAccounts(manifest, { createdAt: process.env.ACCOUNT_TIMESTAMP || new Date().toISOString() });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result.summary) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
