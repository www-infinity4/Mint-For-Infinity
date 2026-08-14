'use strict';
const assert = require('node:assert/strict');
if (!globalThis.crypto) globalThis.crypto = require('node:crypto').webcrypto;
const { InfinitySiteBus, InfinityLanguageEngine, memoryStorage } = require('../infinity-ai-kernel');

(async () => {
  const storage = memoryStorage();
  const bus = new InfinitySiteBus({ storage });
  const first = await bus.append({ eventId: 'mint:1', type: 'MINT_COMPLETED', sourceSite: 'INFINITY_MINT', actorWalletId: 'wallet:test', payload: { serial: 'IC-TEST', valueInfinity: 1 } });
  const duplicate = await bus.append({ eventId: 'mint:1', type: 'MINT_COMPLETED', sourceSite: 'INFINITY_MINT', actorWalletId: 'wallet:test', payload: {} });
  await bus.append({ eventId: 'watch:1', type: 'WATCH_COMPLETED', sourceSite: 'STARQUEST', actorWalletId: 'wallet:test', payload: { title: 'M*A*S*H' } });
  assert.equal(first.hash, duplicate.hash);
  assert.equal(bus.query({ actorWalletId: 'wallet:test' }).length, 2);
  assert.equal(await bus.verify(), true);

  const language = new InfinityLanguageEngine({ storage });
  const answer = language.answer('How many $1 notes can I mint each day?');
  assert.match(answer.text, /\$10 Infinity/);
  assert.ok(answer.confidence > 0);
  language.learnFromEvent(bus.query({ type: 'WATCH_COMPLETED' })[0]);
  assert.ok(language.retrieve('watch completed starquest').length > 0);
  language.addDocuments([
    { id: 'show:mash', title: 'M*A*S*H', tags: ['Drama', 'Comedy'], text: 'M*A*S*H is a StarQuest comedy drama set at a mobile army surgical hospital.' },
    { id: 'show:abba', title: 'ABBA - Take a Chance on Me', tags: ['Music'], text: 'A playful pop video.' }
  ]);
  const mash = language.answer('Tell me about M*A*S*H');
  assert.match(mash.text, /^M\*A\*S\*H is/);
  assert.doesNotMatch(mash.text, /ABBA/);
  console.log('Infinity site bus and language engine: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
