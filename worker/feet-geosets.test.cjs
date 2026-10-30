const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('negative boot foot selector preserves bare feet instead of hiding every foot mesh',async()=>{
 const displays=new Map([[-1,{GeosetGroup:[0,-1]}],[0,{GeosetGroup:[0,0]}],[3,{GeosetGroup:[0,3]}]].map(([v,row])=>[100+v,row]));
 const db=new Proxy({}, {get:(_,name)=>({getAllRows:async()=>name==='ItemDisplayInfo'?displays:new Map()})});
 const sandbox={module:{exports:{}},require:id=>id==='../../casc/db2'?db:{write(){}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/js/db/caches/DBItemGeosets'),'utf8'),sandbox);const api=sandbox.module.exports;await api.initialize();
 for(const [value,expected] of [[-1,undefined],[0,2],[3,3]]) {
  const slots=new Map([[8,100+value]]);assert.equal(api.calculateEquipmentGeosetsByDisplay(slots).get(20),expected);
  assert.equal(api.getAffectedCharGeosetsByDisplay(slots).has(20),value>=0);
 }
});
