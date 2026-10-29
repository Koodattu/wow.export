function validateSeries(value) {
  const safeID = id => typeof id === 'string' && /^[a-z0-9][a-z0-9_-]{0,39}$/.test(id) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(id);
  if (!value || !safeID(value.id) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 120)
    throw new Error('Series requires a safe lowercase id and a title');
  if (!Array.isArray(value.characters) || value.characters.length < 1 || value.characters.length > 64)
    throw new Error('Choose 1–64 characters per series');
  const ids = new Set();
  const characters = value.characters.map(character => {
    if (!character || !safeID(character.id) || ids.has(character.id)) throw new Error('Character ids must be unique safe lowercase names');
    ids.add(character.id);
    const name = typeof character.name === 'string' ? character.name.trim().normalize('NFC').toLowerCase() : '';
    const realm = typeof character.realm === 'string' ? character.realm.trim().toLowerCase().replace(/\s+/g, '-') : '';
    if (!/^\p{L}{2,12}$/u.test(name) || realm.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(realm)) throw new Error('Invalid character name or realm slug');
    const pose = { animationId: 0, variation: 0, timeMs: 0, ...character.pose };
    if (Object.values(pose).some(n => !Number.isSafeInteger(n) || n < 0) || pose.timeMs > 600000)
      throw new Error('Pose requires non-negative integer animationId, variation, and timeMs');
    const weapons = character.weapons ?? 'held';
    if (!['held', 'sheathed'].includes(weapons)) throw new Error('Weapons must be held or sheathed');
    if (character.form !== undefined && character.form !== 'cat') throw new Error('Unsupported character form');
    return { id: character.id, name, realm, pose, weapons, ...(character.form ? {form:character.form} : {}) };
  });
  return { id: value.id, title: value.title.trim(), characters };
}
function localOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new Error('The character lab must be an HTTP origin on localhost');
  return url.origin;
}
module.exports = { validateSeries, localOrigin };
