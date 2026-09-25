import React, { useEffect, useCallback } from 'react';
import { apiUrl } from './config';
import { Sparkles, X } from 'lucide-react';
import { CapCutHeader } from './components/capcut/CapCutHeader';
import { MediaLibraryPanel } from './components/capcut/MediaLibraryPanel';
import { CanvasPreview } from './components/capcut/CanvasPreview';
import { PropertiesInspector } from './components/capcut/PropertiesInspector';
import { CapCutTimeline } from './components/capcut/CapCutTimeline';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { useShallow } from 'zustand/react/shallow';
import { useVideoStore } from './store/useVideoStore';

export const App: React.FC = () => {
  const {
    setEngineHealth,
    isTranscribing,
    transcribingStep,
    transcribeProgress,
    cancelTranscription,
    isPlaying,
    setIsPlaying,
    splitAtPlayhead,
    deleteSelectedTimelineItem,
    isSnapEnabled,
    setIsSnapEnabled,
    isBladeActive,
    setIsBladeActive
  } = useVideoStore(
    useShallow((state) => ({
      setEngineHealth: state.setEngineHealth,
      isTranscribing: state.isTranscribing,
      transcribingStep: state.transcribingStep,
      transcribeProgress: state.transcribeProgress,
      cancelTranscription: state.cancelTranscription,
      isPlaying: state.isPlaying,
      setIsPlaying: state.setIsPlaying,
      splitAtPlayhead: state.splitAtPlayhead,
      deleteSelectedTimelineItem: state.deleteSelectedTimelineItem,
      isSnapEnabled: state.isSnapEnabled,
      setIsSnapEnabled: state.setIsSnapEnabled,
      isBladeActive: state.isBladeActive,
      setIsBladeActive: state.setIsBladeActive,
    }))
  );

  // Poll Local AI Engine status
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        let res: Response | null = null;
        try {
          res = await fetch(apiUrl('/api/health'));
        } catch (fetchErr) {
          if (apiUrl('/api/health').includes('127.0.0.1')) {
            try {
              res = await fetch('http://localhost:8000/api/health');
            } catch {
              throw fetchErr;
            }
          } else {
            throw fetchErr;
          }
        }
        if (res && res.ok) {
          const data = await res.json();
          if (isMounted) setEngineHealth(data);
        } else {
          if (isMounted) {
            setEngineHealth({
              status: 'offline',
              device: `Offline (HTTP ${res?.status || 500})`,
              cuda_available: false,
              whisper_available: false,
              ffmpeg_available: false,
              active_models: []
            });
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setEngineHealth({
            status: 'offline',
            device: `Offline (${err?.message || 'Connecting...'})`,
            cuda_available: false,
            whisper_available: false,
            ffmpeg_available: false,
            active_models: []
          });
        }
      }
    };

    checkHealth();
    const t1 = setTimeout(checkHealth, 1500);
    const t2 = setTimeout(checkHealth, 3500);
    const t3 = setTimeout(checkHealth, 6000);
    const interval = setInterval(checkHealth, 10000);

    return () => {
      isMounted = false;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(interval);
    };
  }, [setEngineHealth]);

  // Global Keyboard Shortcuts (Space: Play/Pause, Ctrl+B: Split, Del: Delete, N: Snap)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // If typing inside an input, textarea, select, button, or contentEditable, don't trigger shortcuts
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'BUTTON' ||
      target.isContentEditable
    ) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      setIsPlaying(!isPlaying);
    } else if (e.code === 'Delete' || e.code === 'Backspace') {
      deleteSelectedTimelineItem();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      splitAtPlayhead();
    } else if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey) {
      setIsBladeActive(!isBladeActive);
    } else if (e.key.toLowerCase() === 'v') {
      setIsBladeActive(false);
    } else if (e.key.toLowerCase() === 'n') {
      setIsSnapEnabled(!isSnapEnabled);
    }
  }, [isPlaying, setIsPlaying, deleteSelectedTimelineItem, splitAtPlayhead, isBladeActive, setIsBladeActive, isSnapEnabled, setIsSnapEnabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#09090b] text-zinc-100 overflow-hidden font-['Plus_Jakarta_Sans',Inter,-apple-system,BlinkMacSystemFont,sans-serif] select-none">
      {/* 1. CapCut Studio Top Bar */}
      <CapCutHeader />

      {/* 2. CapCut 3-Panel Upper Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Media & Assets Library Panel */}
        <MediaLibraryPanel />

        {/* Center Stage: Video Canvas Monitor */}
        <CanvasPreview />

        {/* Right: Contextual Properties Inspector */}
        <PropertiesInspector />
      </div>

      {/* 3. CapCut Multi-Track Timeline (Bottom Half) */}
      <CapCutTimeline />

      {/* Modals */}
      <ExportModal />
      <SettingsModal />

      {/* macOS Frosted Glass Transcription Loading Card */}
      {isTranscribing && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-fade select-none">
          <div className="w-full max-w-md p-8 rounded-3xl bg-zinc-900/90 backdrop-blur-2xl border border-white/[0.12] shadow-2xl flex flex-col items-center relative overflow-hidden">
            {/* Ambient Radial Glow */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative mb-5">
              <div className="w-16 h-16 rounded-full border-4 border-white/[0.08] border-t-indigo-500 animate-spin flex items-center justify-center"></div>
              <Sparkles className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>

            <h3 className="text-base font-bold text-white tracking-tight mb-1.5 font-['Plus_Jakarta_Sans',sans-serif]">
              Transcribing Speech & Generating Captions
            </h3>
            <p className="text-xs text-indigo-300/90 mb-4 font-mono max-w-sm truncate bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              {transcribingStep || "Processing audio with Groq Whisper AI..."}
            </p>

            {/* Animated Progress Bar */}
            <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden mb-2.5 p-0.5 border border-white/[0.06]">
              <div
                className="bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, transcribeProgress)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-zinc-400 mb-5">{transcribeProgress}% completed</span>

            <button
              onClick={cancelTranscription}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-semibold border border-white/[0.08] transition-all"
            >
              <X className="w-3.5 h-3.5 text-red-400" />
              <span>Cancel Transcription</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
