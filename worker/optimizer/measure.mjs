import fs from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import validator from 'gltf-validator';

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const [input, outputArgument] = process.argv.slice(2);
if (!input || !outputArgument) throw new Error('Usage: node measure.mjs <source.glb> <new-output-directory>');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const output = path.resolve(outputArgument);
await fs.mkdir(output); // Refuse to overwrite a previous experiment.
const report = [];
function stats(doc) {
  const root = doc.getRoot();
  const primitives = root.listMeshes().flatMap(m => m.listPrimitives());
  return { meshes: root.listMeshes().length, primitives: primitives.length,
    triangles: primitives.reduce((s,p)=>s+(p.getIndices()?.getCount() || p.getAttribute('POSITION').getCount())/3,0),
    skins: root.listSkins().length, textures: root.listTextures().map(t=>({size:t.getSize(), bytes:t.getImage().length, mime:t.getMimeType()})) };
}
for (const mode of ['original', 'compact-png', 'webp-1024']) {
  const doc = await io.read(input);
  const start = performance.now();
  if (mode !== 'original') await doc.transform(dedup(), prune(), weld());
  if (mode === 'webp-1024') await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:85}));
  if (mode !== 'original') await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}));
  const bytes = mode === 'original' ? await fs.readFile(input) : await io.writeBinary(doc);
  const ms = Math.round(performance.now()-start);
  const destination = path.join(output, `${mode}.glb`);
  if (mode !== 'original') await fs.writeFile(destination, bytes);
  const validation = await validator.validateBytes(bytes,{maxIssues:10000});
  await fs.writeFile(path.join(output,`${mode}-validation.json`),JSON.stringify(validation,null,2));
  // Read compressed output through its real decoder, then export an uncompressed copy for Blender inspection.
  const decoded = await io.readBinary(bytes);
  if (mode !== 'original') {
    for (const ext of decoded.getRoot().listExtensionsUsed()) if (ext.extensionName === 'EXT_meshopt_compression') ext.dispose();
    const decodedBytes = await io.writeBinary(decoded);
    await fs.writeFile(path.join(output,`${mode}-decoded.glb`),decodedBytes);
    await fs.writeFile(path.join(output,`${mode}-decoded-validation.json`),JSON.stringify(await validator.validateBytes(decodedBytes,{maxIssues:10000}),null,2));
  }
  const row = {mode,bytes:bytes.length,processingMs:ms,...stats(decoded),validation:{errors:validation.issues.numErrors,warnings:validation.issues.numWarnings,truncated:validation.issues.truncated}};
  report.push(row); console.log(JSON.stringify(row));
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
