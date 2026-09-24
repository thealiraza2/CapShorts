import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Key,
  Cpu,
  Zap,
  CheckCircle2,
  ExternalLink,
  Film,
  RefreshCw,
  ArrowUpCircle,
  Download,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useVideoStore } from '../store/useVideoStore';
import { apiUrl } from '../config';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    groqApiKey,
    setGroqApiKey,
    selectedModel,
    setSelectedModel,
    engineHealth
  } = useVideoStore();

  const [activeSettingsTab, setActiveSettingsTab] = useState<'ai' | 'hardware' | 'broll' | 'privacy' | 'updates'>('ai');
  const [tempGroqKey, setTempGroqKey] = useState(groqApiKey);

  useEffect(() => {
    if (isSettingsModalOpen) {
      setTempGroqKey(groqApiKey);
    }
  }, [isSettingsModalOpen, groqApiKey]);
  const [pexelsKey, setPexelsKey] = useState(() => localStorage.getItem('capshorts_pexels_key') || localStorage.getItem('opencaption_pexels_key') || '');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Privacy & Anonymous Diagnostics State
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);
  const [telemetryMachineId, setTelemetryMachineId] = useState('');
  const [telemetryOs, setTelemetryOs] = useState('');
  const [isUpdatingTelemetry, setIsUpdatingTelemetry] = useState(false);

  const fetchTelemetrySettings = async () => {
    try {
      const res = await fetch(apiUrl('/api/system/telemetry-settings'));
      if (res.ok) {
        const data = await res.json();
        setTelemetryEnabled(data.enabled !== false);
        setTelemetryMachineId(data.machine_id || '');
        setTelemetryOs(data.os || '');
      }
    } catch {
      // ignore
    }
  };

  const handleToggleTelemetry = async (enabled: boolean) => {
    setTelemetryEnabled(enabled);
    setIsUpdatingTelemetry(true);
    try {
      await fetch(apiUrl('/api/system/telemetry-settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      setSaveMessage(enabled ? 'Anonymous diagnostics enabled.' : 'Anonymous diagnostics disabled. Zero telemetry sent.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      // ignore
    } finally {
      setIsUpdatingTelemetry(false);
    }
  };

  // Auto-Update State
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    current_version: string;
    current_commit: string;
    latest_commit: string;
    update_available: boolean;
    is_git_repo: boolean;
    platform: string;
    details: string;
    msi_download_url?: string;
    dmg_download_url?: string;
    release_url?: string;
  } | null>(null);
  const [updateStatusMessage, setUpdateStatusMessage] = useState<string | null>(null);

  const fetchUpdateStatus = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatusMessage(null);
    try {
      const res = await fetch(apiUrl('/api/system/update-status'));
      if (res.ok) {
        const data = await res.json();
        setUpdateInfo(data);
      } else {
        setUpdateStatusMessage('Failed to check for updates. Engine may be offline.');
      }
    } catch (err: any) {
      setUpdateStatusMessage('Could not reach backend update service.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    setIsApplyingUpdate(true);
    setUpdateStatusMessage('Pulling latest code from GitHub...');
    try {
      const res = await fetch(apiUrl('/api/system/apply-update'), { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setUpdateStatusMessage(data.message || 'Update applied successfully! Reloading studio in 3 seconds...');
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        setUpdateStatusMessage(`Update notice: ${data.message || data.error}`);
        setIsApplyingUpdate(false);
      }
    } catch (err: any) {
      setUpdateStatusMessage(`Update failed: ${err.message}`);
      setIsApplyingUpdate(false);
    }
  };

  if (!isSettingsModalOpen) return null;

  const handleSaveGroqKey = () => {
    setGroqApiKey(tempGroqKey.trim());
    setSaveMessage('Groq Cloud API key saved successfully!');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleSavePexelsKey = () => {
    localStorage.setItem('capshorts_pexels_key', pexelsKey.trim());
    setSaveMessage('Pexels B-Roll API key saved successfully!');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none animate-fade">
      <div className="bg-zinc-900/90 backdrop-blur-2xl border border-white/[0.12] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Clean Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-zinc-950/50">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">CapShorts Preferences</h3>
                <p className="text-[11px] text-zinc-400">Configure AI speech models, hardware engines, and integrations</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsModalOpen(false)}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* macOS Segmented Tab Navigation */}
        <div className="px-6 pt-3 pb-1 bg-zinc-950/30 border-b border-white/[0.06]">
          <div className="grid grid-cols-5 gap-1 bg-zinc-900/80 p-1 rounded-xl border border-white/[0.06]">
            <button
              onClick={() => setActiveSettingsTab('ai')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                activeSettingsTab === 'ai'
                  ? 'bg-zinc-800 text-white shadow-xs ring-1 ring-white/10 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI</span>
            </button>
            <button
              onClick={() => setActiveSettingsTab('hardware')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                activeSettingsTab === 'hardware'
                  ? 'bg-zinc-800 text-white shadow-xs ring-1 ring-white/10 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              <span>Hardware</span>
            </button>
            <button
              onClick={() => setActiveSettingsTab('broll')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                activeSettingsTab === 'broll'
                  ? 'bg-zinc-800 text-white shadow-xs ring-1 ring-white/10 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-amber-400" />
              <span>B-Roll</span>
            </button>
            <button
              onClick={() => {
                setActiveSettingsTab('privacy');
                fetchTelemetrySettings();
              }}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                activeSettingsTab === 'privacy'
                  ? 'bg-zinc-800 text-white shadow-xs ring-1 ring-white/10 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
              <span>Privacy</span>
            </button>
            <button
              onClick={() => {
                setActiveSettingsTab('updates');
                fetchUpdateStatus();
              }}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                activeSettingsTab === 'updates'
                  ? 'bg-zinc-800 text-white shadow-xs ring-1 ring-white/10 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Updates</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {saveMessage && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl px-4 py-3 flex items-center space-x-2 text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-medium">{saveMessage}</span>
            </div>
          )}

          {activeSettingsTab === 'ai' && (
            <div className="space-y-4">
              {/* Default Engine */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3 shadow-sm backdrop-blur-md">
                <label className="text-xs font-bold text-white block">Default Whisper Transcription Engine</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedModel('whisper-large-v3-turbo')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      selectedModel === 'whisper-large-v3-turbo'
                        ? 'bg-indigo-500/15 border-indigo-400 ring-1 ring-indigo-400/40 text-white shadow-xs'
                        : 'bg-black/40 border-white/[0.08] text-zinc-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1 text-indigo-400 font-bold">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Ultra Fast (Cloud AI)</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Transcribes 10-minute videos in ~2-3 seconds via Groq Whisper Large-v3.
                    </p>
                  </button>

                  <button
                    onClick={() => setSelectedModel('base')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      selectedModel === 'base'
                        ? 'bg-indigo-500/15 border-indigo-400 ring-1 ring-indigo-400/40 text-white shadow-xs'
                        : 'bg-black/40 border-white/[0.08] text-zinc-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1 text-zinc-200 font-bold">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Standard (Offline On-Device)</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Processes locally with CTranslate2. Zero internet required, 100% private.
                    </p>
                  </button>
                </div>
              </div>

              {/* Personal Groq Cloud API Key */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3 shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>Personal Groq Cloud API Key</span>
                  </label>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:underline flex items-center space-x-1 font-medium"
                  >
                    <span>Get Free Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Optional: Paste your personal Groq key for dedicated rate limits (7,200 videos/day free forever, no credit card required).
                </p>
                <div className="flex items-center space-x-2">
                  <input
                    type="password"
                    value={tempGroqKey}
                    onChange={(e) => setTempGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="flex-1 bg-black/50 border border-white/[0.08] focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                  <button
                    onClick={handleSaveGroqKey}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white font-semibold rounded-xl transition-all active:scale-95 shadow-md shadow-indigo-500/20"
                  >
                    Save Key
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSettingsTab === 'hardware' && (
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3.5 shadow-sm backdrop-blur-md">
                <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-sky-400" />
                  <span>Hardware & Video Acceleration</span>
                </h4>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="bg-black/40 p-3 rounded-xl border border-white/[0.06]">
                    <span className="text-zinc-500 block mb-0.5">Execution Device:</span>
                    <span className="font-semibold text-zinc-200">{engineHealth?.device || 'CPU (CTranslate2 Native)'}</span>
                  </div>
                  <div className="bg-black/40 p-3 rounded-xl border border-white/[0.06]">
                    <span className="text-zinc-500 block mb-0.5">Hardware Video Encoder:</span>
                    <span className="font-semibold text-sky-400">
                      {engineHealth?.hardware_encoder ? engineHealth.hardware_encoder.toUpperCase() : 'Apple VideoToolbox / libx264'}
                    </span>
                  </div>
                  <div className="bg-black/40 p-3 rounded-xl border border-white/[0.06]">
                    <span className="text-zinc-500 block mb-0.5">GPU Acceleration:</span>
                    <span className="font-semibold text-zinc-200">{engineHealth?.cuda_available ? 'NVIDIA CUDA Active' : 'Apple Silicon Metal / CPU'}</span>
                  </div>
                  <div className="bg-black/40 p-3 rounded-xl border border-white/[0.06]">
                    <span className="text-zinc-500 block mb-0.5">Local Daemon Status:</span>
                    <span className="font-semibold text-emerald-400 flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>{engineHealth?.status || 'Online'}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">Clear Local Media Cache</h4>
                  <p className="text-[11px] text-zinc-400">Clean up temporary split chunks, audio waveforms, and downloaded B-Roll.</p>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem('capshorts_cache');
                    localStorage.removeItem('opencaption_cache');
                    setSaveMessage('Temporary cache cleared successfully!');
                    setTimeout(() => setSaveMessage(null), 3000);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 font-semibold border border-white/[0.08] transition-all"
                >
                  Clear Cache
                </button>
              </div>
            </div>
          )}

          {activeSettingsTab === 'broll' && (
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3 shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <Film className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pexels Stock Video API Key</span>
                  </label>
                  <a
                    href="https://www.pexels.com/api/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-amber-400 hover:underline flex items-center space-x-1 font-medium"
                  >
                    <span>Get Free Pexels Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Used to automatically search and insert contextual HD B-Roll video overlays into your viral shorts.
                </p>
                <div className="flex items-center space-x-2">
                  <input
                    type="password"
                    value={pexelsKey}
                    onChange={(e) => setPexelsKey(e.target.value)}
                    placeholder="Pexels API Key..."
                    className="flex-1 bg-black/50 border border-white/[0.08] focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                  <button
                    onClick={handleSavePexelsKey}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold rounded-xl transition-all active:scale-95 shadow-md shadow-amber-500/20"
                  >
                    Save Key
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSettingsTab === 'privacy' && (
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Anonymous Usage Diagnostics</h4>
                      <p className="text-[11px] text-zinc-400">
                        Helps us measure active installs and crash rates. 100% anonymous.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleTelemetry(!telemetryEnabled)}
                    disabled={isUpdatingTelemetry}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                      telemetryEnabled ? 'bg-violet-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        telemetryEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="border-t border-white/[0.06] pt-3 text-[11px] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Telemetry Status:</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-md text-[10px] ${
                      telemetryEnabled
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-400 border border-white/[0.06]'
                    }`}>
                      {telemetryEnabled ? 'Active (Anonymous Ping)' : 'Disabled (Zero Telemetry)'}
                    </span>
                  </div>
                  {telemetryMachineId && telemetryEnabled && (
                    <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
                      <span>Anonymous Machine Hash:</span>
                      <span>{telemetryMachineId}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-black/30 border border-white/[0.06] rounded-xl p-3 space-y-1.5">
                    <span className="text-emerald-400 font-bold text-[11px] flex items-center space-x-1">
                      <span>✓ What We Track</span>
                    </span>
                    <ul className="text-[10px] text-zinc-400 space-y-1 list-disc list-inside">
                      <li>Anonymous machine hash ID</li>
                      <li>Operating system ({telemetryOs || 'OS'})</li>
                      <li>Number of video exports</li>
                      <li>Heartbeat session duration</li>
                    </ul>
                  </div>

                  <div className="bg-black/30 border border-white/[0.06] rounded-xl p-3 space-y-1.5">
                    <span className="text-red-400 font-bold text-[11px] flex items-center space-x-1">
                      <span>✗ What We NEVER Track</span>
                    </span>
                    <ul className="text-[10px] text-zinc-400 space-y-1 list-disc list-inside">
                      <li>Video or audio file content</li>
                      <li>Video file names or local paths</li>
                      <li>Transcripts or spoken speech</li>
                      <li>Any personal user credentials</li>
                    </ul>
                  </div>
                </div>

                <p className="text-[10px] text-zinc-500 italic">
                  Note: You can turn this off at any time. When disabled, zero network pings leave your computer.
                </p>
              </div>
            </div>
          )}

          {activeSettingsTab === 'updates' && (
            <div className="space-y-4">
              {/* Status Card */}
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      updateInfo?.update_available
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                        : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400'
                    }`}>
                      {updateInfo?.update_available ? (
                        <ArrowUpCircle className="w-5 h-5 animate-bounce" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {updateInfo?.update_available
                          ? 'New Update Available!'
                          : 'CapShorts is Up to Date'}
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        {updateInfo?.details || 'Check GitHub for new features and performance updates.'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={fetchUpdateStatus}
                    disabled={isCheckingUpdate || isApplyingUpdate}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-all disabled:opacity-50 flex items-center space-x-1.5 font-medium text-[11px]"
                    title="Check GitHub for updates"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>Check Now</span>
                  </button>
                </div>

                {/* System Specs & Version Badges */}
                <div className="grid grid-cols-3 gap-2 py-1">
                  <div className="bg-black/40 border border-white/[0.06] rounded-xl p-2.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Studio Version</span>
                    <span className="text-xs font-bold text-white mt-0.5 block">
                      v{updateInfo?.current_version || '1.1.2'}
                    </span>
                  </div>
                  <div className="bg-black/40 border border-white/[0.06] rounded-xl p-2.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Commit Hash</span>
                    <span className="text-xs font-mono font-bold text-zinc-300 mt-0.5 block truncate">
                      #{updateInfo?.current_commit || 'f5aad21'}
                    </span>
                  </div>
                  <div className="bg-black/40 border border-white/[0.06] rounded-xl p-2.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Platform</span>
                    <span className="text-xs font-bold text-sky-400 mt-0.5 block capitalize">
                      {updateInfo?.platform === 'darwin' ? 'macOS (Universal)' : updateInfo?.platform === 'windows' ? 'Windows (x64)' : 'Cross-Platform'}
                    </span>
                  </div>
                </div>

                {/* Action Area */}
                {updateInfo?.update_available ? (
                  <div className="pt-2 border-t border-white/[0.06] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-white">Latest Commit / Build:</span>
                        <span className="ml-2 font-mono text-emerald-400 text-xs font-bold">#{updateInfo.latest_commit}</span>
                      </div>
                      {updateInfo.is_git_repo ? (
                        <button
                          onClick={handleApplyUpdate}
                          disabled={isApplyingUpdate}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center space-x-2 disabled:opacity-50"
                        >
                          <Download className={`w-3.5 h-3.5 ${isApplyingUpdate ? 'animate-bounce' : ''}`} />
                          <span>{isApplyingUpdate ? 'Updating CapShorts...' : '1-Click Update Now'}</span>
                        </button>
                      ) : (
                        <a
                          href={updateInfo.platform === 'windows' ? updateInfo.msi_download_url : updateInfo.dmg_download_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-500/20 flex items-center space-x-2"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Latest Package</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Zero manual re-downloads required — updates apply in 2 seconds.</span>
                    </span>
                    <a
                      href={updateInfo?.release_url || 'https://github.com/thealiraza2/CapShorts/releases/latest'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-400 hover:text-white flex items-center space-x-1 hover:underline font-medium"
                    >
                      <span>Releases</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Status Message Alert */}
              {updateStatusMessage && (
                <div className={`border rounded-2xl px-4 py-3 flex items-center space-x-2 text-xs animate-in fade-in ${
                  updateStatusMessage.includes('successfully') || updateStatusMessage.includes('Reloading')
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-200'
                }`}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">{updateStatusMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] bg-zinc-950/50 flex justify-end">
          <button
            onClick={() => setIsSettingsModalOpen(false)}
            className="px-4 py-1.5 bg-white/[0.08] hover:bg-white/[0.12] text-white font-semibold text-xs rounded-xl border border-white/[0.08] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
