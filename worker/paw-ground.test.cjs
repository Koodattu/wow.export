const test=require('node:test');const assert=require('node:assert/strict');const pawGround=require('../src/js/3D/paw-ground');
test('cat support follows visible paws and toes rather than low fur, tail or hidden geometry',()=>{
 const bones=[{boneID:26,parentBone:-1},{boneID:59,parentBone:0},{boneID:-1,parentBone:1},{boneID:60,parentBone:0}];
 const model={boneIndices:[0,0,0,0, 1,0,0,0, 2,0,0,0, 3,0,0,0, 1,0,0,0],boneWeights:Array.from({length:20},(_,i)=>i%4===0?255:0)};
 const vertices=[0,-3,0, -1,0,0, -1.2,0,0.2, 1,0.3,0, 0,-5,0];
 const skin={subMeshes:[{triangleStart:0,triangleCount:6},{triangleStart:6,triangleCount:3}],indices:[0,1,2,3,4],triangles:[0,1,2,1,2,3,4,4,4]};
 const support=pawGround(model,bones,vertices,skin,[{checked:true},{checked:false}]);
 assert.equal(support.groundY,0);assert.equal(support.centerX,-1.1);assert.equal(support.centerZ,0.1);
 assert.equal(pawGround(model,[],vertices,skin,[{checked:true}]),null);
});
