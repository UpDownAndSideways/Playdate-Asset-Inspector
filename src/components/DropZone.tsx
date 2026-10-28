/**
 * @license
 * Tactile Dropzone for Playdate assets (.pdi, .pdt, .pdz, .zip)
 */

import React, { useRef, useState } from 'react';
import { UploadCloud, FileCode2, Sparkles, FolderArchive, HelpCircle } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  onLoadSamples: () => void;
  hasAssets: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  onLoadSamples,
  hasAssets,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
    // Reset value so re-selecting same file triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (hasAssets) {
    // Compact drop strip when assets already loaded
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer flex items-center justify-between gap-4 ${
          isDragOver
            ? 'border-[#FFC700] bg-[#FFC700]/10 text-white'
            : 'border-[#2D3039] bg-[#16171D] hover:border-[#4B5060] text-[#9EA3B4]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdi,.pdt,.pdz,.zip"
          onChange={handleFileInputChange}
          className="hidden"
        />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#22242D] flex items-center justify-center text-[#FFC700]">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              Drop more Playdate files here or <span className="text-[#FFC700] underline">browse</span>
            </p>
            <p className="text-xs text-[#7B8092]">
              Accepts .pdi, .pdt, .pdz containers, and .zip archives
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLoadSamples();
            }}
            className="px-3 py-1.5 text-xs font-medium text-[#E2E4EB] bg-[#22242D] hover:bg-[#2C2F3B] border border-[#343846] rounded-md transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
            Reload Samples
          </button>
        </div>
      </div>
    );
  }

  // Hero Dropzone when empty
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-2xl p-10 md:p-14 text-center transition-all ${
        isDragOver
          ? 'border-[#FFC700] bg-[#FFC700]/10'
          : 'border-[#2E313D] bg-[#17181F] hover:border-[#464B5B]'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdi,.pdt,.pdz,.zip"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div className="max-w-xl mx-auto flex flex-col items-center">
        {/* Playdate Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-[#FFC700]/10 border border-[#FFC700]/30 flex items-center justify-center text-[#FFC700] mb-5 shadow-inner">
          <FileCode2 className="w-8 h-8" />
        </div>

        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight mb-2">
          Convert Playdate Assets to PNG
        </h2>

        <p className="text-sm text-[#9FA4B5] mb-6 leading-relaxed max-w-md">
          Drag & drop your Panic Playdate <code className="text-[#FFC700] font-mono font-medium">.pdi</code> images,{' '}
          <code className="text-[#FFC700] font-mono font-medium">.pdt</code> sprite tables, or{' '}
          <code className="text-[#FFC700] font-mono font-medium">.pdz</code> packages here to extract PNG images with transparent bounds.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 text-sm font-semibold text-black bg-[#FFC700] hover:bg-[#E6B300] active:scale-95 rounded-lg transition-all shadow-sm flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            Select Files to Convert
          </button>

          <button
            type="button"
            onClick={onLoadSamples}
            className="px-4 py-2.5 text-sm font-medium text-white bg-[#22242D] hover:bg-[#2A2D3A] border border-[#323644] rounded-lg transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-[#FFC700]" />
            Try Built-in Samples
          </button>
        </div>

        {/* Feature Badges without pill enclosures (anti-slop rule) */}
        <div className="pt-6 border-t border-[#262832] w-full flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#8A8F9F]">
          <span>Grounded in cranksters/pdi2png.py</span>
          <span aria-hidden="true">·</span>
          <span>Single-bit 0/255 monochrome</span>
          <span aria-hidden="true">·</span>
          <span>1-bit alpha transparency</span>
          <span aria-hidden="true">·</span>
          <span>100% Client-Side Privacy</span>
        </div>
      </div>
    </div>
  );
};
