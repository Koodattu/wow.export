const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const boneTrack = require('../src/js/3D/bone-track');

test('global tracks use sequence zero and global clock during a different emote', () => {
 const track = {globalSeq: 0, timestamps: [[0, 1000]], values: [[1, 2]]};
 assert.deepEqual(boneTrack(track, 42, 750, [250]), {timestamps:[0,1000], values:[1,2], time:250});
});
test('ordinary tracks use the selected emote, never another animation as a fallback', () => {
 const track = {globalSeq:65535, timestamps:[[0], [0]], values:[[1],[2]]};
 assert.equal(boneTrack(track,1,750,[]).values[0],2);
 assert.equal(boneTrack(track,42,750,[]),null);
 assert.equal(boneTrack(undefined,42,750,[]),null);
});
test('sheath attachment inherits its global rotation and scale in a nonzero emote', () => {
 // Exercise the actual renderer matrix path without creating a WebGL context.
 const sandbox = {module:{exports:{}}, require: id => id === '../bone-track' ? boneTrack : {BlendMode:{}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/js/3D/renderers/M2RendererGL'),'utf8'),sandbox);
 const Renderer=sandbox.module.exports;
 const renderer=Object.create(Renderer.prototype);
 const empty={globalSeq:65535,timestamps:[],values:[]};
 const bone={parentBone:-1,pivot:[0,0,0],boneID:-1,translation:empty,
 rotation:{globalSeq:0,timestamps:[[0]],values:[[[0,0,Math.SQRT1_2,Math.SQRT1_2]]]},
 scale:{globalSeq:0,timestamps:[[0]],values:[[[2,2,2]]]}};
 Object.assign(renderer,{bones:[bone],bone_matrices:new Float32Array(16),animation_time:.75,current_anim_index:42,global_seq_times:[0],hands_closed_anim_idx:null,
 m2:{getAttachmentById:()=>({bone:0,position:[0,0,0]})},model_matrix:Float32Array.from([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),_scratch_calculated:new Uint8Array(1)});
 for(const name of ['local','trans','rot','scale','pivot','neg_pivot','result']) renderer['_scratch_'+name]=new Float32Array(16);
 renderer._update_bone_matrices();
 const transform=renderer.getAttachmentTransform(31);
 // A weapon's +X axis must rotate to +Y, rather than stick out horizontally.
 assert.ok(Math.abs(transform[0])<1e-6);
 assert.ok(Math.abs(transform[1]-2)<1e-6);
 assert.ok(Math.abs(transform[10]-2)<1e-6);
});
