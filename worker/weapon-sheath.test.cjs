const test=require('node:test');const assert=require('node:assert/strict');
const sheath=require('../src/js/wow/weapon-sheath');
const {validateSeries}=require('./series.cjs');
test('weapon sheath types use opposing back/hip anchors and central shield anchor',()=>{
 assert.equal(sheath(16,1),26);assert.equal(sheath(17,1),27);
 assert.equal(sheath(16,2),31);assert.equal(sheath(17,2),30);
 assert.equal(sheath(16,3),33);assert.equal(sheath(17,3),32);
 assert.equal(sheath(17,4),28);assert.equal(sheath(17,0),null);
 assert.equal(sheath(3,1),null);
});
test('series preserves explicit weapon placement and rejects unknown values',()=>{
 const series={id:'poses',title:'Poses',characters:[{id:'laku',name:'Laku',realm:'Stormreaver',weapons:'sheathed'}]};
 assert.equal(validateSeries(series).characters[0].weapons,'sheathed');
 series.characters[0].weapons='backwards';assert.throws(()=>validateSeries(series));
});
