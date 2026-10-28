/**
 * @license
 * Reverse Encoder: Convert standard PNG / JPG / WebP images into compiled Playdate .pdi binary assets
 */

import React, { useRef, useState, useEffect } from 'react';
import { encodePdiFromRgba, decodePdi, PlaydateAsset } from '../lib/pdi';
import { UploadCloud, Download, Sparkles, Sliders, CheckCircle2, ArrowRight } from 'lucide-react';

interface PngToPdiEncoderProps {
  onLoadPdiToStudio: (asset: PlaydateAsset) => void;
}

export const PngToPdiEncoder: React.FC<PngToPdiEncoderProps> = ({ onLoadPdiToStudio }) => {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceName, setSourceName] = useState<string>('sample_sprite.png');
  const [threshold, setThreshold] = useState<number>(128);
  const [isCompressed, setIsCompressed] = useState<boolean>(true);
  const [encodedPdiBytes, setEncodedPdiBytes] = useState<Uint8Array | null>(null);
  const [encodedAsset, setEncodedAsset] = useState<PlaydateAsset | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load a default sample graphic for the encoder
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw a retro star sprite with transparent edges
      ctx.clearRect(0, 0, 32, 32);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;

      // Draw 5-pointed star
      const cx = 16;
      const cy = 16;
      const spikes = 5;
      const outerRadius = 12;
      const innerRadius = 5;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outerRadius;
        let y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setSourceName('star_icon.png');
      };
      img.src = canvas.toDataURL('image/png');
    }
  }, []);

  // Whenever source image, threshold, or compression changes, encode PDI
  useEffect(() => {
    if (!sourceImage) return;

    const width = sourceImage.width;
    const height = sourceImage.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(sourceImage, 0, 0);
    const imgData = ctx.getImageData(0, 0, width, height);

    try {
      const pdiBytes = encodePdiFromRgba(width, height, imgData.data, {
        compressed: isCompressed,
        threshold,
      });
      setEncodedPdiBytes(pdiBytes);

      const targetPdiName = sourceName.replace(/\.[^/.]+$/, '') + '.pdi';
      const decoded = decodePdi(pdiBytes, targetPdiName);
      setEncodedAsset(decoded);

      // Render 1-bit preview to preview canvas
      if (previewCanvasRef.current) {
        previewCanvasRef.current.width = width;
        previewCanvasRef.current.height = height;
        const pCtx = previewCanvasRef.current.getContext('2d');
        if (pCtx) {
          const previewData = pCtx.createImageData(width, height);
          previewData.data.set(decoded.cells[0].rgbaPixels);
          pCtx.putImageData(previewData, 0, 0);
        }
      }
    } catch (err) {
      console.error('Encoding error:', err);
    }
  }, [sourceImage, threshold, isCompressed, sourceName]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setSourceName(file.name);
      };
      img.src = loadEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadPdi = () => {
    if (!encodedPdiBytes) return;
    const blob = new Blob([encodedPdiBytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sourceName.replace(/\.[^/.]+$/, '') + '.pdi';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-[#17181F] border border-[#262832] rounded-xl p-6">
        <h2 className="text-base font-bold text-white mb-1">
          PNG to Playdate PDI Encoder
        </h2>
        <p className="text-xs text-[#9FA4B5] max-w-2xl leading-relaxed">
          Compile standard PNG images into authentic Panic Playdate <code className="text-[#FFC700] font-mono">.pdi</code> binary files.
          The encoder automatically crops transparent boundaries to calculate optimal cell clip bounds and 32-bit stride alignment just like Panic's official <code className="text-[#FFC700] font-mono">pdc</code> compiler!
        </p>
      </div>

      {/* Main Grid: Upload & Controls vs Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#17181F] border border-[#262832] rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A1A6B7]">
              Source Image & Settings
            </h3>

            {/* Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 border border-dashed border-[#3A3E4E] hover:border-[#FFC700] rounded-lg bg-[#14151C] text-xs font-medium text-[#C8CBD6] hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <UploadCloud className="w-4 h-4 text-[#FFC700]" />
              Choose PNG / JPEG Image
            </button>

            {/* Threshold Slider */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#8E93A5]">B&W Threshold</span>
                <span className="text-white font-semibold">{threshold} / 255</span>
              </div>
              <input
                type="range"
                min="10"
                max="245"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-[#FFC700] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#636877] font-mono">
                <span>More Black</span>
                <span>Balanced (128)</span>
                <span>More White</span>
              </div>
            </div>

            {/* Compression Toggle */}
            <div className="pt-2 border-t border-[#23252E] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-white block">zlib Compression</span>
                <span className="text-[11px] text-[#7A7F90] block">
                  Match Playdate SDK standard compressed format
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCompressed(!isCompressed)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  isCompressed ? 'bg-[#FFC700]' : 'bg-[#2A2D3A]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isCompressed ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Output Download Action */}
            <div className="pt-3 border-t border-[#23252E] space-y-2">
              <button
                onClick={handleDownloadPdi}
                disabled={!encodedPdiBytes}
                className="w-full py-2.5 px-4 bg-[#FFC700] hover:bg-[#E6B300] active:scale-95 disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4" />
                Download Compiled .PDI ({encodedPdiBytes?.length || 0} bytes)
              </button>

              {encodedAsset && (
                <button
                  onClick={() => onLoadPdiToStudio(encodedAsset)}
                  className="w-full py-2 px-3 bg-[#20222B] hover:bg-[#282B37] text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-[#2D303C]"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-[#FFC700]" />
                  Open in Converter Studio
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Preview & Cell Crop Breakdown (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-[#17181F] border border-[#262832] rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A1A6B7] mb-4">
              1-Bit Playdate LCD Preview & Crop Bounds
            </h3>

            {/* Canvas Container */}
            <div className="min-h-[260px] rounded-lg bg-[#111216] border border-[#23252E] flex items-center justify-center p-8 transparency-checkerboard overflow-auto">
              <div className="relative">
                <canvas
                  ref={previewCanvasRef}
                  className="pixelated block shadow-lg border border-black/20"
                  style={{
                    width: (sourceImage?.width || 32) * 6,
                    height: (sourceImage?.height || 32) * 6,
                  }}
                />

                {/* Crop Box Overlay */}
                {encodedAsset && (
                  <div
                    className="absolute border border-dashed border-[#FFC700] pointer-events-none"
                    style={{
                      left: encodedAsset.cells[0].header.clipLeft * 6,
                      top: encodedAsset.cells[0].header.clipTop * 6,
                      width: encodedAsset.cells[0].header.clipWidth * 6,
                      height: encodedAsset.cells[0].header.clipHeight * 6,
                      boxShadow: '0 0 0 9999px rgba(255, 199, 0, 0.08)',
                    }}
                  >
                    <span className="absolute -top-5 left-0 text-[10px] font-mono text-[#FFC700] bg-black/80 px-1 rounded whitespace-nowrap">
                      Trimmed Cell: {encodedAsset.cells[0].header.clipWidth}×{encodedAsset.cells[0].header.clipHeight}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Generated Stats */}
            {encodedAsset && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono mt-4">
                <div className="p-2.5 rounded-lg bg-[#13141A] border border-[#23252E]">
                  <span className="text-[#6F7485] block text-[10px]">Dimensions</span>
                  <span className="text-white font-semibold">
                    {encodedAsset.cells[0].fullWidth} × {encodedAsset.cells[0].fullHeight}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#13141A] border border-[#23252E]">
                  <span className="text-[#6F7485] block text-[10px]">Active Clip Box</span>
                  <span className="text-[#FFC700] font-semibold">
                    {encodedAsset.cells[0].header.clipWidth} × {encodedAsset.cells[0].header.clipHeight}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#13141A] border border-[#23252E]">
                  <span className="text-[#6F7485] block text-[10px]">Stride (32-bit aligned)</span>
                  <span className="text-white font-semibold">
                    {encodedAsset.cells[0].header.stride} bytes/row
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#13141A] border border-[#23252E]">
                  <span className="text-[#6F7485] block text-[10px]">Output Binary Size</span>
                  <span className="text-[#84CC16] font-semibold">
                    {encodedPdiBytes?.length || 0} bytes
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
