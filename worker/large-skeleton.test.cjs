const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const boneTrack = require('../src/js/3D/bone-track');

test('CPU attachment transforms include Dracthyr bones beyond the GPU limit', () => {
  const gpu = new Float32Array(256 * 16);
  const sandbox = {module:{exports:{}}, require: id => id === '../bone-track' ? boneTrack : id === './renderer_utils' ? {create_bones_ubo: () => gpu} : {BlendMode:{}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/js/3D/renderers/M2RendererGL'), 'utf8'), sandbox);
  const renderer = Object.create(sandbox.module.exports.prototype);
  const empty = {globalSeq:65535,timestamps:[],values:[]};
  const bones = Array.from({length:345}, () => ({parentBone:-1,pivot:[0,0,0],boneID:-1,translation:empty,rotation:empty,scale:empty}));
  bones[309] = {...bones[309], parentBone:304, translation:{globalSeq:65535,timestamps:[[0]],values:[[[1,2,3]]]}};
  bones[304] = {...bones[304], translation:{globalSeq:65535,timestamps:[[0]],values:[[[4,5,6]]]}};
  Object.assign(renderer, {bones,animation_time:0,current_anim_index:0,global_seq_times:[],hands_closed_anim_idx:null,
    m2:{getAttachmentById:() => ({bone:309,position:[0,0,0]})},model_matrix:Float32Array.from([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),_scratch_calculated:new Uint8Array(256)});
  for (const name of ['local','trans','rot','scale','pivot','neg_pivot','result']) renderer['_scratch_'+name] = new Float32Array(16);
  renderer._create_bones_ubo();
  assert.equal(renderer.bone_matrices.length,345*16);
  assert.equal(gpu.length,256*16);
  renderer._update_bone_matrices();
  const transform = renderer.getAttachmentTransform(5);
  assert.ok(transform.every(Number.isFinite));
  assert.deepEqual(Array.from(transform.slice(12,15)),[5,7,9]);
});
