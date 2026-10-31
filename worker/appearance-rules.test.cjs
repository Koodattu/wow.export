const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
test('single gender-specific component must not leak male chest panel onto female characters',async()=>{
 const rows=new Map([[161691,{RaceID:0,GenderIndex:0,ClassID:0}],[164372,{RaceID:0,GenderIndex:1,ClassID:0}],[152137,{RaceID:0,GenderIndex:3,ClassID:0}]]);
 const context={module:{exports:{}},require:p=>p.endsWith('db2')?{ComponentTextureFileData:{getAllRows:async()=>rows}}:{write(){}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/js/db/caches/DBComponentTextureFileData'),'utf8'),context);
 const api=context.module.exports;await api.initialize();
 assert.equal(api.getTextureForRaceGender([161691],1,1),null);
 assert.equal(api.getTextureForRaceGender([161691],1,0),161691);
 assert.equal(api.getTextureForRaceGender([164372],1,1),164372);
 assert.equal(api.getTextureForRaceGender([152137],1,1),152137);
 assert.equal(api.getTextureForRaceGender([999],1,1),999);
});
test('automatic underwear respects chest and legs independently and preserves explicit overrides',()=>{
 const include=require('../src/js/wow/base-clothing');
 const display=id=>id===100?500:undefined;
 assert.equal(include(13,'auto',{5:100,7:200},{},display),false);
 assert.equal(include(14,'auto',{5:100,7:200},{},display),true);
 assert.equal(include(13,'auto',{5:200,7:100},{},display),true);
 assert.equal(include(14,'auto',{5:200,7:100},{},display),false);
 assert.equal(include(13,'auto',{}, {},display),true);
 assert.equal(include(14,'auto',{}, {},display),true);
 assert.equal(include(13,true,{5:100},{},display),true);
 assert.equal(include(14,false,{}, {},display),false);
 assert.equal(include(1303,false,{}, {},display),true);
 let received;include(13,'auto',{5:100},{5:0},(id,mod)=>{received=[id,mod];return 500;});assert.deepEqual(received,[100,0]);
});
