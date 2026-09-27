import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useVideoStore } from '../../store/useVideoStore';
import { apiUrl } from '../../config';
import { AspectRatio, WordToken } from '../../types';

// Deterministic PRNG for stable waveforms/filmstrips
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0');
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function formatTimecode(sec: number, fps: number = 30) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ff = Math.floor((sec % 1) * fps);
  return {
    time: `${pad2(m)}:${pad2(s)}`,
    frames: `:${pad2(ff)}`,
    full: `${pad2(m)}:${pad2(s)}:${pad2(ff)}`
  };
}

function makeWords(text: string, startSec: number, durSec: number) {
  const parts = text.trim().split(/\s+/);
  const per = durSec / parts.length;
  return parts.map((w, i) => ({
    text: w,
    startSec: +(startSec + i * per).toFixed(2),
    endSec: +(startSec + (i + 1) * per).toFixed(2),
  }));
}

const FILM_GRADS = [
  'linear-gradient(135deg,#2b3a55,#131b2c)',
  'linear-gradient(135deg,#3a2c1c,#1c130a)',
  'linear-gradient(135deg,#1c3a30,#0d1c16)',
  'linear-gradient(135deg,#3a1c2c,#1d0d15)',
  'linear-gradient(135deg,#33331f,#17170d)',
];

const DEMO_VIDEO_CLIPS = [
  { id: 'v1', label: 'clip_01.mp4', start: 1.2, dur: 20.4, seed: 11 },
  { id: 'v2', label: 'clip_02.mp4', start: 22.8, dur: 15.6, seed: 42 },
  { id: 'v3', label: 'clip_03.mp4', start: 39.6, dur: 18.0, seed: 77 },
];

const DEMO_CAPTION_CLIPS = [
  { id: 'c1', start: 2.4, dur: 9.6, words: makeWords('ye 3 second tumhari video badal denge', 2.4, 9.6) },
  { id: 'c2', start: 13.2, dur: 7.2, words: makeWords('dekho kaise ye trick kaam karti hai', 13.2, 7.2) },
  { id: 'c3', start: 21.6, dur: 10.8, words: makeWords('agar tumne skip kiya toh bahut kuch miss karoge', 21.6, 10.8) },
  { id: 'c4', start: 34.8, dur: 8.4, words: makeWords('comment karo aur follow karna mat bhoolna', 34.8, 8.4) },
  { id: 'c5', start: 45.6, dur: 9.6, words: makeWords('subscribe karo next short ke liye', 45.6, 9.6) },
];

const DEMO_AUDIO_CLIP = {
  id: 'a1',
  label: 'dialogue.wav',
  start: 1.2,
  dur: 56.4,
  seed: 99,
  silences: [
    { start: 16.8, dur: 4.2 },
    { start: 33.0, dur: 3.0 },
    { start: 49.2, dur: 3.6 },
  ],
};

const MEDIA_LIBRARY = [
  { name: 'vlog_ep12_raw.mp4', dur: '12:40', g: 'linear-gradient(135deg,#2b3a55,#121a2a)' },
  { name: 'podcast_clip.mov', dur: '04:18', g: 'linear-gradient(135deg,#3a2c1c,#1d1409)' },
  { name: 'hook_take3.mp4', dur: '00:58', g: 'linear-gradient(135deg,#1c3a30,#0d1c16)' },
  { name: 'broll_city.mp4', dur: '02:07', g: 'linear-gradient(135deg,#3a1c2c,#1e0d15)' },
];

const TEMPLATES = [
  { n: 'Hormozi Bold', d: 'Heavy caps · yellow pop', c: '#fff', id: 'hormozi' },
  { n: 'Beast Viral', d: 'Word-by-word bounce', c: '#FACC15', id: 'beast' },
  { n: 'Neon Glow', d: 'Night-mode glow', c: '#5B9BFF', id: 'neon' },
  { n: 'Minimal Clean', d: 'Subtle lower-third', c: '#9C9C9C', id: 'minimal' },
];

const AUDIO_TRACKS = [
  { n: 'Phonk Drive', d: '02:34', seed: 500 },
  { n: 'Whoosh Hit', d: '00:02', seed: 501 },
  { n: 'Deep Bass Drop', d: '00:05', seed: 502 },
  { n: 'LoFi Night', d: '03:12', seed: 503 },
];

const FX_LIST = ['Zoom Blur', 'Glitch', 'Flash', 'Film Dust', 'Shake', 'VHS'];
const TRANS_LIST = ['Fade', 'Zoom', 'Spin', 'Whip', 'Morph', 'Light'];

