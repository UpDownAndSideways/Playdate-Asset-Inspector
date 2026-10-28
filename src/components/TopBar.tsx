/**
 * @license
 * Top navigation conforming to the Top Bar Contract (3 zones, single line wordmark, 4 clean links, 1 primary action)
 */

import React from 'react';
import { Download, BookOpen, Layers, Sparkles } from 'lucide-react';

interface TopBarProps {
  activeTab: 'converter' | 'encoder' | 'docs';
  setActiveTab: (tab: 'converter' | 'encoder' | 'docs') => void;
  onLoadSamples: () => void;
  totalAssetsCount: number;
  onDownloadAllZip: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  onLoadSamples,
  totalAssetsCount,
  onDownloadAllZip,
}) => {
  return (
    <header className="border-b border-[#262830] bg-[#16171C] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#FFC700] text-black font-extrabold flex items-center justify-center text-base shadow-sm ring-1 ring-black/10 select-none">
            P
          </div>
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            Playdate Asset Studio
          </span>
          <span className="hidden sm:inline-block text-xs font-mono text-[#8E92A2] border-l border-[#2E313C] pl-2.5">
            pdi2png
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#9FA4B5]">
          <button
            onClick={() => setActiveTab('converter')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-white ${
              activeTab === 'converter' ? 'text-[#FFC700] font-semibold' : ''
            }`}
          >
            PDI / PDT Converter
          </button>
          <button
            onClick={() => setActiveTab('encoder')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-white ${
              activeTab === 'encoder' ? 'text-[#FFC700] font-semibold' : ''
            }`}
          >
            PNG to PDI Encoder
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-white ${
              activeTab === 'docs' ? 'text-[#FFC700] font-semibold' : ''
            }`}
          >
            Binary Spec Docs
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {totalAssetsCount > 0 ? (
            <button
              onClick={onDownloadAllZip}
              className="px-3.5 py-1.5 text-xs font-semibold text-black bg-[#FFC700] rounded-lg hover:bg-[#E6B300] active:scale-95 transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Download all converted assets as ZIP archive"
            >
              <Download className="w-3.5 h-3.5" />
              Download All ({totalAssetsCount})
            </button>
          ) : (
            <button
              onClick={onLoadSamples}
              className="px-3.5 py-1.5 text-xs font-semibold text-black bg-[#FFC700] rounded-lg hover:bg-[#E6B300] active:scale-95 transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Load ready-to-test sample Playdate assets"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load Sample Assets
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
