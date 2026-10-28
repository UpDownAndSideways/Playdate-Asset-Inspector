/**
 * @license
 * Playdate Asset Parser, PDI Decoder, PDT Spritesheet Decoder, and PNG Exporter
 * Grounded in cranksters/playdate-reverse-engineering (tools/pdi2png.py, formats/pdi.md, formats/pdt.md, tools/pdz.py)
 */

import { unzlibSync, inflateSync, zlibSync, zipSync } from 'fflate';
import { crc32 } from './crc32';

export const PDI_IDENT_STRING = 'Playdate IMG';
export const PDT_IDENT_STRING = 'Playdate IMT';
export const PDZ_IDENT_STRING = 'Playdate PDZ';

export const PDI_IDENT = new TextEncoder().encode(PDI_IDENT_STRING);
export const PDT_IDENT = new TextEncoder().encode(PDT_IDENT_STRING);
export const PDZ_IDENT = new TextEncoder().encode(PDZ_IDENT_STRING);
export const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

export interface PlaydateCellHeader {
  clipWidth: number;
  clipHeight: number;
  stride: number;
  clipLeft: number;
  clipRight: number;
  clipTop: number;
  clipBottom: number;
  flags: number;
  hasAlpha: boolean;
}

export interface DecodedCell {
  index: number;
  header: PlaydateCellHeader;
  fullWidth: number;
  fullHeight: number;
  rows: Uint8Array[]; // Raw rows (8-bit grayscale or 8-bit grayscale+alpha)
  hasAlpha: boolean;
  rgbaPixels: Uint8ClampedArray; // Full-resolution RGBA pixel array (4 bytes per pixel)
  exactPngBytes: Uint8Array; // Exact binary PNG as output by pdi2png.py
  exactPngDataUrl?: string; // Precomputed data URL for instant <img> rendering
}

export interface PlaydateAsset {
  id: string;
  fileName: string;
  fileType: 'pdi' | 'pdt' | 'pdz_entry';
  ident: string;
  isCompressed: boolean;
  fileSizeBytes: number;
  decompressedSizeBytes?: number;
  compressionRatio?: number;
  cells: DecodedCell[];
  numCells: number;
  cellsPerRow?: number;
  containerSource?: string;
  metadata: {
    rawHeaderHex: string;
    width: number;
    height: number;
  };
}

/**
 * Resilient zlib decompression trying unzlib (RFC 1950) then raw inflate
 */
export function decompressData(data: Uint8Array): Uint8Array {
  try {
    return unzlibSync(data);
  } catch {
    try {
      return inflateSync(data);
    } catch (e2) {
      throw new Error(`Failed to decompress zlib stream: ${(e2 as Error).message}`);
    }
  }
}

/**
 * Create a standard PNG chunk with 4-byte length, 4-byte type, payload, and CRC32
 */
export function makePngChunk(typeStr: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(typeStr);
  const chunkLen = data.length;
  const chunkHeaderAndData = new Uint8Array(4 + chunkLen);
  chunkHeaderAndData.set(typeBytes, 0);
  chunkHeaderAndData.set(data, 4);

  const crc = crc32(chunkHeaderAndData);
  const out = new Uint8Array(4 + 4 + chunkLen + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, chunkLen, false); // Big-endian chunk size
  out.set(chunkHeaderAndData, 4);
  view.setUint32(8 + chunkLen, crc, false); // Big-endian CRC32
  return out;
}

/**
 * Encodes rows into a valid PNG byte stream using grayscale (type 0) or grayscale+alpha (type 4)
 * Faithfully matches Python write_png() from cranksters/playdate-reverse-engineering/tools/pdi2png.py
 */
export function encodePdiPngBinary(
  width: number,
  height: number,
  rows: Uint8Array[],
  hasAlpha: boolean
): Uint8Array {
  // color type: 0 = grayscale, 4 = grayscale+alpha
  const colorType = hasAlpha ? 4 : 0;
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdrView.setUint8(8, 8); // 8-bit depth
  ihdrView.setUint8(9, colorType);
  ihdrView.setUint8(10, 0); // compression: deflate
  ihdrView.setUint8(11, 0); // filter: standard adaptive
  ihdrView.setUint8(12, 0); // interlace: none

  // Build raw image data: filter byte (0=none) + row pixels
  const rowStride = rows[0]?.length || (width * (hasAlpha ? 2 : 1));
  const rawData = new Uint8Array(height * (1 + rowStride));
  let offset = 0;
  for (const row of rows) {
    rawData[offset++] = 0; // Filter byte 0 (None)
    rawData.set(row, offset);
    offset += row.length;
  }

  const compressedData = zlibSync(rawData);
  const ihdrChunk = makePngChunk('IHDR', ihdr);
  const idatChunk = makePngChunk('IDAT', compressedData);
  const iendChunk = makePngChunk('IEND', new Uint8Array(0));

  const totalLen = PNG_SIGNATURE.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const result = new Uint8Array(totalLen);
  let p = 0;
  result.set(PNG_SIGNATURE, p); p += PNG_SIGNATURE.length;
  result.set(ihdrChunk, p); p += ihdrChunk.length;
  result.set(idatChunk, p); p += idatChunk.length;
  result.set(iendChunk, p); p += iendChunk.length;
  return result;
}