export const CapShortsStudio: React.FC = () => {
  const {
    videoFile,
    videoUrl,
    duration: storeDuration,
    currentTime: storeCurrentTime,
    isPlaying: storeIsPlaying,
    aspectRatio,
    transcript,
    projectTitle,
    isSnapEnabled,
    timelineZoom,
    setVideo,
    setDuration,
    setCurrentTime,
    setIsPlaying,
    setAspectRatio,
    setProjectTitle,
    setIsSnapEnabled,
    setTimelineZoom,
    startTranscription,
    setIsSettingsModalOpen,
    setActiveTemplate,
  } = useVideoStore(
    useShallow((s) => ({
      videoFile: s.videoFile,
      videoUrl: s.videoUrl,
      duration: s.duration,
      currentTime: s.currentTime,
      isPlaying: s.isPlaying,
      aspectRatio: s.aspectRatio,
      transcript: s.transcript,
      projectTitle: s.projectTitle,
      isSnapEnabled: s.isSnapEnabled,
      timelineZoom: s.timelineZoom,
      setVideo: s.setVideo,
      setDuration: s.setDuration,
      setCurrentTime: s.setCurrentTime,
      setIsPlaying: s.setIsPlaying,
      setAspectRatio: s.setAspectRatio,
      setProjectTitle: s.setProjectTitle,
      setIsSnapEnabled: s.setIsSnapEnabled,
      setTimelineZoom: s.setTimelineZoom,
      startTranscription: s.startTranscription,
      setIsSettingsModalOpen: s.setIsSettingsModalOpen,
      setActiveTemplate: s.setActiveTemplate,
    }))
  );

  // Studio tabs and state
  const [activeRailTab, setActiveRailTab] = useState<'ai' | 'media' | 'text' | 'audio' | 'effects' | 'trans'>('media');
  const [activeInspTab, setActiveInspTab] = useState<'video' | 'audio' | 'text'>('video');
  const [selectedClip, setSelectedClip] = useState<{ trackId: string; clipId: string } | null>(null);

  // Playhead & Playback state (synced with video store or demo)
  const isRealVideo = Boolean(videoUrl && storeDuration > 0);
  const totalDuration = isRealVideo ? storeDuration : 60;
  const [playheadSec, setPlayheadSec] = useState(isRealVideo ? storeCurrentTime : 10.8);
  const [isPlaying, setLocalIsPlaying] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2300);
  }, []);

  // AI Lab state
  const [aiScore, setAiScore] = useState(92);
  const [aiIssues, setAiIssues] = useState([
    { key: 'silence', title: '3 silent gaps · 4.2s', sub: 'Dead air detected on A1', fixed: false },
    { key: 'hook', title: 'Weak hook · first 3s', sub: 'Retention drops 31% at start', fixed: false },
    { key: 'audio', title: 'Audio dip at 0:12', sub: 'Dialogue 9dB under music', fixed: false },
  ]);
  const [silencesRemoved, setSilencesRemoved] = useState(false);

  // Video Element Ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lanesRef = useRef<HTMLDivElement | null>(null);

  // Overlays
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'MP4' | 'MOV' | 'WebM'>('MP4');
  const [exportBitrate, setExportBitrate] = useState(20);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportDone, setExportDone] = useState(false);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const paletteInputRef = useRef<HTMLInputElement | null>(null);

  // Inspector controls state
  const [videoScale, setVideoScale] = useState(100);
  const [videoOpacity, setVideoOpacity] = useState(100);
  const [activeFilter, setActiveFilter] = useState('None');
  const [stabilizeOn, setStabilizeOn] = useState(true);

  const [audioVolume, setAudioVolume] = useState(80);
  const [audioFade, setAudioFade] = useState(1);
  const [voiceEnhanceOn, setVoiceEnhanceOn] = useState(true);
  const [denoiseOn, setDenoiseOn] = useState(false);

  const [subFont, setSubFont] = useState('Komika Axis');
  const [subSize, setSubSize] = useState(52);
  const [subCasing, setSubCasing] = useState('UPPER');
  const [subStroke, setSubStroke] = useState(5);

  // Synchronize playing state with store
  useEffect(() => {
    setLocalIsPlaying(storeIsPlaying);
  }, [storeIsPlaying]);

  // Synchronize storeCurrentTime when real video is loaded
  useEffect(() => {
    if (isRealVideo) {
      setPlayheadSec(storeCurrentTime);
    }
  }, [storeCurrentTime, isRealVideo]);

  // Playback RAF loop
  useEffect(() => {
    if (!isPlaying) return;
    let lastTs = performance.now();
    let animId: number;

    const tick = (ts: number) => {
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      setPlayheadSec((prev) => {
        const next = prev + dt;
        if (next >= totalDuration) {
          setIsPlaying(false);
          setLocalIsPlaying(false);
          return totalDuration;
        }
        return next;
      });
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, totalDuration, setIsPlaying]);

  // Keep HTML5 video in sync with playheadSec
  useEffect(() => {
    if (videoRef.current && isRealVideo) {
      if (Math.abs(videoRef.current.currentTime - playheadSec) > 0.3) {
        videoRef.current.currentTime = playheadSec;
      }
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [playheadSec, isPlaying, isRealVideo]);

  const togglePlayback = useCallback(() => {
    const next = !isPlaying;
    setIsPlaying(next);
    setLocalIsPlaying(next);
  }, [isPlaying, setIsPlaying]);

  const seekTo = useCallback(
    (sec: number) => {
      const s = clamp(sec, 0, totalDuration);
      setPlayheadSec(s);
      setCurrentTime(s);
      if (videoRef.current && isRealVideo) {
        videoRef.current.currentTime = s;
      }
    },
    [totalDuration, setCurrentTime, isRealVideo]
  );

  // Timeline click seek
  const handleLanesClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('.cs-clip') || target.closest('.cs-waveform')) return;
    if (!lanesRef.current) return;
    const r = lanesRef.current.getBoundingClientRect();
    const clickX = e.clientX - r.left;
    const sec = (clickX / r.width) * totalDuration;
    seekTo(sec);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = /INPUT|SELECT|TEXTAREA/.test(target.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
        setTimeout(() => paletteInputRef.current?.focus(), 50);
        return;
      }

      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      } else if (e.key.toLowerCase() === 's') {
        const tc = formatTimecode(playheadSec);
        showToast(`Split at ${tc.time}`);
      } else if (e.key.toLowerCase() === 'm') {
        showToast('Marker added');
      } else if (e.key === 'Escape') {
        setIsExportModalOpen(false);
        setIsPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayback, playheadSec, showToast]);

  // AI Lab Fix action
  const handleFixIssue = (key: string) => {
    const issue = aiIssues.find((i) => i.key === key);
    if (!issue || issue.fixed) return;

    if (key === 'silence') {
      setSilencesRemoved(true);
      showToast('Removed 3 silent gaps · saved 4.2s');
    } else if (key === 'hook') {
      setAiScore(97);
      showToast('Hook regenerated · score 97');
    } else if (key === 'audio') {
      showToast('Dialogue leveled · +9dB');
    }

    setAiIssues((prev) =>
      prev.map((i) => (i.key === key ? { ...i, fixed: true } : i))
    );
  };

  // Real Video File Import Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    setVideo(file, url, file.name);
    setProjectTitle(cleanName);
    setPlayheadSec(0);
    showToast(`Loaded ${file.name}`);

    // Auto trigger Whisper transcription
    startTranscription(file).catch((err) => {
      console.warn('Transcription auto-start warning:', err);
    });
  };

  // Convert real transcript into caption clips or use demo
  const captionClips = isRealVideo && transcript.length > 0
    ? (() => {
        // Group transcript words into short phrases (4-6 words)
        const groups: { id: string; start: number; dur: number; words: { text: string; startSec: number; endSec: number }[] }[] = [];
        let currentWords: WordToken[] = [];

        transcript.forEach((tok, idx) => {
          currentWords.push(tok);
          const isPunct = /[.?!]$/.test(tok.word);
          const isLong = currentWords.length >= 5;
          const isLast = idx === transcript.length - 1;

          if (isPunct || isLong || isLast) {
            const start = currentWords[0].start;
            const end = currentWords[currentWords.length - 1].end;
            groups.push({
              id: `c_${groups.length + 1}`,
              start,
              dur: Math.max(0.5, +(end - start).toFixed(2)),
              words: currentWords.map((w) => ({
                text: w.word,
                startSec: w.start,
                endSec: w.end,
              })),
            });
            currentWords = [];
          }
        });
        return groups;
      })()
    : DEMO_CAPTION_CLIPS;

  // Active word in current caption clip for Karaoke
  const activeCaptionClip = captionClips.find(
    (c) => playheadSec >= c.start && playheadSec <= c.start + c.dur
  );
  const activeWordObj = activeCaptionClip?.words.find(
    (w) => playheadSec >= w.startSec && playheadSec <= w.endSec
  );

  // Words window around active word for Preview
  const previewWords = (() => {
    if (!activeCaptionClip) return [];
    const words = activeCaptionClip.words;
    const curIdx = activeWordObj
      ? words.findIndex((w) => w.text === activeWordObj.text && w.startSec === activeWordObj.startSec)
      : 0;
    const startIdx = Math.max(0, curIdx - 2);
    const endIdx = Math.min(words.length, startIdx + 6);
    return words.slice(startIdx, endIdx).map((w, i) => ({
      text: w.text,
      isCurrent: w === activeWordObj,
      isHighlight: (startIdx + i) % 3 === 2,
    }));
  })();

  // Commands for Command Palette
  const paletteCommands = [
    {
      n: 'Split clip at playhead',
      k: 'S',
      run: () => showToast(`Split at ${formatTimecode(playheadSec).time}`),
    },
    { n: 'Remove silent gaps', k: 'AI', run: () => handleFixIssue('silence') },
    {
      n: 'Generate auto captions',
      k: 'AI',
      run: () => {
        if (videoFile) startTranscription(videoFile);
        showToast('Generating AI auto captions...');
      },
    },
    { n: 'Regenerate viral hook', k: 'AI', run: () => handleFixIssue('hook') },
    { n: 'Export video…', k: 'Ctrl E', run: () => setIsExportModalOpen(true) },
    {
      n: 'Toggle snapping',
      k: '',
      run: () => {
        setIsSnapEnabled(!isSnapEnabled);
        showToast(`Snapping ${!isSnapEnabled ? 'on' : 'off'}`);
      },
    },
    { n: 'Open AI Lab', k: '', run: () => setActiveRailTab('ai') },
    {
      n: 'Zoom timeline to fit',
      k: '',
      run: () => {
        setTimelineZoom(40);
        showToast('Zoom fit');
      },
    },
  ];

  const filteredCommands = paletteCommands.filter((c) =>
    c.n.toLowerCase().includes(paletteQuery.toLowerCase())
  );

  // Ruler tick helper
  const rulerTicks = [];
  for (let s = 0; s <= totalDuration; s += 2) {
    const isMajor = s % 10 === 0;
    const pct = (s / totalDuration) * 100;
    rulerTicks.push(
      <div
        key={`tick_${s}`}
        className={`cs-tick${isMajor ? ' is-major' : ''}`}
        style={{ left: `${pct}%` }}
      >
        {isMajor && <span>00:{pad2(s)}</span>}
      </div>
    );
  }

  // Audio Waveform bars generator
  const waveformBars = [];
  const waveRnd = mulberry32(DEMO_AUDIO_CLIP.seed);
  for (let i = 0; i < 150; i++) {
    waveformBars.push(
      <i
        key={`wb_${i}`}
        style={{ height: `${8 + Math.floor(waveRnd() * 40)}px` }}
      />
    );
  }

  // Export start simulation or backend export
  const handleStartExport = () => {
    setExportProgress(0);
    setExportDone(false);
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + 5 + Math.random() * 6);
      setExportProgress(Math.floor(p));
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(() => {
          setExportProgress(null);
          setExportDone(true);
        }, 350);
      }
    }, 120);
  };

  const tcObj = formatTimecode(playheadSec);

  return (
    <div className="cs-app" id="app" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', borderRadius: 0 }}>
      {/* Hidden File Input for Video Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/*"
        style={{ display: 'none' }}
      />

      {/* ============ TOP BAR ============ */}
      <header className="cs-topbar">
        <div className="cs-logo">CS</div>
        <div className="cs-brand">CapShorts</div>
        <div className="cs-vdiv"></div>

        {/* Project Title Button */}
        <button
          className="cs-project-btn"
          id="projectBtn"
          title="Switch project"
          onClick={() => {
            const newName = prompt('Enter project name:', projectTitle || 'My Viral Short 01');
            if (newName && newName.trim()) setProjectTitle(newName.trim());
          }}
        >
          <b>{projectTitle || 'My Viral Short 01'}</b>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Undo / Redo */}
        <button
          className="cs-icon-btn"
          id="undoBtn"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          onClick={() => showToast('Nothing to undo')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h10a6 6 0 010 12h-3" />
          </svg>
        </button>
        <button
          className="cs-icon-btn"
          id="redoBtn"
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          onClick={() => showToast('Nothing to redo')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 14l5-5-5-5" />
            <path d="M20 9H10a6 6 0 000 12h3" />
          </svg>
        </button>

        {/* Command Palette Button */}
        <button
          className="cs-icon-btn"
          id="paletteBtn"
          title="Command palette (Ctrl+K)"
          aria-label="Command palette"
          onClick={() => {
            setIsPaletteOpen(true);
            setTimeout(() => paletteInputRef.current?.focus(), 50);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </button>

        {/* Center: Aspect Ratio Selector (Preserved per User Constraint) */}
        <div className="cs-segmented" style={{ marginLeft: 8 }}>
          <button
            className={aspectRatio === '9:16' ? 'is-active' : ''}
            onClick={() => setAspectRatio('9:16')}
            title="Shorts, Reels, TikTok (9:16)"
          >
            📱 9:16 Shorts
          </button>
          <button
            className={aspectRatio === '16:9' ? 'is-active' : ''}
            onClick={() => setAspectRatio('16:9')}
            title="YouTube Landscape (16:9)"
          >
            🖥️ 16:9 Wide
          </button>
          <button
            className={aspectRatio === '1:1' ? 'is-active' : ''}
            onClick={() => setAspectRatio('1:1')}
            title="Square (1:1)"
          >
            ⏹️ 1:1 Square
          </button>
        </div>

        <div className="cs-spacer"></div>

        {/* Right side: NO AI Engine Text and NO Status Dot */}
        <div className="cs-concept-tag">V1.1.8</div>
        <div className="cs-saved" id="savedInd">
          <i></i>
          <span>Saved</span>
        </div>
        <button
          className="cs-btn-primary"
          id="exportOpen"
          onClick={() => {
            setExportProgress(null);
            setExportDone(false);
            setIsExportModalOpen(true);
          }}
        >
          Export
        </button>
        <div
          className="cs-avatar"
          id="avatarBtn"
          title="Settings (API Keys & Engine)"
          onClick={() => setIsSettingsModalOpen(true)}
          style={{ cursor: 'pointer' }}
        >
          A
        </div>
      </header>

      {/* ============ WORKSPACE ============ */}
      <div className="cs-workspace" style={{ flex: 1, minHeight: 0, height: 'auto' }}>
        {/* Left Rail */}
        <nav className="cs-rail" id="rail" aria-label="Library tabs">
          <button
            className={`cs-rail-btn is-ai ${activeRailTab === 'ai' ? 'is-active' : ''}`}
            data-tab="ai"
            onClick={() => setActiveRailTab('ai')}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 3l1.9 5.4L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.6z" />
              <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
            </svg>
            AI Lab
          </button>
          <button
            className={`cs-rail-btn ${activeRailTab === 'media' ? 'is-active' : ''}`}
            data-tab="media"
            onClick={() => setActiveRailTab('media')}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 9.5h18M7.5 5v4.5M16.5 5v4.5" />
            </svg>
            Media
          </button>
          <button
            className={`cs-rail-btn ${activeRailTab === 'text' ? 'is-active' : ''}`}
            data-tab="text"
            onClick={() => setActiveRailTab('text')}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M5 6V4h14v2M12 4v16m-3 0h6" />
            </svg>
            Text
          </button>
          <button
            className={`cs-rail-btn ${activeRailTab === 'audio' ? 'is-active' : ''}`}
            data-tab="audio"
            onClick={() => setActiveRailTab('audio')}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M9 18V6l10-2v11.5" />
              <circle cx="6.8" cy="18" r="2.4" />
              <circle cx="16.8" cy="15.5" r="2.4" />
            </svg>
            Audio
          </button>
          <button
            className={`cs-rail-btn ${activeRailTab === 'effects' ? 'is-active' : ''}`}
            data-tab="effects"
            onClick={() => setActiveRailTab('effects')}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 3l1.9 5.4L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.6z" />
            </svg>
            Effects
          </button>
          <button
            className={`cs-rail-btn ${activeRailTab === 'trans' ? 'is-active' : ''}`}
            data-tab="trans"
            onClick={() => setActiveRailTab('trans')}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 8h11l-2.5-2.5M20 16H9l2.5 2.5" />
            </svg>
            Transit.
          </button>
        </nav>

        {/* Side Panel */}
        <aside className="cs-panel">
          <div className="cs-panel-head">
            <h3 id="panelTitle">
              {activeRailTab === 'ai' && 'AI Lab'}
              {activeRailTab === 'media' && 'Media'}
              {activeRailTab === 'text' && 'Text'}
              {activeRailTab === 'audio' && 'Audio'}
              {activeRailTab === 'effects' && 'Effects'}
              {activeRailTab === 'trans' && 'Transitions'}
            </h3>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9C9C9C" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </div>

          <div className="cs-panel-body" id="panelBody">
            {/* MEDIA TAB */}
            {activeRailTab === 'media' && (
              <>
                <div
                  className="cs-import-zone"
                  id="importZone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setVideo(file, url, file.name);
                      setProjectTitle(file.name.replace(/\.[^/.]+$/, ''));
                      setPlayheadSec(0);
                      showToast(`Imported ${file.name}`);
                      startTranscription(file).catch(() => {});
                    }
                  }}
                >
                  <p>+ Import</p>
                  <small>Drag &amp; drop or browse files</small>
                </div>
                <div className="cs-section-label">Project media</div>
                <div className="cs-media-grid">
                  {videoFile ? (
                    <div
                      className="cs-media-card"
                      onClick={() => showToast('Active project video')}
                    >
                      <div className="cs-media-thumb" style={{ background: '#222' }}>
                        <span className="cs-duration">{formatTimecode(totalDuration).time}</span>
                      </div>
                      <p>{videoFile.name}</p>
                    </div>
                  ) : null}
                  {MEDIA_LIBRARY.map((m, idx) => (
                    <div
                      key={`media_${idx}`}
                      className="cs-media-card"
                      onClick={() => showToast('Inserted at playhead — wire to project model')}
                    >
                      <div className="cs-media-thumb" style={{ background: m.g }}>
                        <span className="cs-duration">{m.dur}</span>
                      </div>
                      <p>{m.name}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* TEXT TAB */}
            {activeRailTab === 'text' && (
              <>
                <div className="cs-section-label">Text templates</div>
                {TEMPLATES.map((t) => (
                  <div
                    key={t.n}
                    className="cs-template-row"
                    onClick={() => {
                      setActiveTemplate(t.id);
                      showToast(`${t.n} applied`);
                    }}
                  >
                    <div className="cs-aa" style={{ color: t.c }}>
                      Ag
                    </div>
                    <div>
                      <b>{t.n}</b>
                      <small>{t.d}</small>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* AUDIO TAB */}
            {activeRailTab === 'audio' && (
              <>
                <div className="cs-section-label">Music &amp; SFX</div>
                {AUDIO_TRACKS.map((t, i) => {
                  const mrnd = mulberry32(t.seed);
                  const bars = [];
                  for (let j = 0; j < 26; j++) {
                    bars.push(
                      <i
                        key={`bar_${j}`}
                        style={{ height: `${5 + Math.floor(mrnd() * 20)}px` }}
                      />
                    );
                  }
                  return (
                    <div key={t.n} className="cs-audio-row">
                      <div className="cs-miniwave">{bars}</div>
                      <div>
                        <b>{t.n}</b>
                        <small>{t.d}</small>
                      </div>
                      <button
                        className="cs-add-btn"
                        aria-label={`Add ${t.n}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast('Added to A1 at playhead');
                        }}
                      >
                        +
                      </button>
                    </div>
                  );
                })}
              </>
            )}

            {/* EFFECTS & TRANSITIONS TABS */}
            {(activeRailTab === 'effects' || activeRailTab === 'trans') && (
              <>
                <div className="cs-section-label">
                  {activeRailTab === 'effects' ? 'Video effects' : 'Transitions'}
                </div>
                <div className="cs-fx-grid">
                  {(activeRailTab === 'effects' ? FX_LIST : TRANS_LIST).map((n, i) => {
                    const grads = [
                      '#1d2b4f,#0d1526',
                      '#3b1d4f,#160d26',
                      '#1d4f3a,#0d2618',
                      '#4f3a1d,#261a0d',
                      '#4f1d2b,#260d14',
                      '#2b3a55,#101826',
                    ];
                    return (
                      <div
                        key={n}
                        className="cs-fx-card"
                        onClick={() =>
                          showToast(
                            `${activeRailTab === 'effects' ? 'Effect' : 'Transition'} queued — select a clip first`
                          )
                        }
                      >
                        <div
                          className="cs-fx-thumb"
                          style={{
                            background: `linear-gradient(135deg,${grads[i % grads.length]})`,
                          }}
                        />
                        <p>{n}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* AI LAB TAB */}
            {activeRailTab === 'ai' && (
              <>
                <div className="cs-prop-card">
                  <h4>
                    AI Analysis <span className="cs-pill">LIVE</span>
                  </h4>
                  <div className="cs-score">
                    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`Viral score ${aiScore} out of 100`}>
                      <circle cx="42" cy="42" r="34" fill="none" stroke="#2a2a2a" strokeWidth="9" />
                      <circle
                        id="donutArc"
                        cx="42"
                        cy="42"
                        r="34"
                        fill="none"
                        stroke="#2E7CF6"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray="213.6"
                        strokeDashoffset={(213.6 * (1 - aiScore / 100)).toFixed(1)}
                        transform="rotate(-90 42 42)"
                        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)' }}
                      />
                      <text x="42" y="49" textAnchor="middle" fill="#F2F2F2" fontSize="21" fontWeight="800">
                        {aiScore}
                      </text>
                    </svg>
                    <div className="cs-big">
                      <b>{aiScore}</b>/100<br />Viral score · top 8%<br />of shorts this week
                    </div>
                  </div>
                  <div className="cs-field-label">Retention curve</div>
                  <svg viewBox="0 0 260 64" style={{ width: '100%', height: '60px', display: 'block' }} aria-hidden="true">
                    <defs>
                      <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#2E7CF6" stopOpacity=".4" />
                        <stop offset="1" stopColor="#2E7CF6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,10 C30,14 50,30 80,34 C110,38 130,26 160,30 C190,34 210,48 240,50 L260,52 L260,64 L0,64 Z"
                      fill="url(#rg)"
                    />
                    <path
                      d="M0,10 C30,14 50,30 80,34 C110,38 130,26 160,30 C190,34 210,48 240,50 L260,52"
                      fill="none"
                      stroke="#5B9BFF"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <div className="cs-prop-card">
                  <h4>
                    Issues found <span className="cs-pill">{aiIssues.filter((i) => !i.fixed).length}</span>
                  </h4>
                  {aiIssues.map((issue) => (
                    <div key={issue.key} className="cs-issue">
                      <div>
                        <b>{issue.title}</b>
                        <small>{issue.sub}</small>
                      </div>
                      <button
                        className={`cs-fix-btn${issue.fixed ? ' is-done' : ''}`}
                        data-fix={issue.key}
                        disabled={issue.fixed}
                        onClick={() => handleFixIssue(issue.key)}
                      >
                        {issue.fixed ? 'Fixed' : 'Fix'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Main Stage */}
        <main className="cs-stage">
          <div className="cs-preview">
            <div
              className="cs-canvas-916"
              id="canvas"
              style={{
                aspectRatio: aspectRatio === '16:9' ? '16 / 9' : aspectRatio === '1:1' ? '1 / 1' : '9 / 16',
                maxHeight: 'calc(100% - 20px)',
              }}
            >
              {/* Real Video Player or Dark Mock Canvas */}
              {isRealVideo && videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  playsInline
                  onClick={togglePlayback}
                  style={{
                    filter:
                      activeFilter === 'Vivid'
                        ? 'saturate(1.4) contrast(1.1)'
                        : activeFilter === 'Warm'
                        ? 'sepia(0.25) saturate(1.2)'
                        : activeFilter === 'Cool'
                        ? 'hue-rotate(180deg) saturate(0.9)'
                        : activeFilter === 'Noir'
                        ? 'grayscale(1)'
                        : 'none',
                    transform: `scale(${videoScale / 100})`,
                    opacity: videoOpacity / 100,
                  }}
                />
              ) : null}

              <div className="cs-preview-tag">PREVIEW</div>
              <div className="cs-aspect-tag">{aspectRatio}</div>

              {/* Dynamic Hormozi Karaoke Caption Overlay */}
              <div className="cs-caption-line" id="previewCaption">
                {previewWords.map((w, i) => (
                  <span
                    key={`pw_${i}_${w.text}`}
                    className={`cs-w${w.isCurrent ? ' is-on' : ''}${w.isHighlight ? ' cs-hl' : ''}`}
                    style={
                      w.isCurrent
                        ? {
                            background: 'rgba(46,124,246,.55)',
                            borderRadius: '4px',
                            padding: '0 6px',
                          }
                        : {}
                    }
                  >
                    {w.text}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Transport Bar */}
          <div className="cs-transport">
            <div className="cs-timecode" id="timecode">
              {tcObj.time}
              <span>{tcObj.frames}</span>
            </div>
            <div className="cs-spacer"></div>

            {/* Prev Edit Point */}
            <button
              className="cs-transport-btn"
              id="prevBtn"
              title="Previous edit point"
              aria-label="Previous"
              onClick={() => seekTo(playheadSec - 5)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 5h2v14H6zM20 5v14L9 12z" />
              </svg>
            </button>

            {/* Play / Pause Button */}
            <button
              className="cs-play-btn"
              id="playBtn"
              title="Play/Pause (Space)"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={togglePlayback}
            >
              {!isPlaying ? (
                <svg id="icoPlay" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg id="icoPause" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                </svg>
              )}
            </button>

            {/* Next Edit Point */}
            <button
              className="cs-transport-btn"
              id="nextBtn"
              title="Next edit point"
              aria-label="Next"
              onClick={() => seekTo(playheadSec + 5)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
              </svg>
            </button>

            <div className="cs-spacer"></div>
            <button
              className="cs-quality"
              id="qualityBtn"
              title="Preview quality"
              onClick={() => showToast('Preview quality: 1080p')}
            >
              1080p ▾
            </button>
            <button
              className="cs-transport-btn"
              title="Fullscreen"
              aria-label="Fullscreen"
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen?.();
                } else {
                  document.exitFullscreen?.();
                }
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H3v5m18-5h-5m5 13v5h-5m-13 0h5v-5" />
              </svg>
            </button>
          </div>
        </main>

        {/* Inspector (Right Panel) */}
        <aside className="cs-inspector">
          <div className="cs-tabs" id="inspTabs">
            <button
              className={activeInspTab === 'video' ? 'is-active' : ''}
              data-itab="video"
              onClick={() => setActiveInspTab('video')}
            >
              Video
            </button>
            <button
              className={activeInspTab === 'audio' ? 'is-active' : ''}
              data-itab="audio"
              onClick={() => setActiveInspTab('audio')}
            >
              Audio
            </button>
            <button
              className={activeInspTab === 'text' ? 'is-active' : ''}
              data-itab="text"
              onClick={() => setActiveInspTab('text')}
            >
              Text
            </button>
          </div>

          <div className="cs-inspector-body" id="inspBody">
            {activeInspTab === 'video' && (
              <>
                <div className="cs-prop-card">
                  <h4>Transform</h4>
                  <div className="cs-field-row">
                    <span className="cs-name">Scale</span>
                    <input
                      type="range"
                      className="cs-slider"
                      min={50}
                      max={200}
                      value={videoScale}
                      onChange={(e) => setVideoScale(+e.target.value)}
                      aria-label="Scale"
                    />
                    <span className="cs-val">{videoScale}%</span>
                  </div>
                  <div className="cs-field-row">
                    <span className="cs-name">Opacity</span>
                    <input
                      type="range"
                      className="cs-slider"
                      min={0}
                      max={100}
                      value={videoOpacity}
                      onChange={(e) => setVideoOpacity(+e.target.value)}
                      aria-label="Opacity"
                    />
                    <span className="cs-val">{videoOpacity}%</span>
                  </div>
                </div>

                <div className="cs-prop-card">
                  <h4>Filters</h4>
                  <div className="cs-chips">
                    {['None', 'Vivid', 'Warm', 'Cool', 'Noir'].map((f) => (
                      <button
                        key={f}
                        className={`cs-chip${activeFilter === f ? ' is-active' : ''}`}
                        onClick={() => setActiveFilter(f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cs-prop-card">
                  <h4>Stabilization</h4>
                  <div className="cs-toggle-row">
                    <span>Reduce shake</span>
                    <button
                      className={`cs-toggle${!stabilizeOn ? ' is-off' : ''}`}
                      role="switch"
                      aria-checked={stabilizeOn}
                      aria-label="Stabilization"
                      onClick={() => setStabilizeOn(!stabilizeOn)}
                    />
                  </div>
                </div>
              </>
            )}

            {activeInspTab === 'audio' && (
              <>
                <div className="cs-prop-card">
                  <h4>Mix</h4>
                  <div className="cs-field-row">
                    <span className="cs-name">Volume</span>
                    <input
                      type="range"
                      className="cs-slider"
                      min={0}
                      max={100}
                      value={audioVolume}
                      onChange={(e) => setAudioVolume(+e.target.value)}
                      aria-label="Volume"
                    />
                    <span className="cs-val">{audioVolume}%</span>
                  </div>
                  <div className="cs-field-row">
                    <span className="cs-name">Fade</span>
                    <input
                      type="range"
                      className="cs-slider"
                      min={0}
                      max={5}
                      value={audioFade}
                      onChange={(e) => setAudioFade(+e.target.value)}
                      aria-label="Fade"
                    />
                    <span className="cs-val">{audioFade}s</span>
                  </div>
                  <div className="cs-toggle-row">
                    <span>Enhance voice</span>
                    <button
                      className={`cs-toggle${!voiceEnhanceOn ? ' is-off' : ''}`}
                      role="switch"
                      aria-checked={voiceEnhanceOn}
                      aria-label="Enhance voice"
                      onClick={() => setVoiceEnhanceOn(!voiceEnhanceOn)}
                    />
                  </div>
                  <div className="cs-toggle-row">
                    <span>Denoise</span>
                    <button
                      className={`cs-toggle${!denoiseOn ? ' is-off' : ''}`}
                      role="switch"
                      aria-checked={denoiseOn}
                      aria-label="Denoise"
                      onClick={() => setDenoiseOn(!denoiseOn)}
                    />
                  </div>
                </div>
              </>
            )}

            {activeInspTab === 'text' && (
              <>
                <div className="cs-prop-card">
                  <h4>Typography</h4>
                  <div className="cs-field-label">Font</div>
                  <select
                    className="cs-select"
                    value={subFont}
                    onChange={(e) => setSubFont(e.target.value)}
                  >
                    <option>Komika Axis</option>
                    <option>Anton</option>
                    <option>Montserrat ExtraBold</option>
                    <option>Bebas Neue</option>
                  </select>
                  <div className="cs-field-label">Size</div>
                  <div className="cs-field-row">
                    <span className="cs-name">Size</span>
                    <input
                      type="range"
                      className="cs-slider"
                      min={24}
                      max={120}
                      value={subSize}
                      onChange={(e) => setSubSize(+e.target.value)}
                      aria-label="Size"
                    />
                    <span className="cs-val">{subSize}px</span>
                  </div>
                  <div className="cs-field-label">Casing</div>
                  <div className="cs-segmented">
                    {['UPPER', 'lower', 'Title', 'Default'].map((c) => (
                      <button
                        key={c}
                        className={subCasing === c ? 'is-active' : ''}
                        onClick={() => setSubCasing(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cs-prop-card">
                  <h4>Style</h4>
                  <div className="cs-field-label">Fill / Highlight</div>
                  <div className="cs-swatches">
                    <div className="cs-swatch" onClick={() => showToast('Color #FFFFFF selected')}>
                      <div className="cs-swatch-box" style={{ background: '#FFFFFF' }} />
                      <code>#FFFFFF</code>
                    </div>
                    <div className="cs-swatch" onClick={() => showToast('Color #FACC15 selected')}>
                      <div className="cs-swatch-box" style={{ background: '#FACC15' }} />
                      <code>#FACC15</code>
                    </div>
                  </div>
                  <div className="cs-field-label">Stroke</div>
                  <div className="cs-field-row">
                    <span className="cs-name">Stroke</span>
                    <input
                      type="range"
                      className="cs-slider"
                      min={0}
                      max={12}
                      value={subStroke}
                      onChange={(e) => setSubStroke(+e.target.value)}
                      aria-label="Stroke"
                    />
                    <span className="cs-val">{subStroke}px</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* ============ TIMELINE ============ */}
      <section className="cs-timeline" aria-label="Timeline">
        {/* Toolbar */}
        <div className="cs-tl-toolbar">
          <button
            className="cs-tool"
            id="splitBtn"
            onClick={() => showToast(`Split at ${formatTimecode(playheadSec).time}`)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6" cy="6" r="2.5" />
              <circle cx="6" cy="18" r="2.5" />
              <path d="M8 7.5L20 19M8 16.5L20 5" />
            </svg>
            Split
            <kbd>S</kbd>
          </button>
          <button
            className="cs-tool"
            id="deleteBtn"
            onClick={() => showToast(selectedClip ? 'Clip deleted' : 'Select a clip first')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Delete
          </button>
          <div className="cs-tsep"></div>
          <button
            className="cs-tool"
            id="markerBtn"
            onClick={() => showToast('Marker added')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 3v18M5 4h13l-2.5 3.5L18 11H5" />
            </svg>
            Marker
            <kbd>M</kbd>
          </button>
          <button
            className={`cs-tool${isSnapEnabled ? ' is-active' : ''}`}
            id="snapBtn"
            onClick={() => {
              setIsSnapEnabled(!isSnapEnabled);
              showToast(`Snapping ${!isSnapEnabled ? 'on' : 'off'}`);
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 3v7a6 6 0 0012 0V3" />
              <path d="M6 3h4v4H6zm8 0h4v4h-4z" />
            </svg>
            Snapping
          </button>
          <div className="cs-spacer"></div>

          {/* Zoom */}
          <div className="cs-zoom">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3M8 11h6" />
            </svg>
            <input
              type="range"
              className="cs-slider"
              id="zoomSlider"
              min="0"
              max="100"
              value={timelineZoom}
              onChange={(e) => setTimelineZoom(+e.target.value)}
              aria-label="Timeline zoom"
            />
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
            </svg>
          </div>
          <button
            className="cs-tool"
            id="fitBtn"
            onClick={() => {
              setTimelineZoom(40);
              showToast('Zoom fit');
            }}
          >
            Fit
          </button>
        </div>

        {/* Tracks Body */}
        <div className="cs-tl-body">
          {/* Track Headers */}
          <div className="cs-trackheads">
            <div className="cs-track-corner">TRACKS</div>
            {/* V2 Captions */}
            <div className="cs-trackhead" style={{ height: '38px' }}>
              <span className="cs-tn">V2</span>
              <span className="cs-tlabel">Captions</span>
              <div className="cs-spacer"></div>
              <button className="cs-hbtn" title="Toggle track visibility" aria-label="Toggle captions visibility">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
              <button className="cs-hbtn" title="Lock track" aria-label="Lock captions">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 018 0v4" />
                </svg>
              </button>
            </div>

            {/* V1 Main video */}
            <div className="cs-trackhead" style={{ height: '56px' }}>
              <span className="cs-tn">V1</span>
              <span className="cs-tlabel">Main video</span>
              <div className="cs-spacer"></div>
              <button className="cs-hbtn" title="Toggle track visibility" aria-label="Toggle video visibility">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
              <button className="cs-hbtn" title="Lock track" aria-label="Lock video">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 018 0v4" />
                </svg>
              </button>
            </div>

            {/* A1 Audio */}
            <div className="cs-trackhead" style={{ height: '56px' }}>
              <span className="cs-tn">A1</span>
              <span className="cs-tlabel">Audio</span>
              <div className="cs-spacer"></div>
              <button className="cs-hbtn" title="Mute track" aria-label="Mute audio">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6" />
                </svg>
              </button>
              <button className="cs-hbtn" title="Lock track" aria-label="Lock audio">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 018 0v4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Lanes */}
          <div className="cs-lanes" id="lanes" ref={lanesRef} onClick={handleLanesClick}>
            {/* Ruler */}
            <div className="cs-ruler" id="ruler">
              {rulerTicks}
            </div>

            {/* V2 Lane: Captions */}
            <div className="cs-lane" id="laneV2" style={{ height: '38px' }} data-track="v2">
              {captionClips.map((c) => {
                const inClip = playheadSec >= c.start && playheadSec <= c.start + c.dur;
                const isSel = selectedClip?.trackId === 'v2' && selectedClip?.clipId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`cs-clip is-caption${isSel ? ' is-selected' : ''}`}
                    style={{
                      left: `${(c.start / totalDuration) * 100}%`,
                      width: `${(c.dur / totalDuration) * 100}%`,
                    }}
                    data-clip-id={c.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClip({ trackId: 'v2', clipId: c.id });
                    }}
                  >
                    <span className="cs-clip-label">
                      {c.words.map((w, wi) => {
                        const isOn = inClip && playheadSec >= w.startSec && playheadSec <= w.endSec;
                        return (
                          <span
                            key={`w_${wi}`}
                            className={`cs-w${isOn ? ' is-on' : ''}`}
                            data-ws={w.startSec}
                            data-we={w.endSec}
                          >
                            {w.text}{' '}
                          </span>
                        );
                      })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* V1 Lane: Main Video Clips */}
            <div className="cs-lane" id="laneV1" style={{ height: '56px' }} data-track="v1">
              {isRealVideo ? (
                <div
                  className={`cs-clip${selectedClip?.clipId === 'real_v1' ? ' is-selected' : ''}`}
                  style={{ left: '0%', width: '100%' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedClip({ trackId: 'v1', clipId: 'real_v1' });
                  }}
                >
                  <span className="cs-clip-label">{videoFile?.name || 'video.mp4'}</span>
                  {Array.from({ length: 9 }).map((_, fi) => (
                    <div
                      key={`frame_${fi}`}
                      className="cs-frame"
                      style={{ background: FILM_GRADS[fi % FILM_GRADS.length] }}
                    />
                  ))}
                </div>
              ) : (
                DEMO_VIDEO_CLIPS.map((c) => {
                  const crnd = mulberry32(c.seed);
                  const isSel = selectedClip?.trackId === 'v1' && selectedClip?.clipId === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`cs-clip${isSel ? ' is-selected' : ''}`}
                      style={{
                        left: `${(c.start / totalDuration) * 100}%`,
                        width: `${(c.dur / totalDuration) * 100}%`,
                      }}
                      data-clip-id={c.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClip({ trackId: 'v1', clipId: c.id });
                      }}
                    >
                      <span className="cs-clip-label">{c.label}</span>
                      {Array.from({ length: 9 }).map((_, fi) => (
                        <div
                          key={`df_${fi}`}
                          className="cs-frame"
                          style={{
                            background: FILM_GRADS[Math.floor(crnd() * FILM_GRADS.length)],
                          }}
                        />
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            {/* A1 Lane: Audio Waveform & Silence overlays */}
            <div className="cs-lane" id="laneA1" style={{ height: '56px' }} data-track="a1">
              <div
                className={`cs-waveform${selectedClip?.trackId === 'a1' ? ' is-selected' : ''}`}
                style={{
                  left: isRealVideo ? '0%' : `${(DEMO_AUDIO_CLIP.start / totalDuration) * 100}%`,
                  width: isRealVideo ? '100%' : `${(DEMO_AUDIO_CLIP.dur / totalDuration) * 100}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedClip({ trackId: 'a1', clipId: 'a1' });
                }}
              >
                {waveformBars}
                {!silencesRemoved &&
                  DEMO_AUDIO_CLIP.silences.map((s, idx) => (
                    <div
                      key={`silence_${idx}`}
                      className="cs-silence"
                      style={{
                        left: `${((s.start - DEMO_AUDIO_CLIP.start) / DEMO_AUDIO_CLIP.dur) * 100}%`,
                        width: `${(s.dur / DEMO_AUDIO_CLIP.dur) * 100}%`,
                      }}
                      title={`Silence ${s.dur.toFixed(1)}s — detected by AI`}
                    />
                  ))}
              </div>
            </div>

            {/* Playhead */}
            <div
              className="cs-playhead"
              id="playhead"
              style={{ left: `${(playheadSec / totalDuration) * 100}%` }}
            />
          </div>
        </div>
      </section>

      {/* ============ OVERLAYS ============ */}
      {/* 1. Export Modal */}
      {isExportModalOpen && (
        <div
          className="cs-modal-backdrop"
          id="exportModal"
          onClick={(e) => {
            if ((e.target as HTMLElement).id === 'exportModal') setIsExportModalOpen(false);
          }}
        >
          <div className="cs-modal" role="dialog" aria-modal="true" aria-label="Export video">
            <button
              className="cs-modal-close"
              id="exportClose"
              aria-label="Close"
              onClick={() => setIsExportModalOpen(false)}
            >
              ×
            </button>
            <h3>Export Video</h3>
            <div className="cs-field-label">Format</div>
            <div className="cs-segmented" id="fmtSeg">
              {(['MP4', 'MOV', 'WebM'] as const).map((fmt) => (
                <button
                  key={fmt}
                  className={exportFormat === fmt ? 'is-active' : ''}
                  onClick={() => setExportFormat(fmt)}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <div className="cs-field-label">Resolution</div>
            <select className="cs-select" id="resSel">
              <option>1080 × 1920 · Full HD</option>
              <option>2160 × 3840 · 4K</option>
              <option>720 × 1280 · HD</option>
            </select>

            <div className="cs-field-label">Frame rate</div>
            <select className="cs-select" id="fpsSel">
              <option>30 fps</option>
              <option>60 fps</option>
            </select>

            <div className="cs-field-label">Bitrate</div>
            <div className="cs-field-row">
              <input
                type="range"
                className="cs-slider"
                id="bitrate"
                min="8"
                max="40"
                value={exportBitrate}
                onChange={(e) => setExportBitrate(+e.target.value)}
              />
              <span className="cs-val" id="bitrateVal">
                {exportBitrate} Mbps
              </span>
            </div>

            <div className="cs-meta-row">
              <span>Estimated size</span>
              <span className="cs-pill" id="sizeEst">
                ~{Math.round((exportBitrate * totalDuration) / 8)} MB
              </span>
            </div>

            {!exportProgress && !exportDone && (
              <div id="exportForm">
                <button
                  className="cs-btn-block"
                  id="startExport"
                  style={{ marginTop: '16px' }}
                  onClick={handleStartExport}
                >
                  Start Export
                </button>
              </div>
            )}

            {exportProgress !== null && (
              <div id="exportProg">
                <div className="cs-progress">
                  <div id="pfill" style={{ width: `${exportProgress}%` }} />
                </div>
                <div className="cs-meta-row">
                  <span id="ptext">Rendering… {exportProgress}%</span>
                  <span className="cs-pill">H.264</span>
                </div>
              </div>
            )}

            {exportDone && (
              <div id="exportDone" style={{ textAlign: 'center', padding: '8px 0 2px' }}>
                <div className="cs-success-badge">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                </div>
                <p style={{ fontWeight: 800, fontSize: '13px', margin: 0 }}>Export complete</p>
                <p className="cs-muted" style={{ fontSize: '11px', margin: '3px 0 0' }} id="doneMeta">
                  {projectTitle || 'my-viral-short-01'}.{exportFormat.toLowerCase()} · {Math.round((exportBitrate * totalDuration) / 8)} MB
                </p>
                <div className="cs-row" style={{ marginTop: '14px', gap: '8px' }}>
                  <button
                    className="cs-btn-ghost"
                    onClick={() => {
                      showToast('Folder opened');
                      setIsExportModalOpen(false);
                    }}
                  >
                    Open folder
                  </button>
                  <button
                    className="cs-btn-ghost"
                    onClick={() => {
                      showToast('Opening YouTube studio...');
                      setIsExportModalOpen(false);
                    }}
                  >
                    YouTube
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Command Palette */}
      {isPaletteOpen && (
        <div
          className="cs-palette-backdrop"
          id="palette"
          onClick={(e) => {
            if ((e.target as HTMLElement).id === 'palette') setIsPaletteOpen(false);
          }}
        >
          <div className="cs-palette">
            <input
              ref={paletteInputRef}
              id="paletteInput"
              placeholder="Type a command…  (Esc to close)"
              autoComplete="off"
              aria-label="Command palette"
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (filteredCommands.length > 0) {
                    setIsPaletteOpen(false);
                    filteredCommands[0].run();
                  }
                } else if (e.key === 'Escape') {
                  setIsPaletteOpen(false);
                }
              }}
            />
            <div id="paletteList">
              {filteredCommands.length > 0 ? (
                filteredCommands.map((cmd) => (
                  <div
                    key={cmd.n}
                    className="cs-palette-item"
                    onClick={() => {
                      setIsPaletteOpen(false);
                      cmd.run();
                    }}
                  >
                    {cmd.n}
                    {cmd.k ? <kbd>{cmd.k}</kbd> : null}
                  </div>
                ))
              ) : (
                <div className="cs-palette-empty">No matching command</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Floating Toast */}
      {toastMsg && (
        <div className="cs-toast" id="toast" role="status">
          {toastMsg}
        </div>
      )}
    </div>
  );
};
