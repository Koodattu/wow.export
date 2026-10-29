const {test}=require('node:test');const assert=require('node:assert/strict');
const {usesCharacterSkeleton}=require('../src/js/3D/character-skeleton');
const bone=(id,pivot)=>({boneNameCRC:id,pivot});
const char=[bone(981834931,[-.021102,1.611325,0]),bone(3492128444,[-.191117,1.783170,0])];
test('body-fitted cape uses named character bones even when bone order differs',()=>{assert.equal(usesCharacterSkeleton({boneIndices:[0,1,0,0],boneWeights:[128,127,0,0]},[char[1],char[0]],char),true)});
test('rigid, unknown, partial, and different-rest-position skeletons remain attachments',()=>{const m={boneIndices:[0,1],boneWeights:[128,127]};assert.equal(usesCharacterSkeleton(m,[char[0],bone(12,[0,0,0])],char),false);assert.equal(usesCharacterSkeleton(m,[char[0],bone(3492128444,[0,0,0])],char),false);assert.equal(usesCharacterSkeleton({boneIndices:[0,1],boneWeights:[255,0]},char,char),false);assert.equal(usesCharacterSkeleton(m,[bone(0,[0,0,0]),bone(0,[1,1,1])],[bone(0,[0,0,0]),bone(0,[1,1,1])]),false)});
