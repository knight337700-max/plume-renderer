import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SOURCE_SHA256 = "0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66";
const SOURCE_SIZE_BYTES = 28_427_796;
const CHECKSUM_MAGIC = 0xb1b0afba;
const REQUIRED_FACES = [
  { role: "regular", index: 0, postScriptName: "AppleSDGothicNeo-Regular", version: "19.0d2e1", fileName: "AppleSDGothicNeo-macOS19-Regular.otf" },
  { role: "semibold", index: 4, postScriptName: "AppleSDGothicNeo-SemiBold", version: "19.0d2e1", fileName: "AppleSDGothicNeo-macOS19-SemiBold.otf" },
  { role: "bold", index: 6, postScriptName: "AppleSDGothicNeo-Bold", version: "19.0d2e1", fileName: "AppleSDGothicNeo-macOS19-Bold.otf" },
];

function argument(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function align4(value) {
  return (value + 3) & ~3;
}

function sumUInt32(bytes) {
  let sum = 0;
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const a = bytes[offset] ?? 0;
    const b = bytes[offset + 1] ?? 0;
    const c = bytes[offset + 2] ?? 0;
    const d = bytes[offset + 3] ?? 0;
    sum = (sum + (((a << 24) >>> 0) + (b << 16) + (c << 8) + d)) >>> 0;
  }
  return sum;
}

function decodeName(bytes, platformId) {
  if (platformId === 0 || platformId === 3) {
    let value = "";
    for (let offset = 0; offset + 1 < bytes.length; offset += 2) value += String.fromCharCode(bytes.readUInt16BE(offset));
    return value.replaceAll("\u0000", "").trim();
  }
  return bytes.toString("latin1").replaceAll("\u0000", "").trim();
}

function tableRecords(bytes, faceOffset) {
  const signature = bytes.toString("latin1", faceOffset, faceOffset + 4);
  if (!new Set(["OTTO", "true", "typ1", "\u0000\u0001\u0000\u0000"]).has(signature)) throw new Error(`Unsupported sfnt signature at face offset ${faceOffset}: ${JSON.stringify(signature)}`);
  const count = bytes.readUInt16BE(faceOffset + 4);
  if (count < 1 || count > 4096) throw new Error(`Invalid table count at face offset ${faceOffset}: ${count}`);
  return Array.from({ length: count }, (_, index) => {
    const recordOffset = faceOffset + 12 + (index * 16);
    const tag = bytes.toString("latin1", recordOffset, recordOffset + 4);
    const checksum = bytes.readUInt32BE(recordOffset + 4);
    const offset = bytes.readUInt32BE(recordOffset + 8);
    const length = bytes.readUInt32BE(recordOffset + 12);
    if (offset + length > bytes.length) throw new Error(`Table ${tag} escapes collection bytes`);
    return { tag, checksum, offset, length };
  });
}

function faceInventory(bytes, index, faceOffset) {
  const tables = tableRecords(bytes, faceOffset);
  const byTag = new Map(tables.map((table) => [table.tag, table]));
  const names = new Map();
  const name = byTag.get("name");
  if (!name) throw new Error(`Face ${index} has no name table`);
  const count = bytes.readUInt16BE(name.offset + 2);
  const stringsOffset = bytes.readUInt16BE(name.offset + 4);
  for (let nameIndex = 0; nameIndex < count; nameIndex += 1) {
    const recordOffset = name.offset + 6 + (nameIndex * 12);
    const platformId = bytes.readUInt16BE(recordOffset);
    const nameId = bytes.readUInt16BE(recordOffset + 6);
    const length = bytes.readUInt16BE(recordOffset + 8);
    const valueOffset = bytes.readUInt16BE(recordOffset + 10);
    const start = name.offset + stringsOffset + valueOffset;
    const value = decodeName(bytes.subarray(start, start + length), platformId);
    if (!value) continue;
    const values = names.get(nameId) ?? new Set();
    values.add(value);
    names.set(nameId, values);
  }
  const values = (nameId) => [...(names.get(nameId) ?? [])].sort();
  const head = byTag.get("head");
  const maxp = byTag.get("maxp");
  return {
    index,
    faceOffset,
    sfntVersion: bytes.toString("latin1", faceOffset, faceOffset + 4),
    postScriptNames: values(6),
    familyNames: values(1),
    subfamilyNames: values(2),
    fullNames: values(4),
    versions: values(5),
    unitsPerEm: head ? bytes.readUInt16BE(head.offset + 18) : null,
    glyphCount: maxp ? bytes.readUInt16BE(maxp.offset + 4) : null,
    outlineFormat: byTag.has("CFF2") ? "CFF2" : byTag.has("CFF ") ? "CFF" : byTag.has("glyf") ? "GLYF" : "UNKNOWN",
    tableCount: tables.length,
    tableTags: tables.map((table) => table.tag).sort(),
  };
}

