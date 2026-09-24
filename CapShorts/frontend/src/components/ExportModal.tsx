import React, { useState, useEffect, useRef } from 'react';
import { X, Share2, CheckCircle2, Download, Sparkles, FolderDown, Zap, Flame, Loader2, FileText } from 'lucide-react';
import { useVideoStore } from '../store/useVideoStore';
import { apiUrl } from '../config';
import templatesData from '../data/templates.json';
import { SubtitlePreset } from '../types';

const formatSrtTime = (seconds: number) => {
  const s = Math.max(0, seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const millis = Math.min(999, Math.round((s - Math.floor(s)) * 1000));
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
};

const formatVttTime = (seconds: number) => {
  const s = Math.max(0, seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const millis = Math.min(999, Math.round((s - Math.floor(s)) * 1000));
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
};

const chunkTranscript = (words: any[]) => {
  const sorted = [...words].sort((a, b) => (a.start || 0) - (b.start || 0));
  const blocks: { start: number; end: number; text: string }[] = [];
  let curr: any[] = [];
  for (const w of sorted) {
    if (!w.word) continue;
    curr.push(w);
    const lineLen = curr.map(x => x.word).join(' ').length;
    const isPunct = /[.!?]$/.test(String(w.word).trim());
    if (curr.length >= 6 || lineLen >= 36 || isPunct) {
      blocks.push({
        start: curr[0].start || 0,
        end: curr[curr.length - 1].end || curr[0].start + 1,
        text: curr.map(x => String(x.word).trim()).join(' ')
      });
      curr = [];
    }
  }
  if (curr.length > 0) {
    blocks.push({
      start: curr[0].start || 0,
      end: curr[curr.length - 1].end || curr[0].start + 1,
      text: curr.map(x => String(x.word).trim()).join(' ')
    });
  }
  return blocks;
};

const formatSrtClient = (words: any[]) => {
  const blocks = chunkTranscript(words);
  return blocks.map((b, i) => `${i + 1}\n${formatSrtTime(b.start)} --> ${formatSrtTime(b.end)}\n${b.text}\n`).join('\n');
};

const formatVttClient = (words: any[]) => {
  const blocks = chunkTranscript(words);
  return 'WEBVTT\n\n' + blocks.map((b, i) => `${i + 1}\n${formatVttTime(b.start)} --> ${formatVttTime(b.end)}\n${b.text}\n`).join('\n');
};

export const ExportModal: React.FC = () => {
  const {
    isExportModalOpen,
    setIsExportModalOpen,
    isExporting,
    setIsExporting,
    exportProgress,
    setExportProgress,
    exportStatus,
    exportResultUrl,
    setExportResultUrl,
    transcript,
    activeTemplateId,
    customStyleOverrides,
    brollList,
    aspectRatio,
    clips,
    selectedClipId,
    videoFile,
    serverVideoPath
  } = useVideoStore();

  const activeClip = selectedClipId ? clips.find(c => c.id === selectedClipId) : null;

  const [resolution, setResolution] = useState<'1080x1920' | '1920x1080' | '1080x1080'>(
    aspectRatio === '9:16' || activeClip ? '1080x1920' : aspectRatio === '16:9' ? '1920x1080' : '1080x1080'
  );
  const [fps, setFps] = useState<number>(30);
  const [outputFilename, setOutputFilename] = useState(
    activeClip ? `viral_short_${activeClip.duration}s.mp4` : 'capshorts_export.mp4'
  );
  const [exportingSubtitle, setExportingSubtitle] = useState<'srt' | 'vtt' | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (activeClip) {
      setOutputFilename(`viral_short_${Math.round(activeClip.duration)}s.mp4`);
      setResolution('1080x1920');
    }
  }, [activeClip]);

  if (!isExportModalOpen) return null;

  const handleDownloadVideo = async () => {
    if (!exportResultUrl || exportResultUrl === '#') return;
    setIsDownloading(true);
    try {
      const res = await fetch(exportResultUrl);
      if (!res.ok) throw new Error("File fetch failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = outputFilename || 'viral_short.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (e) {
      console.warn("Direct blob download error, falling back to direct open:", e);
      window.open(exportResultUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportSubtitles = async (format: 'srt' | 'vtt') => {
    if (!transcript || transcript.length === 0) return;
    setExportingSubtitle(format);
    try {
      const presets = templatesData as SubtitlePreset[];
      const preset = presets.find(p => p.id === activeTemplateId) || presets[0];

      let content = '';
      try {
        const res = await fetch(apiUrl('/api/export-subtitles'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            format,
            preset,
            custom_overrides: customStyleOverrides
          })
        });
        if (res.ok) {
          const data = await res.json();
          content = data.content;
        } else {
          content = format === 'srt' ? formatSrtClient(transcript) : formatVttClient(transcript);
        }
      } catch {
        content = format === 'srt' ? formatSrtClient(transcript) : formatVttClient(transcript);
      }

      const mimeType = format === 'srt' ? 'application/x-subrip' : 'text/vtt';
      const blob = new Blob([content], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const baseName = outputFilename.replace(/\.[^/.]+$/, "") || 'capshorts_captions';
      link.download = `${baseName}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (e) {
      console.warn("Subtitle export error:", e);
    } finally {
      setExportingSubtitle(null);
    }
  };

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportProgress(5, "Initializing Media Pipeline...");
    setExportResultUrl(null);

    const presets = templatesData as SubtitlePreset[];
    const preset = presets.find(p => p.id === activeTemplateId) || presets[0];

    try {
      let effectiveVideoPath = serverVideoPath;

      // If user imported a video directly without transcribing, sync source file to engine
      if (!effectiveVideoPath && videoFile) {
        setExportProgress(8, "Syncing video with rendering engine...");
        try {
          const formData = new FormData();
          formData.append('file', videoFile);
          const upRes = await fetch(apiUrl('/api/upload-video'), {
            method: 'POST',
            body: formData
          });
          if (upRes.ok) {
            const upData = await upRes.json();
            effectiveVideoPath = upData.video_path;
          }
        } catch (e) {
          console.warn("Video upload sync error:", e);
        }
      }

      const payload: any = {
        video_path: effectiveVideoPath || null,
        transcript: transcript,
        preset: preset,
        custom_overrides: customStyleOverrides,
        broll_clips: brollList.filter(b => b.enabled),
        output_filename: outputFilename,
        resolution: resolution,
        aspect_ratio: resolution === '1080x1920' ? '9:16' : resolution === '1920x1080' ? '16:9' : '1:1'
      };

      if (activeClip) {
        payload.clip_start = activeClip.start;
        payload.clip_end = activeClip.end;
      }

      const res = await fetch(apiUrl('/api/export'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Export request failed with code ${res.status}`);
      }

      const data = await res.json();
      const taskId = data.task_id;

      // Poll progress every 500ms with timeout and error handling
      let pollCount = 0;
      const maxPolls = 1200; // 10 minutes at 500ms intervals

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      pollIntervalRef.current = setInterval(async () => {
        pollCount += 1;
        if (pollCount > maxPolls) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setIsExporting(false);
          setExportProgress(0, 'Export timed out after 10 minutes.');
          return;
        }

        try {
          const pollRes = await fetch(apiUrl(`/api/export/progress/${taskId}`));
          if (pollRes.ok) {
            const taskData = await pollRes.json();
            
            if (taskData.error || taskData.status?.toLowerCase().includes('error')) {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setIsExporting(false);
              setExportProgress(0, taskData.error || 'Render failed on engine');
              return;
            }

            setExportProgress(taskData.progress, taskData.status);

            if (taskData.progress >= 100) {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setIsExporting(false);
              const cleanUrl = taskData.download_url ? apiUrl(taskData.download_url) : '#';
              setExportResultUrl(cleanUrl);
            }
          }
        } catch (e: any) {
          console.warn("Poll error:", e);
        }
      }, 500);

    } catch (err: any) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      setIsExporting(false);
      setExportProgress(0, `Export failed: ${err?.message || 'Could not communicate with render engine.'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade select-none">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {activeClip ? 'Export AI Viral Short (9:16)' : 'Export Full Video'}
              </h3>
              <p className="text-[11px] text-zinc-400">Hardware-accelerated local FFmpeg rendering</p>
            </div>
          </div>
          <button
            onClick={() => !isExporting && setIsExportModalOpen(false)}
            disabled={isExporting}
            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Active Clip Callout */}
          {activeClip && (
            <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-center space-x-2 text-indigo-300">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />
              <div>
                <p className="font-bold text-white">{activeClip.title}</p>
                <p className="text-[10px] text-indigo-400">
                  Trimming segment: {activeClip.start}s to {activeClip.end}s ({activeClip.duration}s duration)
                </p>
              </div>
            </div>
          )}

          {/* Export Settings */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                Output Filename
              </label>
              <input
                type="text"
                value={outputFilename}
                onChange={(e) => setOutputFilename(e.target.value)}
                disabled={isExporting}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Resolution
                </label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                  disabled={isExporting}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="1080x1920">1080x1920 (Vertical 9:16 Shorts/Reels)</option>
                  <option value="1920x1080">1920x1080 (Horizontal 16:9)</option>
                  <option value="1080x1080">1080x1080 (Square 1:1)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Framerate
                </label>
                <select
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value))}
                  disabled={isExporting}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value={30}>30 FPS (Standard)</option>
                  <option value={60}>60 FPS (Ultra Smooth)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Real-Time Progress Bar */}
          {isExporting && (
            <div className="p-4 bg-zinc-950/80 border border-indigo-500/30 rounded-xl space-y-2 animate-fade">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-300 flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  <span>{exportStatus}</span>
                </span>
                <span className="font-mono font-bold text-indigo-400">{exportProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300 rounded-full"
                  style={{ width: `${exportProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Export Complete State */}
          {!isExporting && exportProgress >= 100 && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center justify-between text-emerald-200 animate-fade">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="font-bold">Render Complete!</p>
                  <p className="text-[10px] text-emerald-300/80">Saved without watermarks or quality loss.</p>
                </div>
              </div>
              {exportResultUrl && (
                <button
                  onClick={handleDownloadVideo}
                  disabled={isDownloading}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-emerald-900/30"
                >
                  {isDownloading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{isDownloading ? 'Saving...' : 'Save Video'}</span>
                </button>
              )}
            </div>
          )}

          {/* Subtitle Export Section */}
          <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-zinc-300 font-semibold">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Export Subtitles Only</span>
              </div>
              <span className="text-[10px] text-zinc-500">Standalone .SRT / .VTT</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Download accurate time-aligned captions to upload directly to YouTube Shorts, TikTok, or import into Premiere & DaVinci Resolve.
            </p>
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => handleExportSubtitles('srt')}
                disabled={!transcript || transcript.length === 0 || exportingSubtitle !== null}
                className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-all active:scale-95 disabled:opacity-40"
              >
                {exportingSubtitle === 'srt' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span>Download .SRT</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportSubtitles('vtt')}
                disabled={!transcript || transcript.length === 0 || exportingSubtitle !== null}
                className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-all active:scale-95 disabled:opacity-40"
              >
                {exportingSubtitle === 'vtt' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span>Download .VTT</span>
              </button>
            </div>
          </div>

          {/* Creator AdSense / Sponsor Card Placeholder */}
          <div className="p-3 bg-gradient-to-r from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-zinc-300">CapShorts Community Edition</p>
                <p className="text-[10px] text-zinc-500">Free, Local-First, Open-Source Alternative</p>
              </div>
            </div>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
              FREE / NO WATERMARK
            </span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/50 flex items-center justify-end space-x-2">
          <button
            onClick={() => setIsExportModalOpen(false)}
            disabled={isExporting}
            className="px-3.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleStartExport}
            disabled={isExporting}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <FolderDown className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Rendering...' : 'Start Render'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
