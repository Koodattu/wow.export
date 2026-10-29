const test=require('node:test');
const assert=require('node:assert/strict');
const resolve=require('../src/js/worker/druid-form');
const {validateJob}=require('../src/js/worker/job');
const {validateSeries}=require('./series.cjs');
const appearance=()=>({playable_class:{id:11},playable_race:{id:4},gender:{type:'FEMALE'},items:[],customizations:[{option:{id:911},choice:{id:10088,name:'Ghost of the Pridemother (Green)'}},{option:{id:901},choice:{id:10067,name:'Bear'}}]});
const tables=(rows)=>({ChrCustomizationElement:{getAllRows:async()=>new Map(rows.map((r,i)=>[i,r]))},ChrCustomizationDisplayInfo:{getRow:async id=>({SpellShapeshiftFormID:id===1?1:5,CreatureDisplayInfoID:id===1?700:701})}});
const creatures={getFileDataIDByDisplayID:id=>id===700?900:901,getDisplayInfo:id=>({textures:[id]})};
test('cat form resolves the selected customization, not the bear form or another color',async()=>{
 const rows=[{ChrCustomizationChoiceID:10067,ChrCustomizationDisplayInfoID:2},{ChrCustomizationChoiceID:999,ChrCustomizationDisplayInfoID:1},{ChrCustomizationChoiceID:10088,ChrCustomizationDisplayInfoID:1}];
 const form=await resolve(appearance(),tables(rows),creatures);
 assert.equal(form.choiceId,10088);assert.equal(form.displayId,700);assert.equal(form.modelFileDataId,900);
 assert.equal(form.choiceName,'Ghost of the Pridemother (Green)');
 await assert.rejects(resolve(appearance(),tables(rows.slice(0,2)),creatures),/explicit cat-form/);
 await assert.rejects(resolve({...appearance(),playable_class:{id:8}},tables(rows),creatures),/druid/);
});
test('cat form survives series normalization and rejects unsupported forms and non-druids',()=>{
 const selected={id:'cat',title:'Cat',characters:[{id:'zetabeach',name:'Zetabeach',realm:'stormreaver',form:'cat',weapons:'sheathed'}]};
 assert.equal(validateSeries(selected).characters[0].form,'cat');
 assert.equal(validateJob({region:'eu',form:'cat',appearance:appearance()}).form,'cat');
 assert.throws(()=>validateSeries({...selected,characters:[{...selected.characters[0],form:'bear'}]}),/Unsupported/);
 assert.throws(()=>validateJob({region:'eu',form:'cat',appearance:{...appearance(),playable_class:{id:8}}}),/druid/);
 assert.throws(()=>validateJob({region:'eu',form:'bear',appearance:appearance()}),/Unsupported/);
});
