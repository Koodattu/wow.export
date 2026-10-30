const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('cloak texture resolves without an item model and preserves composite customization layers', async () => {
 const source=fs.readFileSync(require.resolve('../src/js/modules/tab_characters'),'utf8');
 const code=source.slice(source.indexOf('function get_character_replaceable_textures('),source.indexOf('async function update_textures('));
 const loaded=[];const sandbox={Map,chr_materials:new Map([[1,{getURI:()=> 'body-composite'}],[7,{getURI:()=> 'colored-wing-composite'}]]),
  DBItemCharTextures:{getDisplayId:(item,modifier)=>{assert.equal(item,123);assert.equal(modifier,0);return 456;}},
  require:id=>{
   if(id.endsWith('DBItemDisplayInfoModelMatRes'))return {getItemDisplayIdTextureFileIds:display=>{assert.equal(display,456);return [789];}};
   if(id.endsWith('/blp'))return class {constructor(file){assert.equal(file,789);}getDataURL(channels){assert.equal(channels,15);return 'cloak-image';}};
   throw Error(id);
  }};
 vm.runInNewContext(code,sandbox);
 const core={view:{chrEquippedItems:{15:123},chrEquippedItemSkins:{15:0},casc:{getFile:async id=>{loaded.push(id);return id;}}}};
 const textures=new Map();await sandbox.apply_export_textures({addURITexture:(type,uri)=>textures.set(type,uri)},core);
 assert.deepEqual([...textures],[[1,'body-composite'],[7,'colored-wing-composite'],[2,'cloak-image']]);
 assert.deepEqual(loaded,[789]);
 core.view.chrEquippedItems={};assert.equal(sandbox.get_character_replaceable_textures(core).size,0);
});
