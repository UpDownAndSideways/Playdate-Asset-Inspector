/**
 * @license
 * Detailed binary structure inspector for Playdate asset cells and headers
 */

import React from 'react';
import { PlaydateAsset, DecodedCell } from '../lib/pdi';
import { Binary, HardDrive, CheckCircle2, AlertCircle, FileCode, Info } from 'lucide-react';

interface CellInspectorProps {
  asset: PlaydateAsset;
  cellIndex?: number;
}

export const CellInspector: React.FC<CellInspectorProps> = ({
  asset,
  cellIndex = 0,
}) => {
  const safeIdx = Math.min(Math.max(0, cellIndex), asset.cells.length - 1);
  const cell: DecodedCell = asset.cells[safeIdx] || asset.cells[0];
  const header = cell.header;

  const colorBitmapBytes = header.stride * header.clipHeight;
  const alphaBitmapBytes = header.hasAlpha ? colorBitmapBytes : 0;
  const totalCellBytes = 16 + colorBitmapBytes + alphaBitmapBytes;

  return (
    <div className="bg-[#17181F] border border-[#262832] rounded-xl p-5 flex flex-col gap-5">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-[#262832] pb-3">
        <div className="flex items-center gap-2">
          <Binary className="w-4 h-4 text-[#FFC700]" />
          <h3 className="text-sm font-semibold text-white">
            Binary Cell Inspector
          </h3>
        </div>
        <span className="text-xs font-mono text-[#8E93A5]">
          Cell #{safeIdx + 1}
        </span>
      </div>

      {/* File & Container Header Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 rounded-lg bg-[#121317] border border-[#23252E]">
          <span className="text-[#757A8B] block text-[11px] mb-1">Magic Ident</span>
          <span className="text-[#FFC700] font-semibold text-xs">{asset.ident}</span>
        </div>

        <div className="p-3 rounded-lg bg-[#121317] border border-[#23252E]">
          <span className="text-[#757A8B] block text-[11px] mb-1">Compression</span>
          <span className={asset.isCompressed ? 'text-[#84CC16] font-semibold' : 'text-[#D1D5E0]'}>
            {asset.isCompressed ? 'zlib Deflate' : 'Uncompressed'}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-[#121317] border border-[#23252E]">
          <span className="text-[#757A8B] block text-[11px] mb-1">Asset Size</span>
          <span className="text-white font-semibold">
            {asset.fileSizeBytes.toLocaleString()} bytes
          </span>
        </div>

        <div className="p-3 rounded-lg bg-[#121317] border border-[#23252E]">
          <span className="text-[#757A8B] block text-[11px] mb-1">Reconstructed</span>
          <span className="text-white font-semibold">
            {cell.fullWidth} × {cell.fullHeight} px
          </span>
        </div>
      </div>

      {/* Cell Header Breakdown Table */}
      <div>
        <h4 className="text-xs font-semibold text-[#B0B5C6] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <span>Image Cell Header (16 bytes)</span>
        </h4>

        <div className="overflow-hidden border border-[#262832] rounded-lg">
          <table className="w-full text-left text-xs font-mono divide-y divide-[#20222B]">
            <thead className="bg-[#1C1E26] text-[#8E93A5]">
              <tr>
                <th className="py-2 px-3">Field</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Value</th>
                <th className="py-2 px-3 hidden md:table-cell">Specification Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20222B] bg-[#14151C] text-[#C6CAD6]">
              <tr>
                <td className="py-2 px-3 text-[#FFC700]">clip_width</td>
                <td className="py-2 px-3 text-[#7B8092]">uint16</td>
                <td className="py-2 px-3 font-semibold text-white">{header.clipWidth} px</td>
                <td className="py-2 px-3 text-[#7B8092] hidden md:table-cell">Active content width without transparent borders</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-[#FFC700]">clip_height</td>
                <td className="py-2 px-3 text-[#7B8092]">uint16</td>
                <td className="py-2 px-3 font-semibold text-white">{header.clipHeight} px</td>
                <td className="py-2 px-3 text-[#7B8092] hidden md:table-cell">Active content height without transparent borders</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-[#FFC700]">stride</td>
                <td className="py-2 px-3 text-[#7B8092]">uint16</td>
                <td className="py-2 px-3 font-semibold text-white">{header.stride} bytes</td>
                <td className="py-2 px-3 text-[#7B8092] hidden md:table-cell">
                  Row pitch (multiple of 4 for 32-bit hardware reads)
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-[#FFC700]">clip_left / clip_right</td>
                <td className="py-2 px-3 text-[#7B8092]">uint16 × 2</td>
                <td className="py-2 px-3 font-semibold text-white">L: {header.clipLeft} / R: {header.clipRight}</td>
                <td className="py-2 px-3 text-[#7B8092] hidden md:table-cell">
                  Width reconstructed: {header.clipLeft} + {header.clipWidth} + {header.clipRight} = {cell.fullWidth}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-[#FFC700]">clip_top / clip_bottom</td>
                <td className="py-2 px-3 text-[#7B8092]">uint16 × 2</td>
                <td className="py-2 px-3 font-semibold text-white">T: {header.clipTop} / B: {header.clipBottom}</td>
                <td className="py-2 px-3 text-[#7B8092] hidden md:table-cell">
                  Height reconstructed: {header.clipTop} + {header.clipHeight} + {header.clipBottom} = {cell.fullHeight}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-[#FFC700]">flags</td>
                <td className="py-2 px-3 text-[#7B8092]">uint16</td>
                <td className="py-2 px-3 font-semibold text-white">
                  0x{header.flags.toString(16).padStart(4, '0')} ({header.hasAlpha ? 'Alpha Enabled' : 'No Alpha'})
                </td>
                <td className="py-2 px-3 text-[#7B8092] hidden md:table-cell">
                  flags & 0x3 {header.hasAlpha ? '> 0 (uses 1-bit alpha mask)' : '== 0 (pure opaque)'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bitmaps Memory Allocation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        <div className="p-3 rounded-lg bg-[#121317] border border-[#23252E]">
          <span className="text-[#757A8B] block text-[11px] mb-1">Color Bitmap Payload</span>
          <span className="text-white font-semibold">{colorBitmapBytes.toLocaleString()} bytes</span>
          <span className="text-[10px] text-[#636877] block mt-0.5">
            ({header.stride} bytes × {header.clipHeight} rows)
          </span>
        </div>

        <div className="p-3 rounded-lg bg-[#121317] border border-[#23252E]">
          <span className="text-[#757A8B] block text-[11px] mb-1">Alpha Bitmap Payload</span>
          <span className={header.hasAlpha ? 'text-white font-semibold' : 'text-[#636877]'}>
            {header.hasAlpha ? `${alphaBitmapBytes.toLocaleString()} bytes` : '0 bytes (no alpha)'}
          </span>
          <span className="text-[10px] text-[#636877] block mt-0.5">
            {header.hasAlpha ? '1-bit transparency mask' : 'None required'}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-[#121317] border border-[#23252E]">
          <span className="text-[#757A8B] block text-[11px] mb-1">Total Uncompressed Cell</span>
          <span className="text-[#FFC700] font-semibold">{totalCellBytes.toLocaleString()} bytes</span>
          <span className="text-[10px] text-[#636877] block mt-0.5">
            Header + Color {header.hasAlpha ? '+ Alpha' : ''}
          </span>
        </div>
      </div>

      {/* Raw Header Hex Bytes */}
      {asset.metadata.rawHeaderHex && (
        <div>
          <span className="text-xs text-[#7E8394] font-mono block mb-1">
            Raw Binary File Header Preview:
          </span>
          <div className="p-2.5 rounded-lg bg-[#101115] border border-[#21232B] font-mono text-[11px] text-[#84CC16] tracking-wider select-all break-all">
            {asset.metadata.rawHeaderHex}
          </div>
        </div>
      )}
    </div>
  );
};
