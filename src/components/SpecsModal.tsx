/**
 * @license
 * Detailed specification reference component documenting the Playdate reverse engineering formats
 */

import React from 'react';
import { ExternalLink, BookOpen, Layers, Cpu, ShieldCheck } from 'lucide-react';

export const SpecsModal: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Overview Card */}
      <div className="bg-[#17181F] border border-[#262832] rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#FFC700]" />
            <h2 className="text-base font-bold text-white">
              Panic Playdate Image Specifications
            </h2>
          </div>
          <a
            href="https://github.com/cranksters/playdate-reverse-engineering/blob/main/tools/pdi2png.py"
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs font-mono text-[#FFC700] hover:underline flex items-center gap-1.5 bg-[#FFC700]/10 px-2.5 py-1 rounded-md border border-[#FFC700]/20"
          >
            <span>cranksters/playdate-reverse-engineering</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <p className="text-xs text-[#9FA4B5] leading-relaxed">
          The Playdate handheld gaming console uses custom 1-bit monochrome binary formats designed for its 400×240 sharp memory LCD display.
          During game compilation, Panic's <code className="text-[#FFC700] font-mono">pdc</code> compiler transforms standard PNG assets into <code className="text-[#FFC700] font-mono">.pdi</code> and <code className="text-[#FFC700] font-mono">.pdt</code> files, cropping transparent edges and aligning row strides to 32-bit boundaries for rapid DMA hardware transfers.
        </p>
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PDI Spec */}
        <div className="bg-[#17181F] border border-[#262832] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FFC700]"></span>
              Playdate Image (.pdi)
            </h3>
            <span className="text-xs font-mono text-[#8E93A5]">Ident: Playdate IMG</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="p-2.5 rounded bg-[#121317] border border-[#21232B] space-y-1">
              <span className="text-[#757A8B] block text-[10px]">Header Layout</span>
              <p className="text-[#C5C9D6]">
                • <span className="text-[#FFC700]">0..11</span>: <span className="text-white">char[12]</span> "Playdate IMG"<br />
                • <span className="text-[#FFC700]">12..15</span>: <span className="text-white">uint32</span> Flags (bit 31: zlib compressed)<br />
                • If compressed: 16 bytes for decompressed size, width, height, reserved.<br />
                • Followed by zlib-compressed cell stream.
              </p>
            </div>
          </div>

          <p className="text-xs text-[#8E93A5] leading-relaxed">
            Contains a single <strong className="text-white">Image Cell</strong>. Transparent borders are cropped out to minimize flash storage.
          </p>
        </div>

        {/* PDT Spec */}
        <div className="bg-[#17181F] border border-[#262832] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#84CC16]"></span>
              Image Table / Spritesheet (.pdt)
            </h3>
            <span className="text-xs font-mono text-[#8E93A5]">Ident: Playdate IMT</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="p-2.5 rounded bg-[#121317] border border-[#21232B] space-y-1">
              <span className="text-[#757A8B] block text-[10px]">Header Layout</span>
              <p className="text-[#C5C9D6]">
                • <span className="text-[#84CC16]">0..11</span>: <span className="text-white">char[12]</span> "Playdate IMT"<br />
                • <span className="text-[#84CC16]">12..15</span>: <span className="text-white">uint32</span> Compression Flags<br />
                • Table Header: <span className="text-white">uint16</span> num_cells, <span className="text-white">uint16</span> cells_per_row<br />
                • Array of <span className="text-white">uint32</span> cell offsets relative to end of table.
              </p>
            </div>
          </div>

          <p className="text-xs text-[#8E93A5] leading-relaxed">
            Stores sequential animation frames or matrix tile sheets. Each frame is stored as an independent cropped Image Cell.
          </p>
        </div>
      </div>

      {/* The Image Cell Deep Dive */}
      <div className="bg-[#17181F] border border-[#262832] rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#FFC700]" />
          The Image Cell Structure & 1-Bit Pixel Packing
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-[#121317] border border-[#21232B] space-y-1.5">
            <span className="font-semibold text-white block">1. Transparent Edge Cropping</span>
            <p className="text-[#8E93A5] leading-relaxed">
              Transparent outer rows and columns are stripped by the compiler.
              Full width is restored as:
              <br />
              <code className="text-[#FFC700] font-mono text-[11px]">
                clip_left + clip_width + clip_right
              </code>
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#121317] border border-[#21232B] space-y-1.5">
            <span className="font-semibold text-white block">2. 32-Bit Stride Alignment</span>
            <p className="text-[#8E93A5] leading-relaxed">
              Row stride is rounded up to the nearest multiple of 4 bytes:
              <br />
              <code className="text-[#FFC700] font-mono text-[11px]">
                stride = Math.ceil(clip_width / 32) * 4
              </code>
              <br />
              Allowing word-aligned memory access on ARM Cortex-M7.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#121317] border border-[#21232B] space-y-1.5">
            <span className="font-semibold text-white block">3. MSB Bit Ordering</span>
            <p className="text-[#8E93A5] leading-relaxed">
              Bits are packed MSB-first:
              <br />
              <code className="text-[#FFC700] font-mono text-[11px]">
                bit = (byte &gt;&gt; (7 - (x % 8))) &amp; 1
              </code>
              <br />
              0 = Black, 1 = White. If <code className="text-[#FFC700] font-mono">flags &amp; 0x3 &gt; 0</code>, an identical alpha bitmap follows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
