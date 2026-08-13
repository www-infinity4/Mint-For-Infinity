'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { scanCardCatalog } = require('../catalog-provenance');

function loadCards(sourcePath) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const start = source.indexOf('const cards = [');
  if (start < 0) throw new Error('cards array was not found.');
  const endMarker = source.indexOf('\n];', start);
  if (endMarker < 0) throw new Error('cards array closing marker was not found.');
  const declaration = source.slice(start, endMarker + 3) + '\n;globalThis.__SCAN_CARDS__ = cards;';
  const sandbox = Object.create(null);
  vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(declaration, { filename: sourcePath }).runInContext(sandbox, { timeout: 2_000 });
  return JSON.parse(JSON.stringify(sandbox.__SCAN_CARDS__));
}

function main() {
  const sourcePath = path.resolve(process.argv[2] || '../Goudey-Catalog/app.js');
  const outputPath = path.resolve(process.argv[3] || 'catalogs/goudey-provenance.json');
  const cards = loadCards(sourcePath);
  const manifest = scanCardCatalog(cards, { sourceRepository: 'www-infinity4/Goudey-Tradition-Trading-Card-Company-LLC', sourcePath: 'app.js', sourceRef: process.env.GOUDEY_REF || 'main', defaultPublisher: 'Goudey Tradition Trading Card Company LLC', generatedAt: process.env.SCAN_TIMESTAMP || new Date().toISOString() });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
  process.stdout.write(JSON.stringify(manifest.summary) + '\n');
}
if (require.main === module) main();
module.exports = { loadCards };
