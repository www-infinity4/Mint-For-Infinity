'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { scanStarQuestCatalog } = require('../catalog-provenance');

function loadShows(sourcePath) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const sandbox = Object.create(null);
  vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  const script = new vm.Script(source + '\n;globalThis.__SCAN_SHOWS__ = SHOWS;', { filename: sourcePath, timeout: 2_000 });
  script.runInContext(sandbox, { timeout: 2_000 });
  if (!Array.isArray(sandbox.__SCAN_SHOWS__)) throw new Error('SHOWS array was not found.');
  return JSON.parse(JSON.stringify(sandbox.__SCAN_SHOWS__));
}

function main() {
  const sourcePath = path.resolve(process.argv[2] || '../TV-Database/js/data.js');
  const outputPath = path.resolve(process.argv[3] || 'catalogs/starquest-provenance.json');
  const shows = loadShows(sourcePath);
  const manifest = scanStarQuestCatalog(shows, {
    sourceRepository: 'www-infinity4/TV-Database', sourcePath: 'js/data.js', sourceRef: process.env.STARQUEST_REF || 'main',
    generatedAt: process.env.SCAN_TIMESTAMP || new Date().toISOString(),
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
  process.stdout.write(JSON.stringify(manifest.summary) + '\n');
}

if (require.main === module) main();
module.exports = { loadShows };
