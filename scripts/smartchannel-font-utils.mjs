import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

function uint16(bytes, offset) {
  return offset + 2 <= bytes.length ? bytes.readUInt16BE(offset) : null;
}

function int16(bytes, offset) {
  return offset + 2 <= bytes.length ? bytes.readInt16BE(offset) : null;
}

function uint32(bytes, offset) {
  return offset + 4 <= bytes.length ? bytes.readUInt32BE(offset) : null;
}

function decodeUtf16Be(bytes) {
  let value = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) value += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
  return value.replaceAll("\u0000", "").trim();
}

function readNameValue(bytes, platformId) {
  if (platformId === 0 || platformId === 3) return decodeUtf16Be(bytes);
  return bytes.toString("utf8").replaceAll("\u0000", "").trim();
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function tableDirectory(bytes) {
  const signature = bytes.subarray(0, 4).toString("latin1");
  if (!["OTTO", "true", "typ1", "\u0001\u0000\u0000"].includes(signature) && !signature.startsWith("\u0000\u0001")) return null;
  const tableCount = uint16(bytes, 4);
  if (tableCount === null || tableCount > 4096) return null;
  const tables = new Map();
  for (let index = 0; index < tableCount; index += 1) {
    const rowOffset = 12 + (index * 16);
    const tag = bytes.subarray(rowOffset, rowOffset + 4).toString("latin1");
    const offset = uint32(bytes, rowOffset + 8);
    const length = uint32(bytes, rowOffset + 12);
    if (offset === null || length === null || offset + length > bytes.length) return null;
    tables.set(tag, { offset, length });
  }
  return tables;
}

function parseNames(bytes, nameTable) {
  const format = uint16(bytes, nameTable.offset);
  const count = uint16(bytes, nameTable.offset + 2);
  const stringOffset = uint16(bytes, nameTable.offset + 4);
  if (format === null || count === null || stringOffset === null || count > 8192) return null;
  const values = new Map();
  const records = [];
  for (let index = 0; index < count; index += 1) {
    const offset = nameTable.offset + 6 + (index * 12);
    const platformId = uint16(bytes, offset);
    const encodingId = uint16(bytes, offset + 2);
    const languageId = uint16(bytes, offset + 4);
    const nameId = uint16(bytes, offset + 6);
    const length = uint16(bytes, offset + 8);
    const valueOffset = uint16(bytes, offset + 10);
    if ([platformId, encodingId, languageId, nameId, length, valueOffset].some((value) => value === null)) return null;
    const start = nameTable.offset + stringOffset + valueOffset;
    if (start + length > nameTable.offset + nameTable.length) return null;
    const value = readNameValue(bytes.subarray(start, start + length), platformId);
    if (!value) continue;
    const set = values.get(nameId) ?? new Set();
    set.add(value);
    values.set(nameId, set);
    records.push({ platformId, encodingId, languageId, nameId, value });
  }
  return { records, values };
}

function parseCmap(bytes, table) {
  const version = uint16(bytes, table.offset);
  const count = uint16(bytes, table.offset + 2);
  if (version === null || count === null || count > 256) return null;
  const mapping = new Map();
  const records = [];
  for (let index = 0; index < count; index += 1) {
    const offset = table.offset + 4 + (index * 8);
    const platformId = uint16(bytes, offset);
    const encodingId = uint16(bytes, offset + 2);
    const relativeOffset = uint32(bytes, offset + 4);
    if ([platformId, encodingId, relativeOffset].some((value) => value === null)) return null;
    const subtableOffset = table.offset + relativeOffset;
    const format = uint16(bytes, subtableOffset);
    records.push({ platformId, encodingId, format });
    if (format === 4) {
      const length = uint16(bytes, subtableOffset + 2);
      const segmentsX2 = uint16(bytes, subtableOffset + 6);
      if (length === null || segmentsX2 === null) return null;
      const segmentCount = segmentsX2 / 2;
      const endCode = subtableOffset + 14;
      const startCode = endCode + segmentsX2 + 2;
      const idDelta = startCode + segmentsX2;
      const idRangeOffset = idDelta + segmentsX2;
      for (let segment = 0; segment < segmentCount; segment += 1) {
        const end = uint16(bytes, endCode + (segment * 2));
        const start = uint16(bytes, startCode + (segment * 2));
        const delta = int16(bytes, idDelta + (segment * 2));
        const rangeOffset = uint16(bytes, idRangeOffset + (segment * 2));
        if ([end, start, delta, rangeOffset].some((value) => value === null)) return null;
        for (let codePoint = start; codePoint <= end && codePoint !== 0xffff; codePoint += 1) {
          let glyphId;
          if (rangeOffset === 0) glyphId = (codePoint + delta) & 0xffff;
          else {
            const glyphOffset = idRangeOffset + (segment * 2) + rangeOffset + ((codePoint - start) * 2);
            if (glyphOffset + 2 > subtableOffset + length) continue;
            glyphId = uint16(bytes, glyphOffset);
            if (glyphId !== null && glyphId !== 0) glyphId = (glyphId + delta) & 0xffff;
          }
          if (glyphId !== null && glyphId !== 0) mapping.set(codePoint, glyphId);
        }
      }
    } else if (format === 12) {
      const length = uint32(bytes, subtableOffset + 4);
      const groupCount = uint32(bytes, subtableOffset + 12);
      if (length === null || groupCount === null || groupCount > 1_000_000) return null;
      for (let group = 0; group < groupCount; group += 1) {
        const groupOffset = subtableOffset + 16 + (group * 12);
        const start = uint32(bytes, groupOffset);
        const end = uint32(bytes, groupOffset + 4);
        const glyphStart = uint32(bytes, groupOffset + 8);
        if ([start, end, glyphStart].some((value) => value === null)) return null;
        for (let codePoint = start; codePoint <= end; codePoint += 1) mapping.set(codePoint, glyphStart + (codePoint - start));
      }
    }
  }
  return { mapping, records };
}

function parseGlyphs(bytes, tables, glyphCount, indexToLocFormat) {
  const loca = tables.get("loca");
  const glyf = tables.get("glyf");
  if (!loca || !glyf) return null;
  const offsets = [];
  for (let index = 0; index <= glyphCount; index += 1) {
    const offset = indexToLocFormat === 0 ? uint16(bytes, loca.offset + (index * 2)) : uint32(bytes, loca.offset + (index * 4));
    if (offset === null) return null;
    offsets.push(indexToLocFormat === 0 ? offset * 2 : offset);
  }
  const outlineKind = [];
  const bounds = [];
  for (let index = 0; index < glyphCount; index += 1) {
    const start = offsets[index];
    const end = offsets[index + 1];
    if (start === end) {
      outlineKind.push("EMPTY");
      bounds.push(null);
    }
    else {
      const contours = int16(bytes, glyf.offset + start);
      outlineKind.push(contours === null ? "INVALID" : contours < 0 ? "COMPOSITE" : "SIMPLE");
      bounds.push(contours === null ? null : {
        xMin: int16(bytes, glyf.offset + start + 2),
        yMin: int16(bytes, glyf.offset + start + 4),
        xMax: int16(bytes, glyf.offset + start + 6),
        yMax: int16(bytes, glyf.offset + start + 8),
      });
    }
  }
  return { offsets, outlineKind, bounds };
}

export function parseFontFile(filePath) {
  const bytes = readFileSync(filePath);
  const tables = tableDirectory(bytes);
  if (!tables) throw new Error(`Unsupported OpenType font: ${filePath}`);
  const table = (tag) => tables.get(tag);
  const nameTable = table("name");
  const head = table("head");
  const hhea = table("hhea");
  const maxp = table("maxp");
  const os2 = table("OS/2");
  const cmapTable = table("cmap");
  if (!nameTable || !head || !hhea || !maxp || !os2 || !cmapTable) throw new Error(`Required OpenType tables missing: ${filePath}`);
  const names = parseNames(bytes, nameTable);
  const cmap = parseCmap(bytes, cmapTable);
  if (!names || !cmap) throw new Error(`Unable to parse OpenType names/cmap: ${filePath}`);
  const glyphCount = uint16(bytes, maxp.offset + 4);
  const indexToLocFormat = int16(bytes, head.offset + 50);
  const numOfLongHorMetrics = uint16(bytes, hhea.offset + 34);
  const unitsPerEm = uint16(bytes, head.offset + 18);
  if ([glyphCount, indexToLocFormat, numOfLongHorMetrics, unitsPerEm].some((value) => value === null)) throw new Error(`Invalid OpenType metrics: ${filePath}`);
  const glyphs = parseGlyphs(bytes, tables, glyphCount, indexToLocFormat);
  if (!glyphs) throw new Error(`Unable to parse OpenType glyph outlines: ${filePath}`);
  const hmtx = table("hmtx");
  if (!hmtx) throw new Error(`hmtx table missing: ${filePath}`);
  const advances = [];
  const leftSideBearings = [];
  for (let index = 0; index < glyphCount; index += 1) {
    const metricIndex = Math.min(index, numOfLongHorMetrics - 1);
    const advance = uint16(bytes, hmtx.offset + (metricIndex * 4));
    const lsbOffset = hmtx.offset + (numOfLongHorMetrics * 4) + ((index - numOfLongHorMetrics) * 2);
    const lsb = index < numOfLongHorMetrics ? int16(bytes, hmtx.offset + (index * 4) + 2) : int16(bytes, lsbOffset);
    if (advance === null || lsb === null) throw new Error(`Invalid hmtx metrics: ${filePath}`);
    advances.push(advance);
    leftSideBearings.push(lsb);
  }
  const nameValues = (id) => [...(names.values.get(id) ?? new Set())].sort();
  const tableDigests = Object.fromEntries([...tables.keys()].sort().map((tag) => [tag, digest(bytes.subarray(tables.get(tag).offset, tables.get(tag).offset + tables.get(tag).length))]));
  return {
    filePath,
    bytes: bytes.length,
    sha256: digest(bytes),
    tableDigests,
    names: {
      family: nameValues(1),
      subfamily: nameValues(2),
      full: nameValues(4),
      version: nameValues(5),
      postScript: nameValues(6),
      records: names.records,
    },
    metrics: {
      unitsPerEm,
      indexToLocFormat,
      numberOfGlyphs: glyphCount,
      numberOfLongHorMetrics: numOfLongHorMetrics,
      hheaAscender: int16(bytes, hhea.offset + 4),
      hheaDescender: int16(bytes, hhea.offset + 6),
      hheaLineGap: int16(bytes, hhea.offset + 8),
      os2WeightClass: uint16(bytes, os2.offset + 4),
      os2WidthClass: uint16(bytes, os2.offset + 6),
      os2TypoAscender: int16(bytes, os2.offset + 68),
      os2TypoDescender: int16(bytes, os2.offset + 70),
      os2TypoLineGap: int16(bytes, os2.offset + 72),
      os2WinAscent: uint16(bytes, os2.offset + 74),
      os2WinDescent: uint16(bytes, os2.offset + 76),
      advances,
      leftSideBearings,
    },
    cmap: cmap.mapping,
    cmapRecords: cmap.records,
    outlineKind: glyphs.outlineKind,
    glyphBounds: glyphs.bounds,
  };
}

export function digestTable(font, tag) {
  return font.tableDigests[tag] ?? null;
}

export function codePointsFromText(text) {
  return [...String(text ?? "")].map((character) => character.codePointAt(0)).filter((codePoint) => codePoint !== undefined);
}

export function isRenderableCodePoint(codePoint) {
  return codePoint !== 9 && codePoint !== 10 && codePoint !== 13 && codePoint !== 0x200b;
}

export function sourceCodePoints(metadata) {
  const set = new Set();
  for (const template of metadata.templates ?? []) for (const layer of template.textLayers ?? []) {
    for (const codePoint of codePointsFromText(layer.text)) if (isRenderableCodePoint(codePoint)) set.add(codePoint);
  }
  return [...set].sort((left, right) => left - right);
}

export function glyphMetrics(font, text, fontSizePx, trackingThousandthsEm = 0) {
  const codePoints = codePointsFromText(text).filter(isRenderableCodePoint);
  const missingCodePoints = [];
  let advanceUnits = 0;
  let inkMinUnits = null;
  let inkMaxUnits = null;
  const glyphIds = [];
  for (const codePoint of codePoints) {
    const glyphId = font.cmap.get(codePoint) ?? 0;
    glyphIds.push(glyphId);
    if (glyphId === 0 || font.outlineKind[glyphId] === "INVALID") missingCodePoints.push(codePoint);
    const glyphBounds = font.glyphBounds[glyphId];
    if (glyphBounds) {
      const glyphOrigin = advanceUnits + (glyphIds.length - 1) * trackingThousandthsEm;
      inkMinUnits = inkMinUnits === null ? glyphOrigin + glyphBounds.xMin : Math.min(inkMinUnits, glyphOrigin + glyphBounds.xMin);
      inkMaxUnits = inkMaxUnits === null ? glyphOrigin + glyphBounds.xMax : Math.max(inkMaxUnits, glyphOrigin + glyphBounds.xMax);
    }
    advanceUnits += font.metrics.advances[glyphId] ?? 0;
  }
  const trackingUnits = Math.max(0, codePoints.length - 1) * trackingThousandthsEm;
  const occupiedUnits = inkMinUnits === null || inkMaxUnits === null ? advanceUnits + trackingUnits : inkMaxUnits - inkMinUnits;
  const scale = fontSizePx / font.metrics.unitsPerEm;
  const lineAscentUnits = font.metrics.os2TypoAscender ?? font.metrics.hheaAscender;
  const lineDescentUnits = Math.abs(font.metrics.os2TypoDescender ?? font.metrics.hheaDescender);
  return {
    codePointCount: codePoints.length,
    glyphIds,
    missingCodePoints,
    advanceWidthPx: Number((advanceUnits * scale).toFixed(6)),
    trackingWidthPx: Number((trackingUnits * scale).toFixed(6)),
    occupiedWidthPx: Number((occupiedUnits * scale).toFixed(6)),
    ascentPx: Number((lineAscentUnits * scale).toFixed(6)),
    descentPx: Number((lineDescentUnits * scale).toFixed(6)),
    lineBoxPx: Number(((lineAscentUnits + lineDescentUnits + (font.metrics.os2TypoLineGap ?? font.metrics.hheaLineGap)) * scale).toFixed(6)),
  };
}
