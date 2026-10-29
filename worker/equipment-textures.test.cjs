const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('equipment exports fixed M2 textures alongside replaceable item-display textures',async()=>{
 const loaded=[];const core={view:{config:{modelsExportTextures:true,modelsExportAlpha:true},casc:{getFile:async id=>{loaded.push(id);return id;}}}};
 const sandbox={module:{exports:{}},require:id=>{
   if(id==='../../core')return core;
   if(id==='path')return require('node:path');
   if(id==='../../log')return {write(){}};
   if(id==='../../casc/listfile')return {getByID:()=>undefined};
   if(id==='../../casc/blp')return class{constructor(id){this.id=id;} async toPNG(){return Buffer.from([this.id]);}};
   if(id==='../../wow/EquipmentSlots')return {get_slot_name:()=> 'Feet'};
   return {};
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/js/3D/exporters/M2Exporter'),'utf8'),sandbox);
 const exporter=Object.create(sandbox.module.exports.prototype);
 const skin={subMeshes:[{triangleCount:3,triangleStart:0}],indices:[0,1,2],triangles:[0,1,2],textureUnits:[{skinSectionIndex:0,textureComboIndex:0,materialIndex:0}]};
 const m2={load:async()=>{},getSkin:async()=>skin,textures:[{fileDataID:42}],textureTypes:[0],textureCombos:[0],materials:[{blendingMode:0,flags:0}]};
 let equipment;const gltf={texture_buffers:new Map(),addEquipmentModel:e=>{equipment=e;}};
 const textureMap=new Map();
 await exporter._addEquipmentToGLTF(gltf,{slot_id:8,item_id:171338,renderer:{m2},textures:[17]},textureMap,'C:/output','glb',null);
 assert.deepEqual(loaded,[17,42]);
 assert.ok(gltf.texture_buffers.has(42));
 assert.equal(equipment.meshes[0].matName,textureMap.get(42).matName);
 // A fixed texture must also export when no replaceable list exists.
 loaded.length=0;textureMap.clear();
 await exporter._addEquipmentToGLTF(gltf,{slot_id:16,item_id:233815,renderer:{m2}},textureMap,'C:/output','glb',null);
 assert.deepEqual(loaded,[42]);
 assert.equal(equipment.meshes[0].matName,textureMap.get(42).matName);
});
