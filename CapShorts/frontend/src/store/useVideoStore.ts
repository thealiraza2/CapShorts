import { create } from 'zustand';
import { apiUrl } from '../config';
import { WordToken, SubtitlePreset, BrollClip, VideoClip, VideoSegment, AspectRatio, EngineHealth, ExportSettings } from '../types';

interface VideoStoreState {
  // Media State
  videoFile: File | null;
  videoUrl: string | null;
  videoName: string;
  serverVideoPath: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  aspectRatio: AspectRatio;
  videoSegments: VideoSegment[];

  // Subtitle / Words
  transcript: WordToken[];
  activeTemplateId: string;
  customStyleOverrides: Partial<SubtitlePreset>;

  // AI Viral Shorts / Clips
  clips: VideoClip[];
  selectedClipId: string | null;

  // B-roll
  brollList: BrollClip[];

  // Turbo Groq & Mode
  groqApiKey: string;
  rangeMode: 'full' | 'short_60s' | 'short_180s';

  // App / Engine Status
  engineHealth: EngineHealth | null;
  isTranscribing: boolean;
  transcribeProgress: number;
  transcribingStep: string;
  isExporting: boolean;
  exportProgress: number;
  exportStatus: string;
  exportResultUrl: string | null;
  isExportModalOpen: boolean;
  isSettingsModalOpen: boolean;
  isScrubbing: boolean;
  activeTab: 'presets' | 'broll' | 'clips' | 'inspector';
  exportSettings: ExportSettings;
  silenceBackup: { transcript: WordToken[]; duration: number; videoSegments: VideoSegment[] } | null;

  setIsSettingsModalOpen: (open: boolean) => void;
  setIsScrubbing: (scrubbing: boolean) => void;

  // Actions
  setVideo: (file: File | null, url: string | null, name?: string) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setVideoSegments: (segments: VideoSegment[]) => void;

  setTranscript: (words: WordToken[]) => void;
  updateWord: (index: number, changes: Partial<WordToken>) => void;
  addWord: (word: WordToken, afterIndex?: number) => void;
  deleteWord: (index: number) => void;
  toggleKeyword: (index: number) => void;

  setClips: (clips: VideoClip[]) => void;
  selectClip: (id: string | null) => void;

  setGroqApiKey: (key: string) => void;
  setRangeMode: (mode: 'full' | 'short_60s' | 'short_180s') => void;

  setActiveTemplate: (id: string) => void;
  updateCustomStyle: (overrides: Partial<SubtitlePreset>) => void;
  resetCustomStyle: () => void;

  setBrollList: (list: BrollClip[]) => void;
  toggleBroll: (id: string) => void;
  addBroll: (clip: BrollClip) => void;
  removeBroll: (id: string) => void;

  setEngineHealth: (health: EngineHealth) => void;
  setIsTranscribing: (isTranscribing: boolean) => void;
  setTranscribeProgress: (progress: number) => void;
  setTranscribingStep: (step: string) => void;
  startTranscription: (file: File, model?: string, language?: string) => Promise<void>;
  cancelTranscription: () => void;

  setIsExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: number, status?: string) => void;
  setExportResultUrl: (url: string | null) => void;
  setIsExportModalOpen: (isOpen: boolean) => void;
  setActiveTab: (tab: 'presets' | 'broll' | 'clips' | 'inspector') => void;
  setExportSettings: (settings: Partial<ExportSettings>) => void;
  convertTranscriptScript: (targetScript: string) => Promise<void>;

  // CapCut Desktop Studio State
  projectTitle: string;
  timelineZoom: number;
  isBladeActive: boolean;
  isSnapEnabled: boolean;
  selectedTimelineItemId: string | null;
  selectedTimelineItemType: 'subtitle' | 'video' | 'audio' | null;
  safeAreaGuides: boolean;
  previewZoom: 'fit' | '50%' | '75%' | '100%';
  videoVolume: number;
  videoSpeed: number;
  videoScale: number;
  videoPosition: { x: number; y: number };
  videoFitMode: 'contain' | 'cover';
  activeInspectorTab: 'text' | 'video' | 'audio' | 'viral';

  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  setProjectTitle: (title: string) => void;
  setTimelineZoom: (zoom: number) => void;
  setIsBladeActive: (active: boolean) => void;
  setIsSnapEnabled: (enabled: boolean) => void;
  setSelectedTimelineItem: (id: string | null, type: 'subtitle' | 'video' | 'audio' | null) => void;
  setSafeAreaGuides: (enabled: boolean) => void;
  setPreviewZoom: (zoom: 'fit' | '50%' | '75%' | '100%') => void;
  setVideoVolume: (volume: number) => void;
  setVideoSpeed: (speed: number) => void;
  setVideoScale: (scale: number) => void;
  setVideoPosition: (pos: { x: number; y: number }) => void;
  setVideoFitMode: (mode: 'contain' | 'cover') => void;
  setActiveInspectorTab: (tab: 'text' | 'video' | 'audio' | 'viral') => void;
  splitAtPlayhead: () => void;
  splitSegmentAtTime: (time: number, targetType?: 'video' | 'subtitle') => void;
  deleteSelectedTimelineItem: () => void;

  // Next-Level Viral Features: Emojis & Silence Cut
  showEmojis: boolean;
  setShowEmojis: (show: boolean) => void;
  silenceRegions: Array<{ start: number; end: number; duration: number }>;
  isDetectingSilence: boolean;
  removedSilenceDuration: number;
  detectAndRemoveSilence: () => Promise<void>;
  undoSilenceRemoval: () => void;

  transcribeError: string | null;
  clearTranscribeError: () => void;
  loadSampleDemo: () => void;
}

