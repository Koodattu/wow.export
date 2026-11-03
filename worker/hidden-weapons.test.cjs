const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { validateJob } = require('../src/js/worker/job');
const { validateSeries } = require('./series.cjs');

test('hidden weapons and the first animation frame are accepted in jobs and series', () => {
  const pose = { animationId: 1260, variation: 0, timeMs: 0 };
  const appearance = { playable_race: { id: 25 }, playable_class: { id: 8 }, gender: { type: 'MALE' }, items: [], customizations: [] };
  assert.equal(validateJob({ region: 'eu', appearance, pose, weapons: 'hidden' }).weapons, 'hidden');
  const input = { id: 'laku-lean', title: 'Laku', characters: [{ id: 'laku', name: 'Laku', realm: 'Stormreaver', pose, weapons: 'hidden' }] };
  assert.deepEqual(validateSeries(input).characters[0].pose, pose);
  assert.equal(validateSeries(input).characters[0].weapons, 'hidden');
  assert.throws(() => validateJob({ region: 'eu', appearance, weapons: 'invalid' }), /Invalid weapon/);
  input.characters[0].weapons = 'invalid';
  assert.throws(() => validateSeries(input), /Weapons must/);
});

test('hidden weapons remove both hand meshes and release the grip, preserving other equipment', () => {
  const source = fs.readFileSync(require.resolve('../src/js/modules/tab_characters'), 'utf8');
  const start = source.indexOf('const weaponPlacement = [];');
  const end = source.indexOf('await active_renderer.playAnimation(index);', start);
  assert.ok(start > 0 && end > start);
  for (const [weapons, weaponStates] of [['hidden'], ['held'], ['sheathed'], ['held', {offHand: 'sheathed'}], ['sheathed', {mainHand: 'held'}]]) {
    const disposed = [];
    const entries = new Map([3, 16, 17].map(slot => [slot, { item_id: 100 + slot,
      renderers: [{ attachment_id: slot === 16 ? 1 : 2, renderer: { dispose: () => disposed.push(slot) } }] }]));
    let grip;
    const context = { weapons, weaponStates, equipment_model_renderers: entries,
      DBItems: { getItemById: () => ({ sheatheType: 1 }) },
      require: name => { assert.equal(name, '../wow/weapon-sheath'); return slot => slot + 10; },
      ATTACHMENT_ID: { HAND_RIGHT: 1, HAND_LEFT: 2 },
      active_renderer: { getAttachmentTransform: () => ({}), setHandGrip: (...value) => { grip = value; } } };
    vm.runInNewContext(source.slice(start, end) + '; result = weaponPlacement;', context);
    assert.ok(entries.has(3));
    assert.deepEqual(disposed, weapons === 'hidden' ? [16, 17] : []);
    assert.deepEqual(grip, weaponStates ? [true, false] : weapons === 'held' ? [true, true] : [false, false]);
    assert.deepEqual(Array.from(context.result, item => item.visible), [weapons !== 'hidden', weapons !== 'hidden']);
    assert.deepEqual(Array.from(context.result, item => item.attachmentID), weaponStates ? [1, 27] : weapons === 'hidden' ? [null, null] : weapons === 'held' ? [1, 2] : [26, 27]);
    assert.equal(entries.size, weapons === 'hidden' ? 1 : 3);
  }
});
