// Build an optimized book.glb procedurally with @gltf-transform.
// Output: /tmp/book.glb (then uploaded to Lovable Assets by the caller).
//
// Optimizations applied:
//  - dedup (buffers/accessors/materials)
//  - weld (merge duplicate vertices)
//  - prune (remove unused nodes/materials)
//  - Draco geometry compression (high quality preset)

import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { dedup, prune, weld, draco } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { writeFileSync } from "node:fs";

// --- Build a raw glTF with a few box primitives ------------------------------

function boxGeometry(w, h, d) {
  const x = w / 2, y = h / 2, z = d / 2;
  // 8 unique corners, but we duplicate per face to keep flat normals.
  // Each face: 4 verts + 2 tris.
  const positions = [];
  const normals = [];
  const indices = [];

  const faces = [
    // +X
    { n: [1, 0, 0], v: [[x, -y, -z], [x, y, -z], [x, y, z], [x, -y, z]] },
    // -X
    { n: [-1, 0, 0], v: [[-x, -y, z], [-x, y, z], [-x, y, -z], [-x, -y, -z]] },
    // +Y
    { n: [0, 1, 0], v: [[-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z]] },
    // -Y
    { n: [0, -1, 0], v: [[-x, -y, z], [-x, -y, -z], [x, -y, -z], [x, -y, z]] },
    // +Z
    { n: [0, 0, 1], v: [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]] },
    // -Z
    { n: [0, 0, -1], v: [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]] },
  ];

  let base = 0;
  for (const f of faces) {
    for (const p of f.v) {
      positions.push(...p);
      normals.push(...f.n);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }

  return {
    position: new Float32Array(positions),
    normal: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

const io = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression])
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

const { Document } = await import("@gltf-transform/core");
const doc = new Document();
const buffer = doc.createBuffer();

function addPrimitive(name, geom) {
  const posAcc = doc.createAccessor(`${name}_pos`)
    .setArray(geom.position).setType("VEC3").setBuffer(buffer);
  const nrmAcc = doc.createAccessor(`${name}_nrm`)
    .setArray(geom.normal).setType("VEC3").setBuffer(buffer);
  const idxAcc = doc.createAccessor(`${name}_idx`)
    .setArray(geom.indices).setType("SCALAR").setBuffer(buffer);
  const prim = doc.createPrimitive()
    .setAttribute("POSITION", posAcc)
    .setAttribute("NORMAL", nrmAcc)
    .setIndices(idxAcc);
  return prim;
}

function makeMat(name, baseColor, metallic, roughness, emissive) {
  const mat = doc.createMaterial(name)
    .setBaseColorFactor(baseColor)
    .setMetallicFactor(metallic)
    .setRoughnessFactor(roughness);
  if (emissive) mat.setEmissiveFactor(emissive);
  return mat;
}

const coverMat = makeMat("cover", [0.169, 0.118, 0.361, 1], 0.35, 0.45, [0.09, 0.075, 0.24]);
const pagesMat = makeMat("pages", [0.957, 0.937, 0.902, 1], 0.0, 0.9);
const spineMat = makeMat("spine", [0.788, 0.635, 0.294, 1], 0.8, 0.35, [0.20, 0.16, 0.06]);

const scene = doc.createScene("book");
const root = doc.createNode("BookRoot");
scene.addChild(root);

function addBox(name, size, pos, mat) {
  const geom = boxGeometry(...size);
  const prim = addPrimitive(name, geom).setMaterial(mat);
  const mesh = doc.createMesh(name).addPrimitive(prim);
  const node = doc.createNode(name).setMesh(mesh).setTranslation(pos);
  root.addChild(node);
}

// Top cover, bottom cover, pages block, spine, decorative band.
addBox("cover_top", [2.2, 0.08, 3.0], [0, 0.28, 0], coverMat);
addBox("cover_bottom", [2.2, 0.08, 3.0], [0, -0.28, 0], coverMat);
addBox("pages", [2.1, 0.48, 2.92], [0.03, 0, 0], pagesMat);
addBox("spine", [0.12, 0.6, 3.0], [-1.05, 0, 0], spineMat);
addBox("band", [0.6, 0.01, 2.4], [0.4, 0.33, 0], spineMat);

// --- Optimize --------------------------------------------------------------
await doc.transform(
  weld({ tolerance: 0.0001 }),
  dedup(),
  prune(),
);

// Enable Draco compression.
doc.createExtension(KHRDracoMeshCompression)
  .setRequired(true)
  .setEncoderOptions({
    method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
    encodeSpeed: 5,
    decodeSpeed: 5,
  });

await doc.transform(draco());

const glb = await io.writeBinary(doc);
writeFileSync("/tmp/book.glb", glb);
console.log(`book.glb written: ${glb.byteLength} bytes`);