function collectionInventory(bytes) {
  if (bytes.toString("latin1", 0, 4) !== "ttcf") throw new Error("Source is not a TrueType/OpenType collection");
  const faceCount = bytes.readUInt32BE(8);
  if (faceCount < 1 || faceCount > 4096) throw new Error(`Invalid collection face count: ${faceCount}`);
  const offsets = Array.from({ length: faceCount }, (_, index) => bytes.readUInt32BE(12 + (index * 4)));
  return { signature: "ttcf", faceCount, faces: offsets.map((offset, index) => faceInventory(bytes, index, offset)) };
}

function normalizedTableBytes(bytes, table) {
  const value = Buffer.from(bytes.subarray(table.offset, table.offset + table.length));
  if (table.tag === "head" && value.length >= 12) value.writeUInt32BE(0, 8);
  return value;
}

function extractFace(bytes, faceOffset) {
  const records = tableRecords(bytes, faceOffset);
  const directoryEnd = 12 + (records.length * 16);
  let nextOffset = align4(directoryEnd);
  const materialized = records.map((record) => {
    const data = normalizedTableBytes(bytes, record);
    const result = { ...record, data, outputOffset: nextOffset, outputChecksum: sumUInt32(data) };
    nextOffset = align4(nextOffset + data.length);
    return result;
  });
  const output = Buffer.alloc(nextOffset);
  bytes.copy(output, 0, faceOffset, faceOffset + 12);
  for (const [index, table] of materialized.entries()) {
    const directoryOffset = 12 + (index * 16);
    output.write(table.tag, directoryOffset, 4, "latin1");
    output.writeUInt32BE(table.outputChecksum, directoryOffset + 4);
    output.writeUInt32BE(table.outputOffset, directoryOffset + 8);
    output.writeUInt32BE(table.length, directoryOffset + 12);
    table.data.copy(output, table.outputOffset);
  }
  const head = materialized.find((table) => table.tag === "head");
  if (!head || head.length < 12) throw new Error("Extracted face has no valid head table");
  const adjustment = (CHECKSUM_MAGIC - sumUInt32(output)) >>> 0;
  output.writeUInt32BE(adjustment, head.outputOffset + 8);
  if (sumUInt32(output) !== CHECKSUM_MAGIC) throw new Error("Standalone face checksum adjustment failed");
  return output;
}

function tableEquivalence(source, sourceFaceOffset, derived) {
  const sourceTables = new Map(tableRecords(source, sourceFaceOffset).map((table) => [table.tag, table]));
  const derivedTables = new Map(tableRecords(derived, 0).map((table) => [table.tag, table]));
  const tags = [...new Set([...sourceTables.keys(), ...derivedTables.keys()])].sort();
  return tags.map((tag) => {
    const sourceTable = sourceTables.get(tag);
    const derivedTable = derivedTables.get(tag);
    if (!sourceTable || !derivedTable) return { tag, status: "MISSING", sourcePresent: Boolean(sourceTable), derivedPresent: Boolean(derivedTable) };
    const sourceBytes = normalizedTableBytes(source, sourceTable);
    const derivedBytes = normalizedTableBytes(derived, derivedTable);
    const identical = sourceBytes.equals(derivedBytes);
    return {
      tag,
      status: identical ? (tag === "head" ? "SEMANTICALLY_IDENTICAL_CHECKSUM_ADJUSTMENT_ONLY" : "IDENTICAL") : "MISMATCH",
      sourceSha256: digest(sourceBytes),
      derivedSha256: digest(derivedBytes),
      length: sourceBytes.length,
    };
  });
}

