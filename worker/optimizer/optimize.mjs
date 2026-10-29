import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import validator from 'gltf-validator';

export async function optimize(source, destination, { maxTextureSize = 2048, quality = 89 } = {}) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
  });
  const input = await fs.readFile(source);
  const doc = await io.readBinary(input);
  await doc.transform(dedup(), prune(), weld(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [maxTextureSize, maxTextureSize], quality }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const bytes = await io.writeBinary(doc);
  // Validate actual decoded geometry: the Khronos validator cannot inspect Meshopt buffers directly.
  const decoded = await io.readBinary(bytes);
  for (const ext of decoded.getRoot().listExtensionsUsed())
    if (ext.extensionName === 'EXT_meshopt_compression') ext.dispose();
  const validation = await validator.validateBytes(await io.writeBinary(decoded), { maxIssues: 10000 });
  if (validation.issues.numErrors || validation.issues.truncated)
    throw new Error('Optimized model failed validation: ' + JSON.stringify(validation.issues.messages.slice(0, 5)));
  const root = decoded.getRoot();
  if (!root.listMeshes().length || !root.listTextures().length) throw new Error('Model has no meshes or textures');
  await fs.writeFile(destination, bytes, { flag: 'wx' });
  return {
    sourceBytes: input.length, bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    compression: { geometry: 'EXT_meshopt_compression', textures: 'EXT_texture_webp', maxTextureSize, quality },
    meshes: root.listMeshes().length, skins: root.listSkins().length,
    validation: validation.issues,
  };
}
