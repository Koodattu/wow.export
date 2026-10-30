const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
test('horn decoration includes only the mesh for the selected horn shape',async()=>{
 const elements=new Map([[1,{ChrCustomizationChoiceID:100,ChrCustomizationGeosetID:0,ChrCustomizationMaterialID:0,ChrCustomizationBoneSetID:0,ChrCustomizationSkinnedModelID:1,RelatedChrCustomizationChoiceID:200}],[2,{ChrCustomizationChoiceID:100,ChrCustomizationGeosetID:0,ChrCustomizationMaterialID:0,ChrCustomizationBoneSetID:0,ChrCustomizationSkinnedModelID:2,RelatedChrCustomizationChoiceID:201}],[3,{ChrCustomizationChoiceID:101,ChrCustomizationGeosetID:0,ChrCustomizationMaterialID:0,ChrCustomizationBoneSetID:0,ChrCustomizationSkinnedModelID:3,RelatedChrCustomizationChoiceID:0}]]);
 const models=new Map([[1,{CollectionsFileDataID:4375631,GeosetType:16,GeosetID:3}],[2,{CollectionsFileDataID:4375631,GeosetType:16,GeosetID:6}],[3,{CollectionsFileDataID:4375631,GeosetType:24,GeosetID:2}]]);
 const db=new Proxy({}, {get:(_,name)=>({getAllRows:async()=>name==='ChrCustomizationElement'?elements:name==='ChrCustomizationSkinnedModel'?models:new Map()})});
 const sandbox={module:{exports:{}},require:id=>id==='../../casc/db2'?db:id==='../../log'?{write(){}}:{initializeCreatureData:async()=>{}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/js/db/caches/DBCharacterCustomization'),'utf8'),sandbox);
 const api=sandbox.module.exports;await api.ensureInitialized();
 const active=[{choiceID:100},{choiceID:200},{choiceID:101}];
 assert.deepEqual(Array.from(api.get_skinned_model_for_choice(100,active),m=>m.geoset),[1603]);
 assert.deepEqual(Array.from(api.get_skinned_model_for_choice(101,active),m=>m.geoset),[2402]);
 assert.equal(api.get_skinned_model_for_choice(100,[]),undefined);
 // Introspection without active choices still lists every candidate.
 assert.equal(api.get_skinned_model_for_choice(100).length,2);
});
