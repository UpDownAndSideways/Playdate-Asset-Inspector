/**
 * @license
 * Sidebar / queue component listing all decoded Playdate assets
 */

import React from 'react';
import { PlaydateAsset } from '../lib/pdi';
import { FileImage, Film, Trash2, Download, Check, Sparkles } from 'lucide-react';

interface AssetListProps {
  assets: PlaydateAsset[];
  selectedAssetId: string | null;
  onSelectAsset: (id: string) => void;
  onRemoveAsset: (id: string) => void;
  onClearAll: () => void;
  onDownloadAsset: (asset: PlaydateAsset) => void;
}

export const AssetList: React.FC<AssetListProps> = ({
  assets,
  selectedAssetId,
  onSelectAsset,
  onRemoveAsset,
  onClearAll,
  onDownloadAsset,
}) => {
  return (
    <div className="bg-[#17181F] border border-[#262832] rounded-xl flex flex-col h-full max-h-[750px]">
      {/* Header */}
      <div className="p-4 border-b border-[#262832] flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Loaded Assets ({assets.length})
          </h3>
          <p className="text-xs text-[#828798]">
            Click an asset to inspect & export
          </p>
        </div>
        {assets.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-[#959AA9] hover:text-[#FF5555] transition-colors p-1"
            title="Clear all assets"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Asset Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-[#20212A]/50">
        {assets.map((asset) => {
          const isSelected = asset.id === selectedAssetId;
          const firstCell = asset.cells[0];
          const hasAlpha = asset.cells.some(c => c.hasAlpha);

          return (
            <div
              key={asset.id}
              onClick={() => onSelectAsset(asset.id)}
              className={`group p-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-between gap-3 ${
                isSelected
                  ? 'bg-[#22242E] ring-1 ring-[#FFC700]/70'
                  : 'hover:bg-[#1C1E26]'
              }`}
            >
              {/* Thumbnail + Info */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Mini Preview Box */}
                <div className="w-10 h-10 rounded bg-[#101115] border border-[#2D303C] flex items-center justify-center shrink-0 overflow-hidden transparency-checkerboard relative">
                  {firstCell && (
                    <img
                      src={`data:image/png;base64,${btoa(
                        firstCell.exactPngBytes.reduce(
                          (data, byte) => data + String.fromCharCode(byte),
                          ''
                        )
                      )}`}
                      alt={asset.fileName}
                      className="max-w-full max-h-full pixelated object-contain"
                    />
                  )}
                </div>

                {/* Text details */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white truncate max-w-[130px] sm:max-w-[160px]" title={asset.fileName}>
                      {asset.fileName}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-1 py-0.2 bg-[#262833] text-[#FFC700] rounded">
                      {asset.fileType}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-[#7E8394] font-mono mt-0.5">
                    <span>
                      {firstCell ? `${firstCell.fullWidth}×${firstCell.fullHeight}` : '—'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {asset.numCells > 1 ? `${asset.numCells} frames` : hasAlpha ? 'Alpha' : '1-bit'}
                    </span>
                    {asset.isCompressed && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#84CC16]">zlib</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadAsset(asset);
                  }}
                  className="p-1.5 rounded text-[#8B90A1] hover:text-[#FFC700] hover:bg-[#2A2C38] transition-colors"
                  title="Download PNG"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveAsset(asset.id);
                  }}
                  className="p-1.5 rounded text-[#8B90A1] hover:text-[#FF5555] hover:bg-[#2A2C38] transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
