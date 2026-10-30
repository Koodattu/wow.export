const test = require('node:test');
const assert = require('node:assert/strict');
const {validateJob, resolveCharacterForm} = require('../src/js/worker/job');
const {validateSeries} = require('./series.cjs');
const appearance = (race, klass) => ({playable_race:{id:race},playable_class:{id:klass},gender:{type:'FEMALE'},items:[],customizations:[]});

test('both Dracthyr factions default to visage for every non-Evoker class', () => {
  for (const race of [52,70]) for (let klass=1;klass<=13;klass++) {
    const a=appearance(race,klass);
    const expected=klass===13?'dracthyr':'visage';
    assert.equal(resolveCharacterForm(a),expected);
    assert.equal(validateJob({region:'eu',appearance:a}).form,expected);
  }
  assert.equal(resolveCharacterForm(appearance(4,5)),undefined);
});
test('explicit character exceptions survive recipe and job validation', () => {
  for (const form of ['visage','dracthyr']) {
    const recipe={id:'forms',title:'Forms',characters:[{id:'example',name:'Example',realm:'kazzak',form}]};
    assert.equal(validateSeries(recipe).characters[0].form,form);
    for(const klass of [5,13]) assert.equal(validateJob({region:'eu',appearance:appearance(70,klass),form}).form,form);
    assert.throws(()=>validateJob({region:'eu',appearance:appearance(4,5),form}),/requires a Dracthyr/);
  }
});
