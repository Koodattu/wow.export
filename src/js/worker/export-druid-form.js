const path = require('path');
const db2 = require('../casc/db2');
const creatures = require('../db/caches/DBCreatures');
const Renderer = require('../3D/renderers/M2RendererGL');
const Exporter = require('../3D/exporters/M2Exporter');
const resolveCatForm = require('./druid-form');

module.exports = async function exportCatForm(core, appearance, pose, context) {
 const {display, ...form} = await resolveCatForm(appearance, db2, creatures);
 const data = await core.view.casc.getFile(form.modelFileDataId);
 const renderer = new Renderer(data, context, false, false);
 try {
  await renderer.load();
  const animations = (renderer.skelLoader || renderer.m2).animations || [];
  const poses = animations.map(a => ({animationId:a.id,variation:a.variationIndex,name:require('../3D/AnimMapper').get_anim_name(a.id),durationMs:a.duration}));
  const index = animations.findIndex(a => a.id === pose.animationId && a.variationIndex === (pose.variation ?? 0));
  if (index < 0) throw new Error('Requested cat-form animation is unavailable. Available: ' + poses.map(p => p.animationId + ':' + p.name).join(', '));
  const timeMs = pose.timeMs ?? 0;
  if (timeMs >= animations[index].duration) throw new Error('Cat-form pose time must be less than animation duration: ' + JSON.stringify(animations[index]));
  await renderer.playAnimation(index);
  renderer.updateAnimation(timeMs / 1000);
  const baked = renderer.getBakedGeometry();
  const skin = await renderer.m2.getSkin(0);
  const mask = skin.subMeshes.map(mesh => {
   const id = mesh.submeshID;
   const checked = display.extraGeosets !== undefined
    ? !(id > 0 && id < 900) || display.extraGeosets.includes(id)
    : String(id).endsWith('0') || String(id).endsWith('01');
   return {checked};
  });
  const exporter = new Exporter(await core.view.casc.getFile(form.modelFileDataId), display.textures, form.modelFileDataId);
  exporter.setGeosetMask(mask);
  exporter.setPosedGeometry(baked.vertices, baked.normals);
  exporter.setGroundSupport(require('../3D/paw-ground')(renderer.m2, renderer.bones, baked.vertices, skin, mask));
  exporter.setEquipmentModelsGLTF([]); // Record the paw/contact anchor without humanoid equipment.
  await exporter.exportAsGLTF(path.join(core.view.config.exportDirectory,'cat.glb'), {isCancelled:()=>false}, 'glb');
  return {pose:{...poses[index],timeMs},poses,form,modelFileDataId:form.modelFileDataId,weapons:'sheathed',weaponPlacement:[],choices:appearance.customizations,equipment:{},modifiers:{}};
 } finally {renderer.dispose();}
};
