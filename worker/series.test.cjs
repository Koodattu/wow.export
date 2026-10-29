const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSeries, localOrigin } = require('./series.cjs');
const { validateJob } = require('../src/js/worker/job');
const material = require('../src/js/3D/writers/gltf-material');
const example = () => ({ id: 'week-1', title: 'Week 1', characters: [{ id: 'roidy', name: ' Röidy ', realm: 'Kazzak' }] });
test('series freezes character identity and supplies a default static pose', () => {
  assert.deepEqual(validateSeries(example()).characters[0], { id:'roidy', name:'röidy', realm:'kazzak', pose:{animationId:0,variation:0,timeMs:0}, weapons:'held' });
});
test('series rejects overwrite aliases and unsafe filenames', () => {
  for (const id of ['../other', 'CON', 'con', 'nul', 'a/b', 'x'.repeat(41)]) {
    const input = example(); input.id = id; assert.throws(() => validateSeries(input));
  }
  const duplicate = example(); duplicate.characters.push(duplicate.characters[0]);
  assert.throws(() => validateSeries(duplicate));
});
test('pose input rejects invalid values before queueing', () => {
  const base = {region:'eu',appearance:{playable_race:{id:1},playable_class:{id:1},gender:{type:'FEMALE'},items:[],customizations:[]}};
  assert.doesNotThrow(() => validateJob({...base,pose:{animationId:67,variation:0,timeMs:750}}));
  for (const pose of [null,{animationId:-1},{animationId:0,timeMs:'1'},{animationId:0,variation:-1},{animationId:0,timeMs:600001}])
    assert.throws(() => validateJob({...base,pose}));
});
test('lab origin stays local and cannot redirect credentials', () => {
  assert.equal(localOrigin('http://127.0.0.1:3015'), 'http://127.0.0.1:3015');
  for (const value of ['https://example.com','http://localhost.evil.test','http://user:password@localhost','http://localhost/path'])
    assert.throws(() => localOrigin(value));
});
test('material export preserves solid, cutout and transparent surfaces', () => {
  assert.deepEqual(material({blendingMode:0,flags:0}),{alphaMode:'OPAQUE',doubleSided:false,extras:{wowM2:{version:1,blendingMode:0,flags:0}}});
  assert.deepEqual(material({blendingMode:1,flags:4}),{alphaMode:'MASK',alphaCutoff:0.5,doubleSided:true,extras:{wowM2:{version:1,blendingMode:1,flags:4}}});
  assert.deepEqual(material({blendingMode:2,flags:0}),{alphaMode:'BLEND',doubleSided:false,extras:{wowM2:{version:1,blendingMode:2,flags:0}}});
});

test('additive effects retain the exact source mode for the web viewer', () => {
 for (const mode of [3,4]) { const result=material({blendingMode:mode,flags:1}); assert.equal(result.alphaMode,'BLEND'); assert.deepEqual(result.extras.wowM2,{version:1,blendingMode:mode,flags:1}); }
});
