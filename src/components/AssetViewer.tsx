/**
 * @license
 * Interactive asset viewer featuring zoom, LCD screen emulation, clip boundary overlay, and multi-palette export
 */

import React, { useEffect, useRef, useState } from 'react';
import { PlaydateAsset, DecodedCell, drawCellToCanvas } from '../lib/pdi';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
  Download,
  Eye,
  Check,
  Palette,
  Play,
  Pause,
  RotateCw,
  BoxSelect,
  Layers,
} from 'lucide-react';

interface AssetViewerProps {
  asset: PlaydateAsset;
  onDownloadPng: (asset: PlaydateAsset, cellIndex: number) => void;
  onDownloadCustomPng: (canvas: HTMLCanvasElement, filename: string) => void;
}

export const AssetViewer: React.FC<AssetViewerProps> = ({
  asset,
  onDownloadPng,
  onDownloadCustomPng,
}) => {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [zoom, setZoom] = useState<number>(4);
  const [palette, setPalette] = useState<'monochrome' | 'playdate-lcd' | 'gameboy' | 'inverted'>('monochrome');
  const [backgroundStyle, setBackgroundStyle] = useState<'checker-dark' | 'checker-light' | 'lcd' | 'black' | 'white'>('checker-dark');
  const [showClipBounds, setShowClipBounds] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(8);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animTimerRef = useRef<number | null>(null);

  // Safe frame clamp
  const safeFrameIndex = Math.min(Math.max(0, currentFrameIndex), asset.cells.length - 1);
  const currentCell: DecodedCell = asset.cells[safeFrameIndex] || asset.cells[0];

  // Reset frame index if asset changes
  useEffect(() => {
    setCurrentFrameIndex(0);
    setIsPlaying(false);
  }, [asset.id]);

  // Handle Animation Playback for .pdt
  useEffect(() => {
    if (!isPlaying || asset.cells.length <= 1) {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
      return;
    }

    const interval = Math.max(16, 1000 / fps);
    animTimerRef.current = window.setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % asset.cells.length);
    }, interval);

    return () => {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
    };
  }, [isPlaying, fps, asset.cells.length]);

  // Redraw canvas whenever frame, zoom, or palette changes
  useEffect(() => {
    if (!canvasRef.current || !currentCell) return;
    drawCellToCanvas(currentCell, canvasRef.current, {
      palette,
      scale: 1, // Render native 1:1 onto canvas; CSS controls display zoom cleanly
    });
  }, [currentCell, palette]);

  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Fallback to data URL
          const dataUrl = canvasRef.current?.toDataURL('image/png');
          if (dataUrl) {
            await navigator.clipboard.writeText(dataUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }
      });
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  const getCanvasBackgroundClass = () => {
    switch (backgroundStyle) {
      case 'checker-dark':
        return 'transparency-checkerboard';
      case 'checker-light':
        return 'transparency-checkerboard-light';
      case 'lcd':
        return 'bg-[#B0BA42]';
      case 'black':
        return 'bg-black';
      case 'white':
        return 'bg-white';
      default:
        return 'transparency-checkerboard';
    }
  };

  return (
    <div className="bg-[#17181F] border border-[#262832] rounded-xl flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <div className="p-3 border-b border-[#262832] flex flex-wrap items-center justify-between gap-3 bg-[#16171E]">
        {/* Left: Asset meta title & frame indicator */}
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>{asset.fileName}</span>
              {asset.numCells > 1 && (
                <span className="text-xs font-mono text-[#FFC700] bg-[#FFC700]/10 px-1.5 py-0.5 rounded">
                  Frame {safeFrameIndex + 1} / {asset.numCells}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[#828798] font-mono mt-0.5">
              <span>{currentCell.fullWidth} × {currentCell.fullHeight} px</span>
              <span aria-hidden="true">·</span>
              <span>{currentCell.hasAlpha ? 'Alpha Masked' : 'Opaque 1-bit'}</span>
            </div>
          </div>
        </div>

        {/* Right: View & Export Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-[#20222B] border border-[#2D303C] rounded-lg p-0.5 text-xs text-[#B5BAC9]">
            <button
              onClick={() => setZoom((z) => Math.max(1, z / 2))}
              className="p-1.5 hover:text-white transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] font-medium text-white select-none">
              {zoom}×
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(16, z * 2))}
              className="p-1.5 hover:text-white transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Palette selector */}
          <div className="flex items-center bg-[#20222B] border border-[#2D303C] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setPalette('monochrome')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                palette === 'monochrome' ? 'bg-[#2E3240] text-white shadow-sm' : 'text-[#8B90A1] hover:text-white'
              }`}
              title="1-bit Black and White"
            >
              1-Bit B&W
            </button>
            <button
              onClick={() => {
                setPalette('playdate-lcd');
                setBackgroundStyle('lcd');
              }}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                palette === 'playdate-lcd' ? 'bg-[#FFC700] text-black font-semibold shadow-sm' : 'text-[#8B90A1] hover:text-white'
              }`}
              title="Playdate Memory LCD greenish-yellow tint"
            >
              Playdate LCD
            </button>
            <button
              onClick={() => setPalette('inverted')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                palette === 'inverted' ? 'bg-[#2E3240] text-white shadow-sm' : 'text-[#8B90A1] hover:text-white'
              }`}
              title="Inverted colors"
            >
              Invert
            </button>
          </div>

          {/* Clip bounds overlay button */}
          <button
            onClick={() => setShowClipBounds(!showClipBounds)}
            className={`p-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showClipBounds
                ? 'bg-[#FFC700]/20 border-[#FFC700] text-[#FFC700]'
                : 'bg-[#20222B] border-[#2D303C] text-[#8E93A4] hover:text-white'
            }`}
            title="Toggle Cell Clip Bounding Box (crop margins)"
          >
            <BoxSelect className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Clip Box</span>
          </button>

          {/* Background switcher */}
          <div className="flex items-center gap-1 bg-[#20222B] border border-[#2D303C] rounded-lg p-1">
            <button
              onClick={() => setBackgroundStyle('checker-dark')}
              className={`w-4 h-4 rounded-sm border ${
                backgroundStyle === 'checker-dark' ? 'ring-1 ring-[#FFC700] border-transparent' : 'border-[#3D4150]'
              } transparency-checkerboard`}
              title="Dark transparency checkerboard"
            />
            <button
              onClick={() => setBackgroundStyle('checker-light')}
              className={`w-4 h-4 rounded-sm border ${
                backgroundStyle === 'checker-light' ? 'ring-1 ring-[#FFC700] border-transparent' : 'border-[#3D4150]'
              } transparency-checkerboard-light`}
              title="Light transparency checkerboard"
            />
            <button
              onClick={() => setBackgroundStyle('lcd')}
              className={`w-4 h-4 rounded-sm bg-[#B0BA42] border ${
                backgroundStyle === 'lcd' ? 'ring-1 ring-white border-transparent' : 'border-transparent'
              }`}
              title="Playdate LCD background"
            />
          </div>
        </div>
      </div>

      {/* Main Preview Viewport */}
      <div className="relative min-h-[360px] md:min-h-[420px] flex items-center justify-center p-8 bg-[#111217] overflow-auto select-none">
        {/* Playdate LCD Bezel Frame */}
        <div className="relative flex flex-col items-center">
          <div
            className={`relative rounded-lg overflow-hidden shadow-2xl transition-all border border-black/30 ${getCanvasBackgroundClass()}`}
            style={{
              width: currentCell.fullWidth * zoom,
              height: currentCell.fullHeight * zoom,
            }}
          >
            {/* The Raw Canvas */}
            <canvas
              ref={canvasRef}
              className="w-full h-full pixelated block"
              style={{
                width: currentCell.fullWidth * zoom,
                height: currentCell.fullHeight * zoom,
              }}
            />

            {/* Cell Clip Bounding Box Overlay */}
            {showClipBounds && (
              <div
                className="absolute border border-dashed border-[#FFC700] pointer-events-none transition-all"
                style={{
                  left: currentCell.header.clipLeft * zoom,
                  top: currentCell.header.clipTop * zoom,
                  width: currentCell.header.clipWidth * zoom,
                  height: currentCell.header.clipHeight * zoom,
                  boxShadow: '0 0 0 9999px rgba(255, 199, 0, 0.08)',
                }}
              >
                <span className="absolute -top-5 left-0 text-[10px] font-mono text-[#FFC700] bg-black/80 px-1 rounded whitespace-nowrap">
                  Cell: {currentCell.header.clipWidth}×{currentCell.header.clipHeight}
                </span>
              </div>
            )}
          </div>

          {/* Quick Subtitle */}
          <div className="mt-3 flex items-center gap-3 text-xs text-[#7B8092] font-mono">
            <span>
              Scale: {zoom}× ({currentCell.fullWidth * zoom} × {currentCell.fullHeight * zoom} rendered px)
            </span>
            {showClipBounds && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#FFC700]">
                  Crop margins: L:{currentCell.header.clipLeft} R:{currentCell.header.clipRight} T:{currentCell.header.clipTop} B:{currentCell.header.clipBottom}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Animation Scrubber & Frame Strip (for .pdt multi-frame tables) */}
      {asset.numCells > 1 && (
        <div className="border-t border-[#262832] p-3.5 bg-[#16171E] flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-3 py-1.5 rounded-lg bg-[#22242F] hover:bg-[#2C303E] border border-[#343846] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 text-[#FFC700]" /> : <Play className="w-3.5 h-3.5 text-[#FFC700]" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <div className="flex items-center gap-2 ml-2 text-xs text-[#8E93A5] font-mono">
                <span>FPS:</span>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="w-20 accent-[#FFC700]"
                />
                <span className="w-6 text-white">{fps}</span>
              </div>
            </div>

            <div className="text-xs font-mono text-[#8E93A5]">
              Frame {safeFrameIndex + 1} of {asset.numCells}
            </div>
          </div>

          {/* Frame Strip */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {asset.cells.map((cell, idx) => {
              const isCellActive = idx === safeFrameIndex;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentFrameIndex(idx);
                  }}
                  className={`w-12 h-12 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden transparency-checkerboard transition-all relative ${
                    isCellActive
                      ? 'ring-2 ring-[#FFC700] border-transparent scale-105'
                      : 'border-[#2D303C] opacity-70 hover:opacity-100'
                  }`}
                  title={`Frame ${idx + 1}`}
                >
                  <img
                    src={`data:image/png;base64,${btoa(
                      cell.exactPngBytes.reduce(
                        (data, byte) => data + String.fromCharCode(byte),
                        ''
                      )
                    )}`}
                    alt={`Frame ${idx + 1}`}
                    className="max-w-full max-h-full pixelated object-contain"
                  />
                  <span className="absolute bottom-0 right-0 text-[9px] font-mono px-1 bg-black/70 text-white rounded-tl">
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Export Bar */}
      <div className="p-4 border-t border-[#262832] bg-[#14151B] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDownloadPng(asset, safeFrameIndex)}
            className="px-4 py-2 text-xs font-semibold text-black bg-[#FFC700] hover:bg-[#E6B300] active:scale-95 rounded-lg transition-all flex items-center gap-2 shadow-sm"
            title="Download PNG matching pdi2png.py specification"
          >
            <Download className="w-3.5 h-3.5" />
            Download Original PNG
          </button>

          {palette !== 'monochrome' && canvasRef.current && (
            <button
              onClick={() => {
                if (canvasRef.current) {
                  const outName = `${asset.fileName.replace(/\.(pdi|pdt)$/i, '')}_${palette}.png`;
                  onDownloadCustomPng(canvasRef.current, outName);
                }
              }}
              className="px-3.5 py-2 text-xs font-medium text-white bg-[#22242E] hover:bg-[#2B2E3B] border border-[#343846] rounded-lg transition-colors flex items-center gap-1.5"
              title="Download PNG rendered with current color palette"
            >
              <Palette className="w-3.5 h-3.5 text-[#FFC700]" />
              Download {palette === 'playdate-lcd' ? 'LCD Tint' : 'Styled'} PNG
            </button>
          )}

          <button
            onClick={handleCopyImage}
            className="px-3 py-2 text-xs font-medium text-[#D1D4DE] hover:text-white bg-[#20222B] hover:bg-[#282B37] border border-[#2D303B] rounded-lg transition-colors flex items-center gap-1.5"
            title="Copy PNG image to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#84CC16]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied PNG!' : 'Copy to Clipboard'}</span>
          </button>
        </div>

        <div className="text-xs text-[#7B8092] font-mono">
          Ident: <span className="text-[#FFC700]">{asset.ident}</span>
        </div>
      </div>
    </div>
  );
};
