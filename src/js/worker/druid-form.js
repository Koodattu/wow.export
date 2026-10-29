// Resolve the selected form through Blizzard's customization/display tables.
// Form 1 is Cat in SpellShapeshiftForm; no localized option names are required.
module.exports = async function resolveCatForm(appearance, db2, creatures) {
 if (appearance.playable_class.id !== 11) throw new Error('Cat form requires a druid');
 const choices = new Map(appearance.customizations.map(c => [c.choice.id, c.choice]));
 const matches = new Map();
 for (const row of (await db2.ChrCustomizationElement.getAllRows()).values()) {
  if (!choices.has(row.ChrCustomizationChoiceID) || !row.ChrCustomizationDisplayInfoID) continue;
  const display = await db2.ChrCustomizationDisplayInfo.getRow(row.ChrCustomizationDisplayInfoID);
  if (display?.SpellShapeshiftFormID === 1 && display.CreatureDisplayInfoID > 0)
   matches.set(display.CreatureDisplayInfoID, row.ChrCustomizationChoiceID);
 }
 if (matches.size !== 1) throw new Error('Expected one explicit cat-form appearance; default/random forms are not supported yet');
 const [displayId, choiceId] = [...matches][0];
 const modelFileDataId = creatures.getFileDataIDByDisplayID(displayId);
 const display = creatures.getDisplayInfo(displayId);
 if (!modelFileDataId || !display) throw new Error('Selected cat-form model is unavailable');
 return {type:'cat',choiceId,choiceName:choices.get(choiceId).name,displayId,modelFileDataId,display};
};
