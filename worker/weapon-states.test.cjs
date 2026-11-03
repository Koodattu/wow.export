const {test} = require('node:test');
const assert = require('node:assert/strict');
const {validateJob} = require('../src/js/worker/job');
const {validateSeries} = require('./series.cjs');
const appearance = {playable_race:{id:34}, playable_class:{id:7}, gender:{type:'MALE'}, items:[], customizations:[]};
test('per-hand settings survive recipe and job validation, with legacy defaults unchanged', () => {
  const character = {id:'shippyboi', name:'Shippyboi', realm:'Outland', weapons:'held', weaponStates:{offHand:'sheathed'}};
  const validated = validateSeries({id:'mixed', title:'Mixed', characters:[character]}).characters[0];
  assert.deepEqual(validated.weaponStates, {offHand:'sheathed'});
  assert.equal(validated.weapons,'held');
  assert.deepEqual(validateJob({region:'eu', appearance, ...validated}).weaponStates, {offHand:'sheathed'});
  delete character.weaponStates;
  assert.equal(validateSeries({id:'legacy', title:'Legacy', characters:[character]}).characters[0].weaponStates, undefined);
});
test('invalid per-hand keys, values and shapes are rejected by both boundaries', () => {
  for (const weaponStates of [null, [], 'held', {offHand:'bad'}, {offhand:'sheathed'}, {mainHand:0}]) {
    assert.throws(() => validateJob({region:'eu', appearance, weaponStates}), /per-hand/);
    assert.throws(() => validateSeries({id:'bad', title:'Bad', characters:[{id:'shippyboi',name:'Shippyboi',realm:'Outland',weaponStates}]}), /per-hand/);
  }
});
