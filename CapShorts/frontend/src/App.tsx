import React, { useEffect } from 'react';
import { apiUrl } from './config';
import { Sparkles, X } from 'lucide-react';
import { CapShortsStudio } from './components/capcut/CapShortsStudio';
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
  } = useVideoStore(
    useShallow((state) => ({
      setEngineHealth: state.setEngineHealth,
      isTranscribing: state.isTranscribing,
      transcribingStep: state.transcribingStep,
      transcribeProgress: state.transcribeProgress,
      cancelTranscription: state.cancelTranscription,
    }))
  );

  // Silent Local AI Engine loopback check in background (No UI dot or text)
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

  return (
    <>
      {/* Exact CapShorts Studio UI with Full Working Functionality */}
      <CapShortsStudio />

      {/* Settings Modal (API Keys & Engine Setup) */}
      <SettingsModal />

      {/* Modern Frosted Glass Transcription Loading Card */}
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
              {transcribingStep || "Processing audio with AI Neural Engine..."}
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
    </>
  );
};