const sourcePath = path.resolve(argument("source", "assets/fonts/naver-smartchannel/AppleSDGothicNeo.ttc"));
const outputDir = path.resolve(argument("output-dir", "assets/fonts/naver-smartchannel"));
const inventoryPath = path.resolve(argument("inventory", "artifacts/n7-7-4/ttc-face-inventory.json"));
const equivalencePath = path.resolve(argument("equivalence", "artifacts/n7-7-4/derived-face-equivalence.json"));
const source = fs.readFileSync(sourcePath);
const sourceDigest = digest(source);
if (source.length !== SOURCE_SIZE_BYTES || sourceDigest !== SOURCE_SHA256) throw new Error(`BLOCKED_SOURCE_TTC_MISMATCH expected=${SOURCE_SIZE_BYTES}/${SOURCE_SHA256} actual=${source.length}/${sourceDigest}`);

const inventory = collectionInventory(source);
for (const required of REQUIRED_FACES) {
  const face = inventory.faces[required.index];
  if (!face || !face.postScriptNames.includes(required.postScriptName) || !face.versions.includes(required.version)) throw new Error(`Required face mismatch: ${JSON.stringify({ required, actual: face ?? null })}`);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(path.dirname(inventoryPath), { recursive: true });
const derived = [];
for (const required of REQUIRED_FACES) {
  const sourceFace = inventory.faces[required.index];
  const output = extractFace(source, sourceFace.faceOffset);
  const outputPath = path.join(outputDir, required.fileName);
  fs.writeFileSync(outputPath, output);
  const extractedInventory = faceInventory(output, 0, 0);
  const equivalence = tableEquivalence(source, sourceFace.faceOffset, output);
  const mismatches = equivalence.filter((table) => !new Set(["IDENTICAL", "SEMANTICALLY_IDENTICAL_CHECKSUM_ADJUSTMENT_ONLY"]).has(table.status));
  if (!extractedInventory.postScriptNames.includes(required.postScriptName) || extractedInventory.unitsPerEm !== sourceFace.unitsPerEm || extractedInventory.glyphCount !== sourceFace.glyphCount || mismatches.length > 0) throw new Error(`Derived face equivalence failed: ${JSON.stringify({ required, extractedInventory, mismatches })}`);
  derived.push({
    role: required.role,
    outputPath: path.relative(process.cwd(), outputPath).replaceAll("\\", "/"),
    sizeBytes: output.length,
    sha256: digest(output),
    postScriptName: required.postScriptName,
    version: required.version,
    sourceFaceIndex: required.index,
    unitsPerEm: extractedInventory.unitsPerEm,
    glyphCount: extractedInventory.glyphCount,
    outlineFormat: extractedInventory.outlineFormat,
    tableEquivalence: equivalence,
  });
}

const inventoryEvidence = {
  phase: "N7_7_4_MACOS_ORIGINAL_TTC_RENDERER_INTEGRATION",
  source: { fileName: path.basename(sourcePath), sizeBytes: source.length, sha256: sourceDigest, type: "MACOS_ORIGINAL_TTC" },
  ...inventory,
};
const equivalenceEvidence = {
  phase: "N7_7_4_MACOS_ORIGINAL_TTC_RENDERER_INTEGRATION",
  integrationMode: "VERIFIED_DERIVED_STANDALONE_FACE",
  sourceCollectionSha256: sourceDigest,
  extractionTool: "scripts/extract-apple-sd-gothic-neo-ttc.mjs",
  extractionToolVersion: "1.0.0",
  mutationPolicy: "SFNT table bytes are copied byte-for-byte; only head.checkSumAdjustment changes for standalone packaging",
  derived,
};
fs.writeFileSync(inventoryPath, `${JSON.stringify(inventoryEvidence, null, 2)}\n`);
fs.writeFileSync(equivalencePath, `${JSON.stringify(equivalenceEvidence, null, 2)}\n`);
console.log(JSON.stringify({ status: "PASS", source: inventoryEvidence.source, requiredFaces: derived.map(({ role, outputPath, sizeBytes, sha256, postScriptName, sourceFaceIndex }) => ({ role, outputPath, sizeBytes, sha256, postScriptName, sourceFaceIndex })) }, null, 2));
