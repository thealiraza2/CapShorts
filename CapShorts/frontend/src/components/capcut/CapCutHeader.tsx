import React, { useState, useEffect } from 'react';
import {
  Film,
  Smartphone,
  Monitor,
  Square,
  Share2,
  RefreshCw,
  Cpu,
  Undo2,
  Redo2,
  Settings,
  Edit3,
  Check
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useVideoStore } from '../../store/useVideoStore';
import { AspectRatio } from '../../types';
import { apiUrl } from '../../config';

export const CapCutHeader: React.FC = () => {
  const {
    aspectRatio,
    setAspectRatio,
    engineHealth,
    isExporting,
    setIsExportModalOpen,
    setIsSettingsModalOpen,
    videoFile,
    setVideo,
    projectTitle,
    setProjectTitle
  } = useVideoStore(
    useShallow((state) => ({
      aspectRatio: state.aspectRatio,
      setAspectRatio: state.setAspectRatio,
      engineHealth: state.engineHealth,
      isExporting: state.isExporting,
      setIsExportModalOpen: state.setIsExportModalOpen,
      setIsSettingsModalOpen: state.setIsSettingsModalOpen,
      videoFile: state.videoFile,
      setVideo: state.setVideo,
      projectTitle: state.projectTitle,
      setProjectTitle: state.setProjectTitle,
    }))
  );

  const [hasUpdate, setHasUpdate] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(projectTitle);

  useEffect(() => {
    fetch(apiUrl('/api/system/update-status'))
      .then((res) => res.json())
      .then((data) => {
        if (data?.update_available) setHasUpdate(true);
      })
      .catch(() => {});
  }, []);

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      setProjectTitle(tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleReset = () => {
    if (confirm("Reset current project and load a new video?")) {
      setVideo(null, null, '');
    }
  };

  return (
    <header className="h-13 bg-[#0d0d11]/95 backdrop-blur-2xl border-b border-white/[0.08] px-3.5 flex items-center justify-between z-30 select-none text-zinc-100 flex-shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      {/* Left: macOS Traffic Lights + Brand + Project Title + Undo/Redo */}
      <div className="flex items-center space-x-3">
        {/* macOS Window Controls (Traffic Lights) */}
        <div className="flex items-center space-x-2 pl-1 pr-2.5 group/traffic" title="macOS Window Controls">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e]/40 flex items-center justify-center text-[7px] text-black/60 font-bold opacity-90 group-hover/traffic:opacity-100 transition-opacity cursor-pointer shadow-xs">
            <span className="opacity-0 group-hover/traffic:opacity-100 transition-opacity leading-none">×</span>
          </div>
          <div className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d89e24]/40 flex items-center justify-center text-[7px] text-black/60 font-bold opacity-90 group-hover/traffic:opacity-100 transition-opacity cursor-pointer shadow-xs">
            <span className="opacity-0 group-hover/traffic:opacity-100 transition-opacity leading-none">−</span>
          </div>
          <div className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29]/40 flex items-center justify-center text-[7px] text-black/60 font-bold opacity-90 group-hover/traffic:opacity-100 transition-opacity cursor-pointer shadow-xs">
            <span className="opacity-0 group-hover/traffic:opacity-100 transition-opacity leading-none">+</span>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-white/[0.08]" />

        {/* CapShorts Brand Logo Badge */}
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 p-[1px] shadow-sm shadow-indigo-500/25 ring-1 ring-white/15 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="CapShorts"
              className="w-full h-full rounded-[7px] object-contain bg-[#121216]"
            />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-sm tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
              Cap<span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-cyan-300 bg-clip-text text-transparent">Shorts</span>
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 tracking-wider">
              STUDIO
            </span>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-white/[0.08]" />

        {/* Project Title Editor */}
        <div className="flex items-center space-x-1.5">
          {isEditingTitle ? (
            <div className="flex items-center space-x-1">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                autoFocus
                className="bg-zinc-900/90 border border-indigo-500/80 rounded-md px-2.5 py-1 text-xs text-white font-medium focus:outline-none w-48 shadow-inner ring-1 ring-indigo-500/30"
              />
              <button
                onClick={handleSaveTitle}
                className="p-1 hover:bg-white/[0.08] text-indigo-400 rounded-md transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setTempTitle(projectTitle);
                setIsEditingTitle(true);
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md hover:bg-white/[0.06] text-xs text-zinc-300 font-medium group transition-all border border-transparent hover:border-white/[0.08]"
              title="Click to rename project"
            >
              <span className="truncate max-w-[170px] text-zinc-200">{projectTitle}</span>
              <Edit3 className="w-3 h-3 text-zinc-500 opacity-40 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        {/* Undo / Redo controls */}
        <div className="flex items-center space-x-0.5 bg-zinc-900/70 border border-white/[0.06] rounded-lg p-0.5 opacity-50 cursor-not-allowed" title="History undo/redo is coming in next release">
          <button
            disabled
            className="p-1 rounded-md text-zinc-500 cursor-not-allowed"
            title="Undo (History stack disabled)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            disabled
            className="p-1 rounded-md text-zinc-500 cursor-not-allowed"
            title="Redo (History stack disabled)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center: macOS Segmented Aspect Ratio Switcher */}
      <div className="flex items-center bg-zinc-900/90 border border-white/[0.07] rounded-xl p-1 shadow-inner">
        <button
          onClick={() => setAspectRatio('9:16')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
            aspectRatio === '9:16'
              ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
          title="9:16 Vertical (Shorts, Reels, TikTok)"
        >
          <Smartphone className={`w-3.5 h-3.5 ${aspectRatio === '9:16' ? 'text-indigo-400' : 'text-zinc-400'}`} />
          <span>9:16 Shorts</span>
        </button>
        <button
          onClick={() => setAspectRatio('16:9')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
            aspectRatio === '16:9'
              ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
          title="16:9 Landscape (YouTube)"
        >
          <Monitor className={`w-3.5 h-3.5 ${aspectRatio === '16:9' ? 'text-indigo-400' : 'text-zinc-400'}`} />
          <span>16:9 Wide</span>
        </button>
        <button
          onClick={() => setAspectRatio('1:1')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
            aspectRatio === '1:1'
              ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
          title="1:1 Square (Instagram Post)"
        >
          <Square className={`w-3.5 h-3.5 ${aspectRatio === '1:1' ? 'text-indigo-400' : 'text-zinc-400'}`} />
          <span>1:1 Square</span>
        </button>
      </div>

      {/* Right: Engine Status & Apple-Grade Export Button */}
      <div className="flex items-center space-x-2.5">
        {/* Dynamic System Status Pill */}
        <div className="hidden sm:flex items-center space-x-2 text-xs bg-zinc-900/80 border border-white/[0.06] px-3 py-1 rounded-full text-zinc-300 shadow-sm">
          {engineHealth?.status === 'online' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse"></span>
              <span className="font-semibold text-zinc-200">AI Engine Online</span>
              <span className="text-zinc-600">·</span>
              <span className="text-[11px] font-medium text-indigo-300">
                {engineHealth?.cuda_available ? 'GPU Accelerated' : 'CPU Mode'}
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]"></span>
              <span className="font-semibold text-rose-300">AI Engine Offline</span>
            </>
          )}
        </div>

        {/* Replace/New Video */}
        {videoFile && (
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 font-medium text-xs border border-white/[0.08] transition-all active:scale-95"
            title="Import different video"
          >
            <RefreshCw className="w-3 h-3 text-indigo-400" />
            <span>New</span>
          </button>
        )}

        {/* Premium Studio Export Button */}
        <button
          onClick={() => setIsExportModalOpen(true)}
          disabled={isExporting}
          className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 via-indigo-600 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white font-semibold text-xs shadow-lg shadow-indigo-500/25 border border-indigo-400/30 transition-all active:scale-95 disabled:opacity-50 tracking-wide"
        >
          <Share2 className="w-3.5 h-3.5 text-white stroke-[2.2]" />
          <span>{isExporting ? 'Exporting...' : 'Export Video'}</span>
        </button>

        {/* Settings button with update notification badge */}
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="relative p-2 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 transition-colors border border-transparent hover:border-white/[0.06]"
          title={hasUpdate ? "New Update Available! Open Settings" : "System & AI Settings"}
        >
          <Settings className="w-4 h-4" />
          {hasUpdate && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-zinc-950 animate-pulse" />
          )}
        </button>
      </div>
    </header>
  );
};
