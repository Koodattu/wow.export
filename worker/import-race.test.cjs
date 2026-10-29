const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('worker imports retain faction races sharing a model while desktop picker stays deduplicated', () => {
  const source=fs.readFileSync(require.resolve('../src/js/modules/tab_characters'), 'utf8');
  const start=source.indexOf('function update_chr_race_list(core) {');
  const end=source.indexOf('//endregion',start);
  const races=new Map([[86,{id:86,name:'Haranir',isNPCRace:false}],[91,{id:91,name:'Haranir',isNPCRace:false}]]);
  const models=new Map([[86,new Map([[1,100]])],[91,new Map([[1,100]])]]);
  for(const worker_mode of [true,false]) {
    const core={view:{chrCustRaceSelection:[]}};
    const sandbox={core,worker_mode,DBCharacterCustomization:{get_chr_race_map:()=>races,get_chr_race_x_chr_model_map:()=>models}};
    vm.runInNewContext(source.slice(start,end)+'; update_chr_race_list(core);',sandbox);
    assert.deepEqual(Array.from(core.view.chrCustRaces,c=>c.id),worker_mode?[86,91]:[86]);
  }
});
