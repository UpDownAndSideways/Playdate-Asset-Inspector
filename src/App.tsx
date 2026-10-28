/**
 * @license
 * Playdate Asset Studio - PDI to PNG Converter
 * Grounded in cranksters/playdate-reverse-engineering (tools/pdi2png.py)
 */

import React, { useState, useEffect } from 'react';
import { unzipSync } from 'fflate';
import {
  PlaydateAsset,
  parsePlaydateAsset,
  createAssetsZip,
  createSampleAssets,
} from './lib/pdi';
import { TopBar } from './components/TopBar';
import { DropZone } from './components/DropZone';
import { AssetList } from './components/AssetList';
import { AssetViewer } from './components/AssetViewer';
import { CellInspector } from './components/CellInspector';
import { PngToPdiEncoder } from './components/PngToPdiEncoder';
import { SpecsModal } from './components/SpecsModal';
import { AlertCircle, CheckCircle2, Download, Layers } from 'lucide-react';

export default function App() {
  const [assets, setAssets] = useState<PlaydateAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'converter' | 'encoder' | 'docs'>('converter');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Initialize with built-in sample Playdate assets on mount
  useEffect(() => {
    try {
      const samples = createSampleAssets();
      setAssets(samples);
      if (samples.length > 0) {
        setSelectedAssetId(samples[0].id);
      }
    } catch (e) {
      console.error('Failed to load initial samples:', e);
    }
  }, []);

  // Show auto-dismissing success toast
  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Load sample assets
  const handleLoadSamples = () => {
    try {
      const samples = createSampleAssets();
      setAssets(samples);
      setSelectedAssetId(samples[0].id);
      setErrorMessage(null);
      triggerToast('Loaded Playdate sample assets');
    } catch (err) {
      setErrorMessage(`Failed to load samples: ${(err as Error).message}`);
    }
  };

  // Handle files selected via file input or dropzone
  const handleFilesSelected = async (files: FileList | File[]) => {
    setIsProcessing(true);
    setErrorMessage(null);

    const newAssets: PlaydateAsset[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Check if ZIP archive
        if (file.name.toLowerCase().endsWith('.zip')) {
          try {
            const unzipped = unzipSync(buffer);
            for (const [subPath, subData] of Object.entries(unzipped)) {
              const lowerSub = subPath.toLowerCase();
              if (
                lowerSub.endsWith('.pdi') ||
                lowerSub.endsWith('.pdt') ||
                lowerSub.endsWith('.pdz')
              ) {
                const subFileName = subPath.split('/').pop() || subPath;
                try {
                  const extracted = parsePlaydateAsset(subData, subFileName);
                  newAssets.push(...extracted);
                } catch (subErr) {
                  errors.push(`${subFileName}: ${(subErr as Error).message}`);
                }
              }
            }
          } catch (zipErr) {
            errors.push(`${file.name} (ZIP error): ${(zipErr as Error).message}`);
          }
        } else {
          // Direct Playdate asset (.pdi, .pdt, .pdz)
          const parsed = parsePlaydateAsset(buffer, file.name);
          newAssets.push(...parsed);
        }
      } catch (err) {
        errors.push(`${file.name}: ${(err as Error).message}`);
      }
    }

    setIsProcessing(false);

    if (newAssets.length > 0) {
      setAssets((prev) => [...prev, ...newAssets]);
      setSelectedAssetId(newAssets[0].id);
      triggerToast(`Successfully parsed ${newAssets.length} asset${newAssets.length > 1 ? 's' : ''}`);
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join(' | '));
    }
  };

  // Download individual PNG matching pdi2png.py
  const handleDownloadPng = (asset: PlaydateAsset, cellIndex: number) => {
    const cell = asset.cells[cellIndex] || asset.cells[0];
    if (!cell) return;

    const blob = new Blob([cell.exactPngBytes.buffer as ArrayBuffer], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const baseName = asset.fileName.replace(/\.(pdi|pdt|pdz)$/i, '');
    if (asset.cells.length > 1) {
      const frameNum = String(cellIndex + 1).padStart(3, '0');
      a.download = `${baseName}_frame_${frameNum}.png`;
    } else {
      a.download = `${baseName}.png`;
    }

    a.click();
    URL.revokeObjectURL(url);
    triggerToast(`Downloaded ${a.download}`);
  };

  // Download custom colored canvas PNG
  const handleDownloadCustomPng = (canvas: HTMLCanvasElement, filename: string) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      triggerToast(`Downloaded ${filename}`);
    }, 'image/png');
  };

  // Download All Assets as ZIP
  const handleDownloadAllZip = () => {
    if (assets.length === 0) return;
    try {
      const zipBytes = createAssetsZip(assets);
      const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'playdate_assets_converted.zip';
      a.click();
      URL.revokeObjectURL(url);
      triggerToast(`Downloaded playdate_assets_converted.zip`);
    } catch (err) {
      setErrorMessage(`Failed to create ZIP: ${(err as Error).message}`);
    }
  };

  // Remove single asset
  const handleRemoveAsset = (id: string) => {
    setAssets((prev) => {
      const filtered = prev.filter((a) => a.id !== id);
      if (selectedAssetId === id) {
        setSelectedAssetId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  // Clear all assets
  const handleClearAll = () => {
    setAssets([]);
    setSelectedAssetId(null);
  };

  // Selected active asset
  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || assets[0] || null;

  return (
    <div className="min-h-screen bg-[#111216] text-[#F3F4F6] flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLoadSamples={handleLoadSamples}
        totalAssetsCount={assets.length}
        onDownloadAllZip={handleDownloadAllZip}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* Toast Notification */}
        {successToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#1E202A] border border-[#FFC700]/40 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#FFC700]" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-[#FF5555]/10 border border-[#FF5555]/30 text-white text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#FF5555] shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-[#A8ABB7] hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab 1: Converter View */}
        {activeTab === 'converter' && (
          <div className="flex flex-col gap-6">
            {/* Drop Zone Header */}
            <DropZone
              onFilesSelected={handleFilesSelected}
              onLoadSamples={handleLoadSamples}
              hasAssets={assets.length > 0}
            />

            {/* If assets are loaded, display 2-column studio layout */}
            {assets.length > 0 && selectedAsset && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Asset Queue (4 cols) */}
                <div className="lg:col-span-4">
                  <AssetList
                    assets={assets}
                    selectedAssetId={selectedAsset.id}
                    onSelectAsset={setSelectedAssetId}
                    onRemoveAsset={handleRemoveAsset}
                    onClearAll={handleClearAll}
                    onDownloadAsset={(a) => handleDownloadPng(a, 0)}
                  />
                </div>

                {/* Right Column: Active Asset Viewer & Inspector (8 cols) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  {/* Interactive Viewer */}
                  <AssetViewer
                    asset={selectedAsset}
                    onDownloadPng={handleDownloadPng}
                    onDownloadCustomPng={handleDownloadCustomPng}
                  />

                  {/* Deep Binary Cell Inspector */}
                  <CellInspector asset={selectedAsset} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: PNG to PDI Reverse Encoder */}
        {activeTab === 'encoder' && (
          <PngToPdiEncoder
            onLoadPdiToStudio={(encodedAsset) => {
              setAssets((prev) => [encodedAsset, ...prev]);
              setSelectedAssetId(encodedAsset.id);
              setActiveTab('converter');
              triggerToast(`Added ${encodedAsset.fileName} to Studio`);
            }}
          />
        )}

        {/* Tab 3: Binary Format Documentation */}
        {activeTab === 'docs' && <SpecsModal />}
      </main>

      {/* Quiet Minimal Footer */}
      <footer className="border-t border-[#21232B] bg-[#14151C] py-5 text-center text-xs text-[#7A7F90]">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Playdate Asset Studio</span>
            <span aria-hidden="true">·</span>
            <span>Based on Playdate Reverse Engineering by Cranksters & James Daniel</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <a
              href="https://github.com/cranksters/playdate-reverse-engineering/blob/main/tools/pdi2png.py"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-[#FFC700] transition-colors"
            >
              GitHub pdi2png.py
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://play.date"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-[#FFC700] transition-colors"
            >
              Panic Playdate
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