export const useVideoStore = create<VideoStoreState>((set, get) => ({
  videoFile: null,
  videoUrl: null,
  videoName: '',
  serverVideoPath: null,
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  aspectRatio: '9:16',

  transcript: [],
  activeTemplateId: 'mrbeast-yellow-pop',
  customStyleOverrides: {},

  clips: [],
  selectedClipId: null,

  groqApiKey: typeof window !== 'undefined' ? localStorage.getItem('capshorts_groq_key') || localStorage.getItem('opencaption_groq_key') || '' : '',
  rangeMode: 'full',

  brollList: [],

  engineHealth: null,
  isTranscribing: false,
  transcribeError: null,
  clearTranscribeError: () => set({ transcribeError: null }),

  loadSampleDemo: () => set({
    transcript: [
      { id: 'w1', start: 0.3, end: 0.8, word: 'Unlock', keyword: false },
      { id: 'w2', start: 0.82, end: 1.4, word: 'Millions', keyword: true },
      { id: 'w3', start: 1.42, end: 1.7, word: 'of', keyword: false },
      { id: 'w4', start: 1.72, end: 2.1, word: 'views', keyword: false },
      { id: 'w5', start: 2.15, end: 2.45, word: 'with', keyword: false },
      { id: 'w6', start: 2.48, end: 2.8, word: 'AI', keyword: true },
      { id: 'w7', start: 2.82, end: 3.2, word: 'video', keyword: false },
      { id: 'w8', start: 3.22, end: 3.9, word: 'captions!', keyword: false },
      { id: 'w9', start: 4.1, end: 4.5, word: 'Stop', keyword: true },
      { id: 'w10', start: 4.52, end: 5.0, word: 'wasting', keyword: false },
      { id: 'w11', start: 5.02, end: 5.4, word: 'hours', keyword: false },
      { id: 'w12', start: 5.42, end: 6.1, word: 'manually', keyword: false },
      { id: 'w13', start: 6.15, end: 6.6, word: 'editing', keyword: false },
      { id: 'w14', start: 6.62, end: 7.3, word: 'subtitles.', keyword: false },
    ],
    clips: [
      {
        id: 'clip-sample-1',
        title: '🔥 The 10x Secret to Viral Shorts',
        hook: 'Unlock millions of views with AI video captions!',
        start: 0.0,
        end: 7.3,
        duration: 7.3,
        virality_score: 97,
        keywords: ['millions', 'ai', 'stop', 'views'],
        transcript_snippet: 'Unlock millions of views with AI video captions! Stop wasting hours manually editing subtitles.'
      }
    ],
    selectedClipId: null,
    transcribeError: null,
  }),

  // CapCut Desktop Studio State
  projectTitle: 'My Viral Short 01',
  timelineZoom: 45,
  isBladeActive: false,
  isSnapEnabled: true,
  selectedTimelineItemId: null,
  selectedTimelineItemType: null,
  safeAreaGuides: false,
  previewZoom: 'fit',
  videoVolume: 1,
  videoSpeed: 1,
  videoScale: 1.0,
  videoPosition: { x: 0, y: 0 },
  videoFitMode: 'contain',
  videoSegments: [],
  activeInspectorTab: 'text',
  transcribeProgress: 0,
  transcribingStep: '',
  isExporting: false,
  exportProgress: 0,

  selectedLanguage: 'auto',
  setSelectedLanguage: (selectedLanguage) => set({ selectedLanguage }),
  selectedModel: 'whisper-large-v3-turbo',
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  exportStatus: 'Idle',
  exportResultUrl: null,
  isExportModalOpen: false,
  isSettingsModalOpen: false,
  setIsSettingsModalOpen: (isSettingsModalOpen) => set({ isSettingsModalOpen }),
  isScrubbing: false,
  setIsScrubbing: (isScrubbing) => set({ isScrubbing }),
  activeTab: 'presets',
  exportSettings: {
    resolution: '1080x1920',
    fps: 30,
    crf: 18,
    outputFormat: 'mp4'
  },
  silenceBackup: null,

  setVideo: (file, url, name) => {
    const prevUrl = get().videoUrl;
    if (prevUrl && prevUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(prevUrl);
      } catch {
        // ignore
      }
    }
    const vName = name || (file ? file.name : 'Untitled Video');
    const curDur = get().duration || 10;
    set({
      videoFile: file,
      videoUrl: url,
      videoName: vName,
      serverVideoPath: null,
      isExporting: false,
      exportResultUrl: null,
      exportProgress: 0,
      exportStatus: 'Idle',
      brollList: [],
      silenceRegions: [],
      removedSilenceDuration: 0,
      silenceBackup: null,
      currentTime: 0,
      isPlaying: false,
      transcript: [],
      clips: [],
      selectedClipId: null,
      transcribeError: null,
      videoSegments: [{
        id: 'seg-1',
        name: vName,
        start: 0,
        end: curDur,
        sourceStart: 0,
        sourceEnd: curDur,
        duration: curDur
      }]
    });
  },

  setDuration: (duration) => {
    const { videoSegments, videoName } = get();
    if (!videoSegments || videoSegments.length <= 1) {
      set({
        duration,
        videoSegments: [{
          id: videoSegments?.[0]?.id || 'seg-1',
          name: videoSegments?.[0]?.name || videoName || 'Main Video Clip',
          start: 0,
          end: duration,
          sourceStart: 0,
          sourceEnd: duration,
          duration: duration
        }]
      });
    } else {
      set({ duration });
    }
  },

  setVideoSegments: (videoSegments) => set({ videoSegments }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),

  setTranscript: (transcript) => set({ transcript }),

  updateWord: (index, changes) => set((state) => {
    const updated = [...state.transcript];
    if (updated[index]) {
      updated[index] = { ...updated[index], ...changes };
    }
    return { transcript: updated };
  }),

  addWord: (word, afterIndex) => set((state) => {
    const updated = [...state.transcript];
    if (afterIndex !== undefined && afterIndex >= 0 && afterIndex < updated.length) {
      updated.splice(afterIndex + 1, 0, word);
    } else {
      updated.push(word);
    }
    return { transcript: updated };
  }),

  deleteWord: (index) => set((state) => {
    const updated = state.transcript.filter((_, i) => i !== index);
    return { transcript: updated };
  }),

  toggleKeyword: (index) => set((state) => {
    const updated = [...state.transcript];
    if (updated[index]) {
      updated[index] = { ...updated[index], keyword: !updated[index].keyword };
    }
    return { transcript: updated };
  }),

  setClips: (clips) => set({ clips }),
  selectClip: (id) => set((state) => {
    if (!id) {
      return { selectedClipId: null };
    }
    const clip = state.clips.find(c => c.id === id);
    if (clip) {
      return {
        selectedClipId: id,
        currentTime: clip.start
      };
    }
    return { selectedClipId: id };
  }),

  setGroqApiKey: (groqApiKey) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('capshorts_groq_key', groqApiKey);
    }
    set({ groqApiKey });
  },

  setRangeMode: (rangeMode) => set({ rangeMode }),

  setActiveTemplate: (id) => set({ activeTemplateId: id }),
  updateCustomStyle: (overrides) => set((state) => ({
    customStyleOverrides: { ...state.customStyleOverrides, ...overrides }
  })),
  resetCustomStyle: () => set({ customStyleOverrides: {} }),

  setBrollList: (brollList) => set({ brollList }),
  toggleBroll: (id) => set((state) => ({
    brollList: state.brollList.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
  })),
  addBroll: (clip) => set((state) => ({
    brollList: [...state.brollList, clip]
  })),
  removeBroll: (id) => set((state) => ({
    brollList: state.brollList.filter(c => c.id !== id)
  })),

  setEngineHealth: (engineHealth) => set({ engineHealth }),
  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
  setTranscribeProgress: (transcribeProgress) => set({ transcribeProgress }),
  setTranscribingStep: (transcribingStep) => set({ transcribingStep }),

  startTranscription: async (file: File, model?: string, language?: string) => {
    const { groqApiKey, rangeMode, selectedModel, selectedLanguage } = get();
    const effectiveModel = model || selectedModel || 'whisper-large-v3-turbo';
    const effectiveLanguage = language || selectedLanguage || 'auto';
    const isTurbo = Boolean(groqApiKey && groqApiKey.trim().length > 10);

    set({
      isTranscribing: true,
      transcribeError: null,
      transcribeProgress: 6,
      transcribingStep: isTurbo
        ? '⚡ Turbo Mode: Uploading and extracting audio...'
        : 'Uploading video to AI engine...'
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', effectiveModel);
      formData.append('language', effectiveLanguage);
      formData.append('range_mode', rangeMode);
      if (groqApiKey) {
        formData.append('groq_api_key', groqApiKey.trim());
      }

      const response = await fetch(apiUrl('/api/transcribe'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      if (data.words && Array.isArray(data.words) && data.words.length > 0) {
        const formatted = data.words.map((w: any, idx: number) => ({
          id: `w-${idx}-${Date.now()}`,
          start: w.start,
          end: w.end,
          word: w.word,
          keyword: Boolean(w.keyword),
        }));
        set({
          transcript: formatted,
          clips: data.clips || [],
          serverVideoPath: data.video_path || null,
          isTranscribing: false,
          transcribeProgress: 100,
          transcribingStep: '',
          transcribeError: null,
        });
        return;
      }

      if (data.task_id) {
        const taskId = data.task_id;
        if (data.video_path) {
          set({ serverVideoPath: data.video_path });
        }

        const pollTimer = setInterval(async () => {
          if (!get().isTranscribing) {
            clearInterval(pollTimer);
            return;
          }

          try {
            const progRes = await fetch(apiUrl(`/api/transcribe/progress/${taskId}`));
            if (progRes.ok) {
              const progData = await progRes.json();
              set({
                transcribeProgress: progData.progress || 15,
                transcribingStep: progData.step || 'Processing Speech AI...'
              });

              if (progData.status === 'completed') {
                clearInterval(pollTimer);
                if (progData.words && Array.isArray(progData.words) && progData.words.length > 0) {
                  const formatted = progData.words.map((w: any, idx: number) => ({
                    id: `w-${idx}-${Date.now()}`,
                    start: w.start,
                    end: w.end,
                    word: w.word,
                    keyword: Boolean(w.keyword),
                  }));
                  set({
                    transcript: formatted,
                    clips: progData.clips || [],
                    serverVideoPath: progData.video_path || get().serverVideoPath,
                    isTranscribing: false,
                    transcribeProgress: 100,
                    transcribingStep: '',
                    transcribeError: null,
                  });
                } else {
                  set({
                    isTranscribing: false,
                    transcribingStep: '',
                    transcribeError: 'No speech detected in this audio.'
                  });
                }
              } else if (progData.status === 'failed') {
                clearInterval(pollTimer);
                set({
                  isTranscribing: false,
                  transcribingStep: '',
                  transcribeError: progData.error || 'Transcription failed'
                });
              }
            }
          } catch (err) {
            console.warn("Transcription polling tick error:", err);
          }
        }, 500);
      } else {
        set({
          isTranscribing: false,
          transcribeProgress: 0,
          transcribingStep: '',
          transcribeError: 'Unexpected response format from AI transcription engine.'
        });
      }
    } catch (err: any) {
      console.warn("Transcription failed:", err);
      set({
        isTranscribing: false,
        transcribeProgress: 0,
        transcribingStep: '',
        transcribeError: err?.message || 'Failed to connect to AI backend'
      });
    }
  },

  cancelTranscription: () => set({
    isTranscribing: false,
    transcribeProgress: 0,
    transcribingStep: ''
  }),

  setIsExporting: (isExporting) => set({ isExporting }),
  setExportProgress: (exportProgress, status) => set({
    exportProgress,
    exportStatus: status || 'Processing...'
  }),
  setExportResultUrl: (exportResultUrl) => set({ exportResultUrl }),
  setIsExportModalOpen: (isExportModalOpen) => set({ isExportModalOpen }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setExportSettings: (settings) => set((state) => ({
    exportSettings: { ...state.exportSettings, ...settings }
  })),

  convertTranscriptScript: async (targetScript: string) => {
    const { transcript } = get();
    if (!transcript || transcript.length === 0) return;
    try {
      const res = await fetch(apiUrl('/api/transcript/convert-script'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: transcript, target_script: targetScript })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.words && Array.isArray(data.words)) {
          set({ transcript: data.words });
        }
      }
    } catch (e) {
      console.warn("Script conversion error:", e);
    }
  },

  setProjectTitle: (projectTitle) => set({ projectTitle }),
  setTimelineZoom: (timelineZoom) => set({ timelineZoom: Math.max(15, Math.min(180, timelineZoom)) }),
  setIsBladeActive: (isBladeActive) => set({ isBladeActive }),
  setIsSnapEnabled: (isSnapEnabled) => set({ isSnapEnabled }),
  setSelectedTimelineItem: (id, type) => set({ 
    selectedTimelineItemId: id, 
    selectedTimelineItemType: type,
    activeInspectorTab: type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'text'
  }),
  setSafeAreaGuides: (safeAreaGuides) => set({ safeAreaGuides }),
  setPreviewZoom: (previewZoom) => set({ previewZoom }),
  setVideoVolume: (videoVolume) => set({ videoVolume }),
  setVideoSpeed: (videoSpeed) => set({ videoSpeed }),
  setVideoScale: (videoScale) => {
    const normalized = videoScale > 5 ? videoScale / 100 : videoScale;
    set({ videoScale: Math.max(0.2, Math.min(4.0, normalized || 1.0)) });
  },
  setVideoPosition: (videoPosition) => set({ videoPosition }),
  setVideoFitMode: (videoFitMode) => set({ videoFitMode }),
  setActiveInspectorTab: (activeInspectorTab) => set({ activeInspectorTab }),

  splitAtPlayhead: () => {
    get().splitSegmentAtTime(get().currentTime);
  },

  splitSegmentAtTime: (time: number, targetType?: 'video' | 'subtitle') => {
    const { videoSegments, transcript } = get();
    let newSegments = [...videoSegments];
    let newTranscript = [...transcript];
    let newlyCreatedId: string | null = null;
    let newlyCreatedType: 'video' | 'subtitle' = targetType || 'video';

    // 1. Split Video Segment intersecting `time`
    const segIdx = newSegments.findIndex(s => time > s.start + 0.04 && time < s.end - 0.04);
    if (segIdx !== -1) {
      const target = newSegments[segIdx];
      const baseName = target.name.replace(/\s*\(Part\s*\d+\)/, '');
      const splitOffset = time - target.start;
      const part1: VideoSegment = {
        ...target,
        name: `${baseName} (Part 1)`,
        end: time,
        duration: Number((time - target.start).toFixed(2)),
        sourceEnd: Number((target.sourceStart + splitOffset).toFixed(2))
      };
      const genRandomSuffix = (len: number = 8) => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID().replace(/-/g, '').substring(0, len);
        }
        return Math.random().toString(36).substring(2, 2 + len);
      };

      const part2Id = `seg-${genRandomSuffix(8)}`;
      const part2: VideoSegment = {
        id: part2Id,
        name: `${baseName} (Part 2)`,
        start: time,
        end: target.end,
        sourceStart: Number((target.sourceStart + splitOffset).toFixed(2)),
        sourceEnd: target.sourceEnd,
        duration: Number((target.end - time).toFixed(2))
      };
      newSegments.splice(segIdx, 1, part1, part2);
      newlyCreatedId = part2Id;
      newlyCreatedType = 'video';
    }

    // 2. Split Subtitle Word / Phrase intersecting `time`
    if (targetType === 'subtitle' || !targetType) {
      const wordIdx = newTranscript.findIndex(w => time >= w.start && time <= w.end);
      if (wordIdx !== -1) {
        const targetWord = newTranscript[wordIdx];
        if (time - targetWord.start > 0.12 && targetWord.end - time > 0.12) {
          const randSuffix = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID().replace(/-/g, '').substring(0, 6)
            : Math.random().toString(36).substring(2, 8);
          const totalDur = Math.max(0.01, targetWord.end - targetWord.start);
          const ratio = Math.max(0.2, Math.min(0.8, (time - targetWord.start) / totalDur));
          const splitChar = Math.max(1, Math.min(targetWord.word.length - 1, Math.round(targetWord.word.length * ratio)));
          const w1 = targetWord.word.slice(0, splitChar);
          const w2 = targetWord.word.slice(splitChar);

          const p1 = { ...targetWord, id: `w-${randSuffix}-1`, word: w1, end: Number(time.toFixed(2)) };
          const p2 = { ...targetWord, id: `w-${randSuffix}-2`, word: w2, start: Number(time.toFixed(2)) };
          newTranscript.splice(wordIdx, 1, p1, p2);
          if (targetType === 'subtitle') {
            newlyCreatedId = p2.id;
            newlyCreatedType = 'subtitle';
          }
        }
      }
    }

    set({
      videoSegments: newSegments,
      transcript: newTranscript,
      selectedTimelineItemId: newlyCreatedId || get().selectedTimelineItemId,
      selectedTimelineItemType: newlyCreatedType
    });
  },

  deleteSelectedTimelineItem: () => {
    const { selectedTimelineItemId, selectedTimelineItemType, videoSegments, transcript, duration } = get();
    if (!selectedTimelineItemId) return;

    if (selectedTimelineItemType === 'video') {
      const segIdx = videoSegments.findIndex(s => s.id === selectedTimelineItemId);
      if (segIdx !== -1) {
        const delSeg = videoSegments[segIdx];
        const shiftAmount = delSeg.duration;
        const remainingSegments = videoSegments.filter((_, i) => i !== segIdx);

        // Magnetic ripple-snap: Shift subsequent segments leftward
        const rippleSegments = remainingSegments.map(s => {
          if (s.start >= delSeg.end - 0.05) {
            return {
              ...s,
              start: Math.max(0, Number((s.start - shiftAmount).toFixed(2))),
              end: Math.max(0.1, Number((s.end - shiftAmount).toFixed(2)))
            };
          }
          return s;
        });

        // Magnetic ripple-snap for Subtitles:
        // 1. Remove words falling completely within the deleted segment
        // 2. Shift subsequent words leftward
        const rippleTranscript = transcript
          .filter(w => !(w.start >= delSeg.start - 0.05 && w.end <= delSeg.end + 0.05))
          .map(w => {
            if (w.start >= delSeg.end - 0.05) {
              return {
                ...w,
                start: Math.max(0, Number((w.start - shiftAmount).toFixed(2))),
                end: Math.max(0.1, Number((w.end - shiftAmount).toFixed(2)))
              };
            }
            return w;
          });

        const newDur = Math.max(1, Number((duration - shiftAmount).toFixed(2)));
        set({
          videoSegments: rippleSegments,
          transcript: rippleTranscript,
          duration: newDur,
          selectedTimelineItemId: null,
          selectedTimelineItemType: null
        });
      }
    } else if (selectedTimelineItemType === 'subtitle') {
      set({
        transcript: transcript.filter(w => w.id !== selectedTimelineItemId),
        selectedTimelineItemId: null,
        selectedTimelineItemType: null
      });
    }
  },

  // Next-Level Viral Features: Emojis & Silence Cut
  showEmojis: true,
  setShowEmojis: (showEmojis) => set({ showEmojis }),
  silenceRegions: [],
  isDetectingSilence: false,
  removedSilenceDuration: 0,

  detectAndRemoveSilence: async () => {
    const { serverVideoPath, videoName, transcript, duration, videoSegments } = get();
    const targetPath = serverVideoPath || videoName;

    set({ isDetectingSilence: true });
    try {
      const res = await fetch(apiUrl('/api/silence/detect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_path: targetPath, noise_threshold_db: -30, min_duration: 0.5 })
      });
      if (res.ok) {
        const data = await res.json();
        const regions: Array<{ start: number; end: number; duration: number }> = data.silence_regions || [];
        if (regions.length > 0) {
          set({
            silenceBackup: {
              transcript: [...transcript],
              duration,
              videoSegments: [...videoSegments]
            }
          });

          // 1. Compute non-silent speech segments (ripple cuts)
          const speechChunks: Array<{ start: number; end: number }> = [];
          let currentPos = 0;
          for (const r of regions) {
            if (r.start > currentPos + 0.1) {
              speechChunks.push({ start: currentPos, end: r.start });
            }
            currentPos = r.end;
          }
          if (currentPos < duration - 0.1) {
            speechChunks.push({ start: currentPos, end: duration });
          }

          // 2. Build seamless ripple-joined video segments
          let timelineHead = 0;
          const newVideoSegments: VideoSegment[] = speechChunks.map((chunk, idx) => {
            const chunkDur = Number((chunk.end - chunk.start).toFixed(2));
            const seg: VideoSegment = {
              id: `speech-seg-${idx + 1}`,
              name: `Speech Segment ${idx + 1}`,
              start: Number(timelineHead.toFixed(2)),
              end: Number((timelineHead + chunkDur).toFixed(2)),
              sourceStart: chunk.start,
              sourceEnd: chunk.end,
              duration: chunkDur
            };
            timelineHead += chunkDur;
            return seg;
          });

          // 3. Shift word timestamps by subtracting preceding silence
          const shiftedWords = transcript
            .filter(w => !regions.some(r => w.start >= r.start && w.end <= r.end))
            .map(w => {
              let shiftAmount = 0;
              for (const r of regions) {
                if (r.end <= w.start) {
                  shiftAmount += r.duration;
                } else if (r.start < w.start && r.end > w.start) {
                  shiftAmount += (w.start - r.start);
                }
              }
              const newStart = Math.max(0, Number((w.start - shiftAmount).toFixed(2)));
              const newEnd = Math.max(newStart + 0.1, Number((w.end - shiftAmount).toFixed(2)));
              return {
                ...w,
                start: newStart,
                end: newEnd
              };
            });

          const totalCut = data.total_silence_duration || 0;
          set({
            transcript: shiftedWords,
            videoSegments: newVideoSegments.length > 0 ? newVideoSegments : videoSegments,
            silenceRegions: regions,
            removedSilenceDuration: totalCut,
            duration: Math.max(5, Number((duration - totalCut).toFixed(2))),
            isDetectingSilence: false
          });
        } else {
          set({ isDetectingSilence: false });
        }
      } else {
        set({ isDetectingSilence: false });
      }
    } catch (e) {
      console.warn("Silence detection error:", e);
      set({ isDetectingSilence: false });
    }
  },

  undoSilenceRemoval: () => {
    const backup = get().silenceBackup;
    if (backup) {
      set({
        transcript: backup.transcript,
        videoSegments: backup.videoSegments,
        silenceRegions: [],
        removedSilenceDuration: 0,
        duration: backup.duration,
        silenceBackup: null
      });
    }
  }
}));