/**
 * Reads an Image Cell from binary buffer at given offset
 * Reconstructs full image dimensions and returns raw rows, RGBA buffer, and cell header
 */
export function readCell(data: Uint8Array, offset: number, cellIndex = 0): { cell: DecodedCell; nextOffset: number } {
  if (offset + 16 > data.length) {
    throw new Error(`Unexpected end of data reading cell header at offset ${offset}`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const clipWidth = view.getUint16(offset + 0, true);
  const clipHeight = view.getUint16(offset + 2, true);
  const stride = view.getUint16(offset + 4, true);
  const clipLeft = view.getUint16(offset + 6, true);
  const clipRight = view.getUint16(offset + 8, true);
  const clipTop = view.getUint16(offset + 10, true);
  const clipBottom = view.getUint16(offset + 12, true);
  const flags = view.getUint16(offset + 14, true);

  const hasAlpha = (flags & 0x3) > 0;
  let curOffset = offset + 16;

  // Read color bitmap (1-bit, 0 = black, 1 = white)
  const colorSize = stride * clipHeight;
  if (curOffset + colorSize > data.length) {
    throw new Error(`Truncated color data in cell: need ${colorSize} bytes, have ${data.length - curOffset}`);
  }
  const colorData = data.subarray(curOffset, curOffset + colorSize);
  curOffset += colorSize;

  // Read alpha bitmap if present (1-bit, 0 = transparent, 1 = opaque)
  let alphaData: Uint8Array | null = null;
  if (hasAlpha) {
    if (curOffset + colorSize > data.length) {
      throw new Error(`Truncated alpha data in cell: need ${colorSize} bytes, have ${data.length - curOffset}`);
    }
    alphaData = data.subarray(curOffset, curOffset + colorSize);
    curOffset += colorSize;
  }

  const fullWidth = clipLeft + clipWidth + clipRight;
  const fullHeight = clipTop + clipHeight + clipBottom;

  if (fullWidth <= 0 || fullHeight <= 0) {
    throw new Error(`Invalid dimensions for cell: ${fullWidth}x${fullHeight}`);
  }

  // Construct raw rows (for pdi2png binary exporter) and RGBA buffer (for Canvas)
  const rows: Uint8Array[] = [];
  const rgbaPixels = new Uint8ClampedArray(fullWidth * fullHeight * 4);

  for (let y = 0; y < fullHeight; y++) {
    const row = new Uint8Array(hasAlpha ? fullWidth * 2 : fullWidth);
    if (!hasAlpha) {
      row.fill(255); // Default white outside clip
    }

    const cy = y - clipTop;
    const isInsideY = cy >= 0 && cy < clipHeight;

    for (let x = 0; x < fullWidth; x++) {
      const cx = x - clipLeft;
      const isInsideX = cx >= 0 && cx < clipWidth;
      const rgbaIdx = (y * fullWidth + x) * 4;

      if (isInsideY && isInsideX) {
        const byteIndex = cy * stride + Math.floor(cx / 8);
        const bitIndex = 7 - (cx % 8);

        const colorBit = (colorData[byteIndex] >> bitIndex) & 1;
        const colorVal = colorBit ? 255 : 0;

        if (hasAlpha && alphaData) {
          const alphaBit = (alphaData[byteIndex] >> bitIndex) & 1;
          const alphaVal = alphaBit ? 255 : 0;

          row[x * 2] = colorVal;
          row[x * 2 + 1] = alphaVal;

          rgbaPixels[rgbaIdx + 0] = colorVal;
          rgbaPixels[rgbaIdx + 1] = colorVal;
          rgbaPixels[rgbaIdx + 2] = colorVal;
          rgbaPixels[rgbaIdx + 3] = alphaVal;
        } else {
          row[x] = colorVal;

          rgbaPixels[rgbaIdx + 0] = colorVal;
          rgbaPixels[rgbaIdx + 1] = colorVal;
          rgbaPixels[rgbaIdx + 2] = colorVal;
          rgbaPixels[rgbaIdx + 3] = 255;
        }
      } else {
        // Outside cell clip bounding box
        if (hasAlpha) {
          row[x * 2] = 255;
          row[x * 2 + 1] = 0; // Fully transparent

          rgbaPixels[rgbaIdx + 0] = 0;
          rgbaPixels[rgbaIdx + 1] = 0;
          rgbaPixels[rgbaIdx + 2] = 0;
          rgbaPixels[rgbaIdx + 3] = 0;
        } else {
          row[x] = 255; // Default white

          rgbaPixels[rgbaIdx + 0] = 255;
          rgbaPixels[rgbaIdx + 1] = 255;
          rgbaPixels[rgbaIdx + 2] = 255;
          rgbaPixels[rgbaIdx + 3] = 255;
        }
      }
    }
    rows.push(row);
  }

  const exactPngBytes = encodePdiPngBinary(fullWidth, fullHeight, rows, hasAlpha);

  const header: PlaydateCellHeader = {
    clipWidth,
    clipHeight,
    stride,
    clipLeft,
    clipRight,
    clipTop,
    clipBottom,
    flags,
    hasAlpha,
  };

  return {
    cell: {
      index: cellIndex,
      header,
      fullWidth,
      fullHeight,
      rows,
      hasAlpha,
      rgbaPixels,
      exactPngBytes,
    },
    nextOffset: curOffset,
  };
}

/**
 * Decodes a Playdate Image (.pdi) file
 */
export function decodePdi(buffer: Uint8Array, fileName: string): PlaydateAsset {
  if (buffer.length < 16) {
    throw new Error('File is too small to be a valid Playdate Image');
  }

  const ident = new TextDecoder('ascii').decode(buffer.subarray(0, 12));
  if (ident !== PDI_IDENT_STRING) {
    throw new Error(`Not a valid PDI file (expected "${PDI_IDENT_STRING}", got "${ident}")`);
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const flags = view.getUint32(12, true);
  const isCompressed = (flags & 0x80000000) !== 0;

  let imageData: Uint8Array;
  let decompressedSize: number | undefined;
  let reportedWidth = 0;
  let reportedHeight = 0;

  if (isCompressed) {
    if (buffer.length < 32) {
      throw new Error('File truncated in compressed image header');
    }
    decompressedSize = view.getUint32(16, true);
    reportedWidth = view.getUint32(20, true);
    reportedHeight = view.getUint32(24, true);
    // reserved = view.getUint32(28, true);

    const compressedPayload = buffer.subarray(32);
    imageData = decompressData(compressedPayload);
  } else {
    imageData = buffer.subarray(16);
  }

  const { cell } = readCell(imageData, 0, 0);

  // Convert raw header hex for inspector
  const rawHeaderHex = Array.from(buffer.subarray(0, Math.min(32, buffer.length)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');

  return {
    id: `pdi-${Math.random().toString(36).substring(2, 9)}`,
    fileName,
    fileType: 'pdi',
    ident,
    isCompressed,
    fileSizeBytes: buffer.length,
    decompressedSizeBytes: decompressedSize || imageData.length + 16,
    compressionRatio: decompressedSize ? Number((buffer.length / decompressedSize).toFixed(2)) : 1,
    cells: [cell],
    numCells: 1,
    metadata: {
      rawHeaderHex,
      width: reportedWidth || cell.fullWidth,
      height: reportedHeight || cell.fullHeight,
    },
  };
}

/**
 * Decodes a Playdate Image Table (.pdt) file (sequential or matrix spritesheet)
 */
export function decodePdt(buffer: Uint8Array, fileName: string): PlaydateAsset {
  if (buffer.length < 16) {
    throw new Error('File is too small to be a valid Playdate Image Table');
  }

  const ident = new TextDecoder('ascii').decode(buffer.subarray(0, 12));
  if (ident !== PDT_IDENT_STRING) {
    throw new Error(`Not a valid PDT file (expected "${PDT_IDENT_STRING}", got "${ident}")`);
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const flags = view.getUint32(12, true);
  const isCompressed = (flags & 0x80000000) !== 0;

  let tableData: Uint8Array;
  let decompressedSize: number | undefined;
  let reportedWidth = 0;
  let reportedHeight = 0;
  let reportedNumCells = 0;

  if (isCompressed) {
    if (buffer.length < 32) {
      throw new Error('File truncated in compressed PDT header');
    }
    decompressedSize = view.getUint32(16, true);
    reportedWidth = view.getUint32(20, true);
    reportedHeight = view.getUint32(24, true);
    reportedNumCells = view.getUint32(28, true);

    const compressedPayload = buffer.subarray(32);
    tableData = decompressData(compressedPayload);
  } else {
    tableData = buffer.subarray(16);
  }

  const tableView = new DataView(tableData.buffer, tableData.byteOffset, tableData.byteLength);
  const numCells = tableView.getUint16(0, true);
  const cellsPerRow = tableView.getUint16(2, true);

  // Table has (numCells - 1) uint32 cell offsets + 1 uint32 end offset
  // Relative to the end of the table
  const tableHeaderBytes = 4;
  const tableOffsetsBytes = numCells * 4;
  const tableEnd = tableHeaderBytes + tableOffsetsBytes;

  const offsets: number[] = [0]; // First cell starts at offset 0
  for (let i = 0; i < numCells - 1; i++) {
    offsets.push(tableView.getUint32(tableHeaderBytes + i * 4, true));
  }
  // const endOffset = tableView.getUint32(tableHeaderBytes + (numCells - 1) * 4, true);

  const cells: DecodedCell[] = [];
  for (let i = 0; i < numCells; i++) {
    const cellOffset = tableEnd + offsets[i];
    const { cell } = readCell(tableData, cellOffset, i);
    cells.push(cell);
  }

  const rawHeaderHex = Array.from(buffer.subarray(0, Math.min(32, buffer.length)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');

  return {
    id: `pdt-${Math.random().toString(36).substring(2, 9)}`,
    fileName,
    fileType: 'pdt',
    ident,
    isCompressed,
    fileSizeBytes: buffer.length,
    decompressedSizeBytes: decompressedSize || tableData.length + 16,
    compressionRatio: decompressedSize ? Number((buffer.length / decompressedSize).toFixed(2)) : 1,
    cells,
    numCells,
    cellsPerRow,
    metadata: {
      rawHeaderHex,
      width: reportedWidth || (cells[0]?.fullWidth ?? 0),
      height: reportedHeight || (cells[0]?.fullHeight ?? 0),
    },
  };
}

/**
 * Unpacks .pdz (Playdate compiled game package) and extracts all .pdi and .pdt assets
 */
export function unpackPdz(buffer: Uint8Array, fileName: string): PlaydateAsset[] {
  if (buffer.length < 16) {
    throw new Error('File too small to be a PDZ container');
  }

  const magic = new TextDecoder('ascii').decode(buffer.subarray(0, 12));
  if (!magic.startsWith('Playdate PDZ')) {
    throw new Error(`Invalid PDZ file ident (got "${magic}")`);
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const flags = view.getUint32(12, true);
  const isEncrypted = (flags & 0x40000000) > 0;
  if (isEncrypted) {
    throw new Error('This PDZ archive is encrypted and cannot be unpacked');
  }

  const FILE_TYPES: Record<number, string> = {
    1: 'luac',
    2: 'pdi',
    3: 'pdt',
    4: 'pdv',
    5: 'pda',
    6: 'pds',
    7: 'pft',
  };

  const results: PlaydateAsset[] = [];
  let ptr = 0x10;
  const pdzLen = buffer.length;

  while (ptr < pdzLen) {
    if (ptr + 4 > pdzLen) break;
    const head = view.getUint32(ptr, true);
    ptr += 4;

    const entryFlags = head & 0xFF;
    let entryLen = (head >> 8) & 0xFFFFFF;
    const isCompressed = (entryFlags >> 7) & 0x1;
    const typeNum = entryFlags & 0xF;
    const fileType = FILE_TYPES[typeNum] || 'unknown';

    // Read null-terminated string
    let nameEnd = ptr;
    while (nameEnd < pdzLen && buffer[nameEnd] !== 0) {
      nameEnd++;
    }
    const entryName = new TextDecoder().decode(buffer.subarray(ptr, nameEnd));
    ptr = nameEnd + 1;

    // Align to multiple of 4
    ptr = (ptr + 3) & ~3;

    if (fileType === 'pda') {
      entryLen -= 4;
      ptr += 4; // Audio info
    }

    let decompressedSize = entryLen;
    if (isCompressed) {
      if (ptr + 4 > pdzLen) break;
      decompressedSize = view.getUint32(ptr, true);
      ptr += 4;
      entryLen -= 4;
    }

    if (ptr + entryLen > pdzLen) break;
    const rawData = buffer.subarray(ptr, ptr + entryLen);
    ptr += entryLen;

    // Only process image assets (.pdi and .pdt)
    if (fileType === 'pdi' || fileType === 'pdt') {
      try {
        const decompressed = isCompressed ? decompressData(rawData) : rawData;
        
        if (fileType === 'pdi') {
          // If decompressed directly from PDZ, it usually consists of the Cell data directly
          // or has the Playdate IMG header. Let's inspect:
          let pdiAsset: PlaydateAsset;
          const hasIdent = new TextDecoder('ascii').decode(decompressed.subarray(0, 12)) === PDI_IDENT_STRING;

          if (hasIdent) {
            pdiAsset = decodePdi(decompressed, `${entryName}.pdi`);
          } else {
            // Read cell directly from offset 0
            const { cell } = readCell(decompressed, 0, 0);
            pdiAsset = {
              id: `pdi-${Math.random().toString(36).substring(2, 9)}`,
              fileName: `${entryName}.pdi`,
              fileType: 'pdi',
              ident: PDI_IDENT_STRING,
              isCompressed: Boolean(isCompressed),
              fileSizeBytes: rawData.length,
              decompressedSizeBytes: decompressedSize,
              compressionRatio: decompressedSize ? Number((rawData.length / decompressedSize).toFixed(2)) : 1,
              cells: [cell],
              numCells: 1,
              containerSource: fileName,
              metadata: {
                rawHeaderHex: 'Embedded in PDZ',
                width: cell.fullWidth,
                height: cell.fullHeight,
              },
            };
          }
          results.push(pdiAsset);
        } else if (fileType === 'pdt') {
          const hasIdent = new TextDecoder('ascii').decode(decompressed.subarray(0, 12)) === PDT_IDENT_STRING;
          if (hasIdent) {
            const pdtAsset = decodePdt(decompressed, `${entryName}.pdt`);
            pdtAsset.containerSource = fileName;
            results.push(pdtAsset);
          } else {
            // Table without header
            const tableView = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
            const numCells = tableView.getUint16(0, true);
            const cellsPerRow = tableView.getUint16(2, true);
            const tableEnd = 4 + numCells * 4;
            const offsets = [0];
            for (let i = 0; i < numCells - 1; i++) {
              offsets.push(tableView.getUint32(4 + i * 4, true));
            }
            const cells: DecodedCell[] = [];
            for (let i = 0; i < numCells; i++) {
              const { cell } = readCell(decompressed, tableEnd + offsets[i], i);
              cells.push(cell);
            }
            results.push({
              id: `pdt-${Math.random().toString(36).substring(2, 9)}`,
              fileName: `${entryName}.pdt`,
              fileType: 'pdt',
              ident: PDT_IDENT_STRING,
              isCompressed: Boolean(isCompressed),
              fileSizeBytes: rawData.length,
              decompressedSizeBytes: decompressedSize,
              compressionRatio: decompressedSize ? Number((rawData.length / decompressedSize).toFixed(2)) : 1,
              cells,
              numCells,
              cellsPerRow,
              containerSource: fileName,
              metadata: {
                rawHeaderHex: 'Embedded in PDZ',
                width: cells[0]?.fullWidth ?? 0,
                height: cells[0]?.fullHeight ?? 0,
              },
            });
          }
        }
      } catch (err) {
        console.warn(`Failed to parse entry ${entryName} (${fileType}):`, err);
      }
    }
  }

  return results;
}

/**
 * Universal dispatcher for any Playdate asset or archive file
 */
export function parsePlaydateAsset(buffer: Uint8Array, fileName: string): PlaydateAsset[] {
  if (buffer.length < 12) {
    throw new Error('File is too short to be a valid asset');
  }

  const magic = new TextDecoder('ascii').decode(buffer.subarray(0, 12));

  if (magic.startsWith('Playdate IMG')) {
    return [decodePdi(buffer, fileName)];
  }
  if (magic.startsWith('Playdate IMT')) {
    return [decodePdt(buffer, fileName)];
  }
  if (magic.startsWith('Playdate PDZ')) {
    return unpackPdz(buffer, fileName);
  }

  // Fallback by extension if magic check is slightly offset
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdi')) {
    return [decodePdi(buffer, fileName)];
  }
  if (lower.endsWith('.pdt')) {
    return [decodePdt(buffer, fileName)];
  }
  if (lower.endsWith('.pdz')) {
    return unpackPdz(buffer, fileName);
  }

  throw new Error(`Unsupported Playdate asset format: header "${magic}"`);
}

/**
 * Exports multiple decoded assets or cells to a single downloadable ZIP
 */
export function createAssetsZip(assets: PlaydateAsset[]): Uint8Array {
  const zipFiles: Record<string, Uint8Array> = {};

  for (const asset of assets) {
    const baseName = asset.fileName.replace(/\.(pdi|pdt|pdz)$/i, '');
    if (asset.cells.length === 1) {
      zipFiles[`${baseName}.png`] = asset.cells[0].exactPngBytes;
    } else {
      // Spritesheet / Image table frames
      asset.cells.forEach((cell, idx) => {
        const frameNum = String(idx + 1).padStart(3, '0');
        zipFiles[`${baseName}_frame_${frameNum}.png`] = cell.exactPngBytes;
      });
    }
  }

  return zipSync(zipFiles);
}

/**
 * Draws a decoded cell onto an HTML5 Canvas with optional color palette, inversion, or LCD style
 */
export function drawCellToCanvas(
  cell: DecodedCell,
  canvas: HTMLCanvasElement,
  options?: {
    palette?: 'monochrome' | 'playdate-lcd' | 'inverted' | 'gameboy';
    showTransparencyChecker?: boolean;
    scale?: number;
  }
): void {
  const { width, height } = { width: cell.fullWidth, height: cell.fullHeight };
  const scale = options?.scale || 1;

  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;

  const imgData = ctx.createImageData(width, height);
  const src = cell.rgbaPixels;
  const dst = imgData.data;

  const palette = options?.palette || 'monochrome';

  // Palette definitions:
  // Playdate memory LCD: dark #30381E, bright #B0BA42
  // Game Boy LCD: dark #0f380f, bright #8bac0f

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i];
    const a = src[i + 3];

    if (a === 0) {
      dst[i] = 0;
      dst[i + 1] = 0;
      dst[i + 2] = 0;
      dst[i + 3] = 0;
      continue;
    }

    const isWhite = r > 128;

    switch (palette) {
      case 'playdate-lcd':
        if (isWhite) {
          dst[i] = 176;   // #B0BA42
          dst[i + 1] = 186;
          dst[i + 2] = 66;
        } else {
          dst[i] = 48;    // #30381E
          dst[i + 1] = 56;
          dst[i + 2] = 30;
        }
        dst[i + 3] = a;
        break;

      case 'gameboy':
        if (isWhite) {
          dst[i] = 139;   // #8bac0f
          dst[i + 1] = 172;
          dst[i + 2] = 15;
        } else {
          dst[i] = 15;    // #0f380f
          dst[i + 1] = 56;
          dst[i + 2] = 15;
        }
        dst[i + 3] = a;
        break;

      case 'inverted':
        const inv = isWhite ? 0 : 255;
        dst[i] = inv;
        dst[i + 1] = inv;
        dst[i + 2] = inv;
        dst[i + 3] = a;
        break;

      case 'monochrome':
      default:
        dst[i] = isWhite ? 255 : 0;
        dst[i + 1] = isWhite ? 255 : 0;
        dst[i + 2] = isWhite ? 255 : 0;
        dst[i + 3] = a;
        break;
    }
  }

  if (scale === 1) {
    ctx.putImageData(imgData, 0, 0);
  } else {
    // Render to offscreen canvas and draw scaled
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    if (offCtx) {
      offCtx.putImageData(imgData, 0, 0);
      ctx.drawImage(offscreen, 0, 0, width * scale, height * scale);
    }
  }
}

/**
 * Encodes an image (RGBA ImageData) into Playdate .pdi binary format
 * Allows users to create .pdi files from any PNG/image file!
 */
export function encodePdiFromRgba(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
  options?: {
    compressed?: boolean;
    ditherMode?: 'threshold' | 'floyd-steinberg';
    threshold?: number;
  }
): Uint8Array {
  const isCompressed = options?.compressed ?? true;
  const threshold = options?.threshold ?? 128;

  // 1. Analyze transparent borders to find crop bounds (clipLeft, clipTop, clipWidth, clipHeight)
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  let hasAlpha = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const a = rgba[idx + 3];
      if (a < 255) {
        hasAlpha = true;
      }
      if (a > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // If entirely transparent or empty, clip to 1x1
  if (maxX < minX || maxY < minY) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  const clipLeft = minX;
  const clipTop = minY;
  const clipWidth = maxX - minX + 1;
  const clipHeight = maxY - minY + 1;
  const clipRight = width - (clipLeft + clipWidth);
  const clipBottom = height - (clipTop + clipHeight);

  // Stride must be a multiple of 4 (32-bit aligned)
  const stride = Math.ceil(clipWidth / 32) * 4;
  const flags = hasAlpha ? 1 : 0;

  const colorSize = stride * clipHeight;
  const colorBytes = new Uint8Array(colorSize);
  const alphaBytes = hasAlpha ? new Uint8Array(colorSize) : null;

  for (let cy = 0; cy < clipHeight; cy++) {
    const y = clipTop + cy;
    const rowOffset = cy * stride;

    for (let cx = 0; cx < clipWidth; cx++) {
      const x = clipLeft + cx;
      const idx = (y * width + x) * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      const a = rgba[idx + 3];

      // Luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const isWhite = lum >= threshold;
      const isOpaque = a >= 128;

      const byteIndex = rowOffset + Math.floor(cx / 8);
      const bitIndex = 7 - (cx % 8);

      if (isWhite) {
        colorBytes[byteIndex] |= (1 << bitIndex);
      }
      if (alphaBytes && isOpaque) {
        alphaBytes[byteIndex] |= (1 << bitIndex);
      }
    }
  }

  // Pack Cell Header (16 bytes, 8 uint16 little-endian)
  const cellHeader = new Uint8Array(16);
  const chView = new DataView(cellHeader.buffer);
  chView.setUint16(0, clipWidth, true);
  chView.setUint16(2, clipHeight, true);
  chView.setUint16(4, stride, true);
  chView.setUint16(6, clipLeft, true);
  chView.setUint16(8, clipRight, true);
  chView.setUint16(10, clipTop, true);
  chView.setUint16(12, clipBottom, true);
  chView.setUint16(14, flags, true);

  const cellTotalLen = 16 + colorSize + (alphaBytes ? colorSize : 0);
  const decompressedCell = new Uint8Array(cellTotalLen);
  decompressedCell.set(cellHeader, 0);
  decompressedCell.set(colorBytes, 16);
  if (alphaBytes) {
    decompressedCell.set(alphaBytes, 16 + colorSize);
  }

  if (isCompressed) {
    const compressedPayload = zlibSync(decompressedCell);
    const out = new Uint8Array(12 + 4 + 16 + compressedPayload.length);
    out.set(PDI_IDENT, 0); // 12 bytes
    const view = new DataView(out.buffer);
    view.setUint32(12, 0x80000000, true); // Compression flag
    view.setUint32(16, cellTotalLen, true); // Decompressed size
    view.setUint32(20, width, true); // Full width
    view.setUint32(24, height, true); // Full height
    view.setUint32(28, 0, true); // Reserved
    out.set(compressedPayload, 32);
    return out;
  } else {
    const out = new Uint8Array(12 + 4 + cellTotalLen);
    out.set(PDI_IDENT, 0);
    const view = new DataView(out.buffer);
    view.setUint32(12, 0, true); // Uncompressed flags
    out.set(decompressedCell, 16);
    return out;
  }
}

/**
 * Creates built-in sample Playdate assets for immediate testing
 */
export function createSampleAssets(): PlaydateAsset[] {
  const assets: PlaydateAsset[] = [];

  // 1. Playdate Crank Icon (48x48 with rotation angle and metallic arm)
  {
    const w = 48;
    const h = 48;
    const rgba = new Uint8ClampedArray(w * h * 4);
    const cx = 24;
    const cy = 24;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Circular crank hub
        if (dist <= 18) {
          rgba[idx + 3] = 255; // Opaque
          if (dist > 15 || dist <= 4) {
            rgba[idx + 0] = 0; // Black ring
            rgba[idx + 1] = 0;
            rgba[idx + 2] = 0;
          } else {
            // White body
            rgba[idx + 0] = 255;
            rgba[idx + 1] = 255;
            rgba[idx + 2] = 255;
          }
        }
        // Crank arm extending to top right
        const inArm = dx >= 2 && dx <= 18 && dy >= -18 && dy <= -2 && Math.abs(dx - (-dy)) <= 4;
        if (inArm) {
          rgba[idx + 3] = 255;
          rgba[idx + 0] = 0;
          rgba[idx + 1] = 0;
          rgba[idx + 2] = 0;
        }
        // Crank knob tip
        const knobDx = x - 38;
        const knobDy = y - 10;
        if (knobDx * knobDx + knobDy * knobDy <= 5 * 5) {
          rgba[idx + 3] = 255;
          rgba[idx + 0] = 255;
          rgba[idx + 1] = 255;
          rgba[idx + 2] = 255;
        }
      }
    }

    const pdiBytes = encodePdiFromRgba(w, h, rgba, { compressed: true });
    assets.push(decodePdi(pdiBytes, 'crank_indicator.pdi'));
  }

  // 2. Playdate Console Sprite (56x56)
  {
    const w = 56;
    const h = 56;
    const rgba = new Uint8ClampedArray(w * h * 4);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        // Body rectangle with rounded corners
        if (x >= 4 && x <= 46 && y >= 6 && y <= 50) {
          rgba[idx + 3] = 255; // Opaque
          const isBorder = x === 4 || x === 46 || y === 6 || y === 50;
          if (isBorder) {
            rgba[idx + 0] = 0;
            rgba[idx + 1] = 0;
            rgba[idx + 2] = 0;
          } else {
            rgba[idx + 0] = 255; // White body
            rgba[idx + 1] = 255;
            rgba[idx + 2] = 255;
          }
          // Screen (black rectangle)
          if (x >= 10 && x <= 40 && y >= 11 && y <= 31) {
            rgba[idx + 0] = 0;
            rgba[idx + 1] = 0;
            rgba[idx + 2] = 0;
            // Smiley face on screen
            if ((y === 17 && (x === 20 || x === 30)) || (y === 24 && x >= 21 && x <= 29)) {
              rgba[idx + 0] = 255;
              rgba[idx + 1] = 255;
              rgba[idx + 2] = 255;
            }
          }
          // D-pad
          if ((x >= 12 && x <= 20 && y >= 39 && y <= 43) || (x >= 14 && x <= 18 && y >= 37 && y <= 45)) {
            rgba[idx + 0] = 0;
            rgba[idx + 1] = 0;
            rgba[idx + 2] = 0;
          }
          // A and B buttons
          const bDist = (x - 32) ** 2 + (y - 42) ** 2;
          const aDist = (x - 39) ** 2 + (y - 39) ** 2;
          if (bDist <= 6 || aDist <= 6) {
            rgba[idx + 0] = 0;
            rgba[idx + 1] = 0;
            rgba[idx + 2] = 0;
          }
        }
        // Crank hinge on right side
        if (x >= 47 && x <= 51 && y >= 25 && y <= 31) {
          rgba[idx + 3] = 255;
          rgba[idx + 0] = 0;
          rgba[idx + 1] = 0;
          rgba[idx + 2] = 0;
        }
      }
    }

    const pdiBytes = encodePdiFromRgba(w, h, rgba, { compressed: true });
    assets.push(decodePdi(pdiBytes, 'playdate_console.pdi'));
  }

  // 3. Heart Animation Spritesheet (.pdt - 4 frames)
  {
    const framesCount = 4;
    const fw = 20;
    const fh = 20;
    const cellBuffers: Uint8Array[] = [];

    for (let f = 0; f < framesCount; f++) {
      const rgba = new Uint8ClampedArray(fw * fh * 4);
      const scale = [0.8, 1.0, 1.15, 1.0][f];

      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const idx = (y * fw + x) * 4;
          const nx = (x - 10) / (7 * scale);
          const ny = (y - 9) / (7 * scale);
          // Implicit heart formula: (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0
          const heartEq = (nx * nx + ny * ny - 1) ** 3 - (nx * nx) * (ny * ny * ny);

          if (heartEq <= 0) {
            rgba[idx + 3] = 255; // Opaque
            // Outer outline vs inner fill
            if (heartEq > -0.3) {
              rgba[idx + 0] = 0;
              rgba[idx + 1] = 0;
              rgba[idx + 2] = 0;
            } else {
              rgba[idx + 0] = 255;
              rgba[idx + 1] = 255;
              rgba[idx + 2] = 255;
            }
          }
        }
      }

      // Convert each frame to cell
      const pdi = encodePdiFromRgba(fw, fh, rgba, { compressed: false });
      // Cell starts at byte 16
      const cellData = pdi.subarray(16);
      cellBuffers.push(cellData);
    }

    // Assemble .pdt image table
    // Table Header: uint16 numCells, uint16 cellsPerRow
    const numCells = framesCount;
    const cellsPerRow = framesCount;
    const tableHeader = new Uint8Array(4);
    const thView = new DataView(tableHeader.buffer);
    thView.setUint16(0, numCells, true);
    thView.setUint16(2, cellsPerRow, true);

    // Offsets table: (numCells - 1) uint32 offsets relative to table end, + 1 uint32 end offset
    const offsetsTable = new Uint8Array(numCells * 4);
    const otView = new DataView(offsetsTable.buffer);
    let curAcc = cellBuffers[0].length;
    for (let i = 1; i < numCells; i++) {
      otView.setUint32((i - 1) * 4, curAcc, true);
      curAcc += cellBuffers[i].length;
    }
    otView.setUint32((numCells - 1) * 4, curAcc, true); // End offset

    // Total decompressed table
    const decompressedTable = new Uint8Array(4 + numCells * 4 + curAcc);
    decompressedTable.set(tableHeader, 0);
    decompressedTable.set(offsetsTable, 4);
    let cellWritePtr = 4 + numCells * 4;
    for (const cb of cellBuffers) {
      decompressedTable.set(cb, cellWritePtr);
      cellWritePtr += cb.length;
    }

    // Wrap in PDT header
    const compressedTable = zlibSync(decompressedTable);
    const pdtOut = new Uint8Array(12 + 4 + 16 + compressedTable.length);
    pdtOut.set(PDT_IDENT, 0);
    const pdtView = new DataView(pdtOut.buffer);
    pdtView.setUint32(12, 0x80000000, true); // Compressed
    pdtView.setUint32(16, decompressedTable.length, true);
    pdtView.setUint32(20, fw, true);
    pdtView.setUint32(24, fh, true);
    pdtView.setUint32(28, numCells, true);
    pdtOut.set(compressedTable, 32);

    assets.push(decodePdt(pdtOut, 'heart_pulse.pdt'));
  }

  return assets;
}
