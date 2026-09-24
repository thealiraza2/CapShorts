import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Layers,
  Flame,
  X,
  Maximize2,
  Shield,
  ShieldAlert,
  ZoomIn,
  Check,
  Upload
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useVideoStore } from '../../store/useVideoStore';
import { SubtitlePreset, WordToken } from '../../types';
import templatesData from '../../data/templates.json';
import { formatTime, formatTimecode, timelineToSourceTime, sourceToTimelineTime } from '../../utils/timeFormat';
import { formatCasing } from '../../utils/styleHelper';
import { getEmojiForWords } from '../../utils/emojiHelper';

export const CanvasPreview: React.FC = () => {
  const {
    videoUrl,
    setVideo,
    startTranscription,
    selectedModel,
    selectedLanguage,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    isPlaying,
    setIsPlaying,
    aspectRatio,
    transcript,
    activeTemplateId,
    customStyleOverrides,
    brollList,
    clips,
    selectedClipId,
    selectClip,
    safeAreaGuides,
    setSafeAreaGuides,
    previewZoom,
    setPreviewZoom,
    videoVolume,
    setVideoVolume,
    videoSpeed,
    videoScale,
    setVideoScale,
    videoPosition,
    setVideoPosition,
    videoFitMode,
    setVideoFitMode,
    showEmojis,
    videoSegments,
    isScrubbing,
  } = useVideoStore(
    useShallow((state) => ({
      videoUrl: state.videoUrl,
      setVideo: state.setVideo,
      startTranscription: state.startTranscription,
      selectedModel: state.selectedModel,
      selectedLanguage: state.selectedLanguage,
      currentTime: state.currentTime,
      setCurrentTime: state.setCurrentTime,
      duration: state.duration,
      setDuration: state.setDuration,
      isPlaying: state.isPlaying,
      setIsPlaying: state.setIsPlaying,
      aspectRatio: state.aspectRatio,
      transcript: state.transcript,
      activeTemplateId: state.activeTemplateId,
      customStyleOverrides: state.customStyleOverrides,
      brollList: state.brollList,
      clips: state.clips,
      selectedClipId: state.selectedClipId,
      selectClip: state.selectClip,
      safeAreaGuides: state.safeAreaGuides,
      setSafeAreaGuides: state.setSafeAreaGuides,
      previewZoom: state.previewZoom,
      setPreviewZoom: state.setPreviewZoom,
      videoVolume: state.videoVolume,
      setVideoVolume: state.setVideoVolume,
      videoSpeed: state.videoSpeed,
      videoScale: state.videoScale,
      setVideoScale: state.setVideoScale,
      videoPosition: state.videoPosition,
      setVideoPosition: state.setVideoPosition,
      videoFitMode: state.videoFitMode,
      setVideoFitMode: state.setVideoFitMode,
      showEmojis: state.showEmojis,
      videoSegments: state.videoSegments,
      isScrubbing: state.isScrubbing,
    }))
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Active AI Short (if selected)
  const activeClip = useMemo(() => {
    return clips.find(c => c.id === selectedClipId) || null;
  }, [clips, selectedClipId]);

  // Active Preset with live overrides
  const activePreset: SubtitlePreset = useMemo(() => {
    const rawList = templatesData as SubtitlePreset[];
    const found = rawList.find(t => t.id === activeTemplateId) || rawList[0];
    return { ...found, ...customStyleOverrides };
  }, [activeTemplateId, customStyleOverrides]);

  const isInternalUpdateRef = useRef(false);
  const isSeekingRef = useRef(false);
  const queuedSeekTimeRef = useRef<number | null>(null);
  const videoSegmentsRef = useRef(videoSegments);
  videoSegmentsRef.current = videoSegments;
  const activeClipRef = useRef(activeClip);
  activeClipRef.current = activeClip;

  // Non-blocking seek function with hardware decoder queue
  const performSeek = useCallback((targetTime: number, fast: boolean = true) => {
    if (!videoRef.current) return;

    if (isSeekingRef.current) {
      queuedSeekTimeRef.current = targetTime;
      return;
    }

    isSeekingRef.current = true;
    if (fast && 'fastSeek' in videoRef.current && typeof (videoRef.current as any).fastSeek === 'function') {
      try {
        (videoRef.current as any).fastSeek(targetTime);
      } catch {
        videoRef.current.currentTime = targetTime;
      }
    } else {
      videoRef.current.currentTime = targetTime;
    }
  }, []);

  const handleSeeked = useCallback(() => {
    isSeekingRef.current = false;
    if (queuedSeekTimeRef.current !== null) {
      const nextTime = queuedSeekTimeRef.current;
      queuedSeekTimeRef.current = null;
      performSeek(nextTime, isScrubbing);
    }
  }, [isScrubbing, performSeek]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(e => console.log('Autoplay prevent:', e));
      setIsPlaying(true);
    }
  };

  // Synchronize native video element playback whenever isPlaying store state changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      if (video.paused) {
        video.play().catch(e => console.warn('Play prevented:', e));
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
    }
  }, [isPlaying]);

  // High-Precision 60 FPS / 120 FPS Playback Loop (Smooth liquid playhead)
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;

    const tick = () => {
      if (videoRef.current && !videoRef.current.paused) {
        const curSourceTime = videoRef.current.currentTime;
        isInternalUpdateRef.current = true;

        const currentSegs = videoSegmentsRef.current;
        const currentClip = activeClipRef.current;

        // Handle jump-cuts across deleted gaps between segments
        if (currentSegs && currentSegs.length > 1) {
          for (let i = 0; i < currentSegs.length; i++) {
            const seg = currentSegs[i];
            if (curSourceTime >= seg.sourceEnd - 0.03 && i < currentSegs.length - 1) {
              const nextSeg = currentSegs[i + 1];
              if (nextSeg.sourceStart > seg.sourceEnd + 0.04) {
                videoRef.current.currentTime = nextSeg.sourceStart;
                setCurrentTime(nextSeg.start);
                animId = requestAnimationFrame(tick);
                return;
              }
            }
          }
        }

        if (currentClip && curSourceTime >= currentClip.end) {
          videoRef.current.currentTime = currentClip.start;
          setCurrentTime(sourceToTimelineTime(currentClip.start, currentSegs));
        } else {
          const calculatedTimelineTime = sourceToTimelineTime(curSourceTime, currentSegs);
          setCurrentTime(calculatedTimelineTime);
        }
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, setCurrentTime]);

  // Sync external currentTime changes (from scrubbing, clicking, or frame step)
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    if (!videoRef.current) return;

    const targetSourceTime = timelineToSourceTime(currentTime, videoSegments);
    if (Math.abs(videoRef.current.currentTime - targetSourceTime) < 0.03) return;

    performSeek(targetSourceTime, isScrubbing);
  }, [currentTime, videoSegments, isScrubbing, performSeek]);

  // When user stops scrubbing, do a final exact seek
  const prevScrubbingRef = useRef(isScrubbing);
  useEffect(() => {
    if (prevScrubbingRef.current && !isScrubbing && videoRef.current) {
      const targetSourceTime = timelineToSourceTime(currentTime, videoSegments);
      performSeek(targetSourceTime, false);
    }
    prevScrubbingRef.current = isScrubbing;
  }, [isScrubbing, currentTime, videoSegments, performSeek]);

  // Sync volume and speed changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : Math.min(1, Math.max(0, videoVolume));
      videoRef.current.playbackRate = videoSpeed || 1.0;
    }
  }, [videoVolume, isMuted, videoSpeed]);

  const handleTimeUpdate = () => {
    if (isScrubbing || isPlaying) return; // Handled by 60fps loop when playing
    if (videoRef.current) {
      const curSourceTime = videoRef.current.currentTime;
      isInternalUpdateRef.current = true;
      const calculatedTimelineTime = sourceToTimelineTime(curSourceTime, videoSegments);
      setCurrentTime(calculatedTimelineTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Group words into blocks according to activePreset.maxWordsPerBlock
  const wordBlocks = useMemo(() => {
    if (!transcript || transcript.length === 0) return [];
    const blocks: { words: WordToken[]; start: number; end: number }[] = [];
    const size = Math.max(1, activePreset.maxWordsPerBlock || 2);

    for (let i = 0; i < transcript.length; i += size) {
      const slice = transcript.slice(i, i + size);
      const start = slice[0].start;
      const end = slice[slice.length - 1].end;
      blocks.push({
        words: slice,
        start,
        end: Math.max(end, start + 0.3)
      });
    }
    return blocks;
  }, [transcript, activePreset.maxWordsPerBlock]);

  // Find currently active word block at currentTime
  const currentBlock = useMemo(() => {
    return wordBlocks.find(b => currentTime >= b.start && currentTime <= b.end + 0.1);
  }, [wordBlocks, currentTime]);

  // Find matching viral animated emoji for current active block (Submagic style)
  const activeEmoji = useMemo(() => {
    if (!showEmojis || !currentBlock) return null;
    return getEmojiForWords(currentBlock.words);
  }, [showEmojis, currentBlock]);

  // Find active B-roll clip at currentTime
  const activeBroll = useMemo(() => {
    return brollList.find(b => b.enabled && currentTime >= b.start && currentTime <= b.end);
  }, [brollList, currentTime]);

  // Subtitle positioning CSS
  const positionClass = useMemo(() => {
    const pos = activePreset.position || 'bottom-center';
    if (pos.includes('top')) return 'top-[16%]';
    if (pos.includes('middle')) return 'top-1/2 -translate-y-1/2';
    return 'bottom-[18%]';
  }, [activePreset.position]);

  // Proportional dimensions based on aspect ratio (locked aspect ratio, zero squashing)
  const viewportStyles = useMemo(() => {
    let ratio = '9 / 16';
    if (aspectRatio === '16:9') ratio = '16 / 9';
    else if (aspectRatio === '1:1') ratio = '1 / 1';

    let zoomPercent = 96;
    if (previewZoom === '50%') zoomPercent = 65;
    else if (previewZoom === '75%') zoomPercent = 82;
    else if (previewZoom === '100%') zoomPercent = 98;

    return {
      aspectRatio: ratio,
      maxHeight: `${zoomPercent}%`,
      maxWidth: `${zoomPercent}%`,
    };
  }, [aspectRatio, previewZoom]);

  const effectiveScale = (videoScale > 5 ? videoScale / 100 : videoScale) || 1.0;

  const stepFrame = (frames: number) => {
    const fps = 30;
    const delta = frames / fps;
    const newTime = Math.max(0, Math.min(duration, currentTime + delta));
    setCurrentTime(newTime);
    if (videoRef.current) {
      const sourceTime = timelineToSourceTime(newTime, videoSegments);
      videoRef.current.currentTime = sourceTime;
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col items-center justify-between bg-[#0e0e10] p-3 select-none overflow-hidden relative min-h-0"
    >
      {/* Top Preview Control Bar */}
      <div className="w-full flex items-center justify-between px-3.5 py-1.5 bg-zinc-900/80 backdrop-blur-xl rounded-xl border border-white/[0.08] text-xs z-20 flex-shrink-0 shadow-sm">
        <div className="flex items-center space-x-2">
          {/* Active Clip Tag (if applicable) */}
          {activeClip ? (
            <div className="flex items-center space-x-1.5 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-amber-300 font-semibold text-[11px] shadow-xs">
              <Flame className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="truncate max-w-[140px]">{activeClip.title}</span>
              <button
                onClick={() => selectClip(null)}
                className="hover:text-white p-0.5 ml-1 transition-colors"
                title="Exit Short Preview"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-zinc-300 font-semibold tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span>Canvas Monitor</span>
            </div>
          )}
        </div>

        {/* Center Aspect tag & Mode */}
        <div className="flex items-center space-x-2">
          <div className="text-[11px] font-mono text-zinc-300 bg-white/[0.05] border border-white/[0.08] px-2.5 py-0.5 rounded-md">
            {aspectRatio} {aspectRatio === '9:16' ? 'Vertical Short' : aspectRatio === '16:9' ? 'Landscape' : 'Square'}
          </div>

          {/* Quick Fit / Fill Mode Toggle (macOS Segmented) */}
          <div className="flex items-center bg-zinc-950/80 border border-white/[0.06] rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => {
                setVideoFitMode('contain');
                setVideoScale(1.0);
                setVideoPosition({ x: 0, y: 0 });
              }}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-all ${
                videoFitMode === 'contain' && effectiveScale <= 1.05
                  ? 'bg-zinc-800 text-white shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Fit Entire Video (Full picture visible)"
            >
              Fit
            </button>
            <button
              onClick={() => {
                setVideoFitMode('cover');
                setVideoScale(1.78);
                setVideoPosition({ x: 0, y: 0 });
              }}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-all ${
                videoFitMode === 'cover' || effectiveScale > 1.2
                  ? 'bg-zinc-800 text-white shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Fill Frame (Crop to vertical short)"
            >
              Fill
            </button>
          </div>
        </div>

        {/* Right Preview Controls: Safe Guides & Zoom */}
        <div className="flex items-center space-x-2">
          {/* TikTok Safe Area Guides Toggle */}
          <button
            onClick={() => setSafeAreaGuides(!safeAreaGuides)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              safeAreaGuides
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent hover:bg-white/[0.04]'
            }`}
            title="Toggle TikTok / Instagram Reels Safe Margin Guides"
          >
            <Shield className="w-3 h-3 text-indigo-400" />
            <span>Safe Guides</span>
          </button>

          {/* Zoom Selector */}
          <div className="flex items-center space-x-1 bg-zinc-950/80 border border-white/[0.06] rounded-lg px-2 py-0.5 text-[11px] text-zinc-300">
            <ZoomIn className="w-3 h-3 text-zinc-400" />
            <select
              value={previewZoom}
              onChange={(e) => setPreviewZoom(e.target.value as any)}
              className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer text-[11px]"
            >
              <option value="fit" className="bg-zinc-900">Fit</option>
              <option value="50%" className="bg-zinc-900">50%</option>
              <option value="75%" className="bg-zinc-900">75%</option>
              <option value="100%" className="bg-zinc-900">100%</option>
            </select>
          </div>
        </div>
      </div>

      {/* Center Stage Video Monitor */}
      <div className="flex-1 flex items-center justify-center w-full overflow-hidden p-2 min-h-0 relative">
        {videoUrl ? (
          <div
            style={{
              aspectRatio: viewportStyles.aspectRatio,
              maxHeight: viewportStyles.maxHeight,
              maxWidth: viewportStyles.maxWidth,
              height: '100%',
              width: 'auto',
            }}
            className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/[0.08] flex items-center justify-center transition-all duration-150 ring-1 ring-white/5"
          >
            {/* Studio Backdrop for 9:16 Shorts preview */}
            {aspectRatio === '9:16' && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none bg-gradient-to-b from-[#101014] via-[#09090b] to-[#101014]" />
            )}

            {/* Main Video Element with Centered Transform */}
            <video
              ref={videoRef}
              src={videoUrl}
              className={`w-full h-full relative z-10 transition-transform duration-75 ${
                videoFitMode === 'cover' ? 'object-cover' : 'object-contain'
              }`}
              style={{
                transform: `translate(${videoPosition.x}px, ${videoPosition.y}px) scale(${effectiveScale})`,
                transformOrigin: 'center center',
              }}
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onSeeked={handleSeeked}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onClick={togglePlay}
            />

            {/* Safe Area Guides Overlay (TikTok / Reels / Shorts margin boundaries) */}
            {safeAreaGuides && (
              <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-4">
                {/* Top Bar Safe line */}
                <div className="border-b border-dashed border-indigo-400/40 pb-1 text-[9px] text-indigo-400 font-mono">
                  Top Safe Margin
                </div>

                {/* Right Sidebar Icons boundary */}
                <div className="absolute right-2 top-1/4 bottom-1/4 w-10 border-l border-dashed border-indigo-400/40 flex flex-col items-center justify-center text-[8px] text-indigo-400 font-mono text-center">
                  TikTok Icons
                </div>

                {/* Bottom Username & Captions Safe line */}
                <div className="border-t border-dashed border-indigo-400/40 pt-1 text-[9px] text-indigo-400 font-mono flex justify-between">
                  <span>Captions Safe Zone</span>
                  <span>Bottom Safe Margin</span>
                </div>
              </div>
            )}

            {/* Live B-Roll Overlay (if active at currentTime) */}
            {activeBroll && (
              <div key={activeBroll.id} className="absolute inset-0 z-20 animate-fade pointer-events-none">
                {activeBroll.video_url ? (
                  <video
                    key={activeBroll.id}
                    src={activeBroll.video_url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : activeBroll.preview_url ? (
                  <img
                    key={activeBroll.id}
                    src={activeBroll.preview_url}
                    alt={activeBroll.title || 'B-Roll Preview'}
                    className="w-full h-full object-cover"
                  />
                ) : null}
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-amber-400 font-bold uppercase tracking-wider border border-amber-500/30">
                  B-Roll: {activeBroll.keyword}
                </div>
              </div>
            )}

            {/* Subtitle Overlay */}
            {currentBlock && (
              <div className={`absolute inset-x-0 ${positionClass} z-20 flex flex-col items-center justify-center px-4 pointer-events-none`}>
                {/* Submagic Style Floating 3D Animated Emoji */}
                {activeEmoji && (
                  <div
                    key={`${currentBlock.start}-${activeEmoji}`}
                    className="mb-2 animate-emoji-pop select-none pointer-events-none z-30"
                  >
                    <span className="text-4xl sm:text-5xl filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.85)] inline-block transform">
                      {activeEmoji}
                    </span>
                  </div>
                )}

                <div
                  className={`flex flex-wrap items-center justify-center gap-1.5 transition-all duration-100 ${
                    activePreset.bgBox ? 'px-3 py-1.5 rounded-lg' : ''
                  }`}
                  style={{
                    backgroundColor: activePreset.bgBox ? activePreset.bgBoxColor : 'transparent',
                  }}
                >
                  {currentBlock.words.map((wordObj) => {
                    const isWordSpeaking = currentTime >= wordObj.start && currentTime <= wordObj.end + 0.05;
                    const isHighlighted = isWordSpeaking || wordObj.keyword;
                    const textColor = isHighlighted ? activePreset.highlightColor : activePreset.primaryColor;
                    const casedWord = formatCasing(wordObj.word, activePreset.textCasing);

                    const outlineStyle = activePreset.outlineWidth > 0
                      ? `${activePreset.outlineWidth}px ${activePreset.outlineColor}`
                      : 'none';

                    const shadowStyle = activePreset.shadowDepth > 0
                      ? `0px ${activePreset.shadowDepth}px ${activePreset.shadowDepth * 2}px ${activePreset.shadowColor}`
                      : 'none';

                    let animationClass = '';
                    if (isWordSpeaking) {
                      if (activePreset.animationTrigger === 'pop') animationClass = 'animate-pop';
                      else if (activePreset.animationTrigger === 'bounce') animationClass = 'animate-bounce';
                      else if (activePreset.animationTrigger === 'fade') animationClass = 'animate-fade';
                    }

                    return (
                      <span
                        key={wordObj.id}
                        className={`inline-block font-black tracking-tight leading-none transition-transform ${animationClass}`}
                        style={{
                          fontFamily: `${activePreset.fontFamily}, 'Montserrat', 'Noto Nastaliq Urdu', 'Segoe UI', sans-serif`,
                          fontSize: `${Math.round(activePreset.fontSize * (aspectRatio === '9:16' ? 0.72 : 0.85))}px`,
                          fontWeight: activePreset.fontWeight,
                          color: textColor,
                          WebkitTextStroke: outlineStyle !== 'none' ? outlineStyle : undefined,
                          paintOrder: 'stroke fill',
                          textShadow: shadowStyle !== 'none' ? shadowStyle : undefined,
                        }}
                      >
                        {casedWord}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Expansive macOS Studio Import Hero Dropzone */
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file && (file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm|mkv|avi)$/i))) {
                const url = URL.createObjectURL(file);
                setVideo(file, url, file.name);
                startTranscription(file, selectedModel, selectedLanguage);
              }
            }}
            className="w-full max-w-xl p-8 rounded-3xl bg-zinc-900/60 backdrop-blur-2xl border border-white/[0.08] shadow-2xl flex flex-col items-center text-center relative overflow-hidden group hover:border-indigo-500/40 transition-all duration-300 ring-1 ring-white/[0.05]"
          >
            {/* Ambient Background Radial Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Floating Icon Badge */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-sky-500/10 to-transparent border border-white/[0.12] flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/15 mb-4 group-hover:scale-105 transition-transform duration-300 ring-1 ring-white/10">
              <Upload className="w-7 h-7 text-indigo-300 stroke-[2.2]" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1.5 font-['Plus_Jakarta_Sans',sans-serif] tracking-tight">
              Drop Video to Start Editing
            </h3>
            <p className="text-xs text-zinc-400 max-w-md leading-relaxed mb-5">
              CapShorts transcribes speech in ~3s, highlights viral hooks, removes dead air, and crafts 9:16 vertical shorts automatically.
            </p>

            <label className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white font-semibold text-xs cursor-pointer shadow-lg shadow-indigo-500/25 border border-indigo-400/30 transition-all active:scale-95 mb-4 tracking-wide">
              <Upload className="w-4 h-4 text-white" />
              <span>Import Video File</span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setVideo(file, url, file.name);
                    startTranscription(file, selectedModel, selectedLanguage);
                  }
                }}
              />
            </label>

            {/* Supported Formats Pills */}
            <div className="flex items-center space-x-2 text-[10px] text-zinc-500">
              <span>Supports:</span>
              <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-zinc-400 font-mono">MP4</span>
              <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-zinc-400 font-mono">MOV / ProRes</span>
              <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-zinc-400 font-mono">WebM</span>
              <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-zinc-400 font-mono">MKV</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Transport Controls Bar */}
      <div className="w-full flex items-center justify-between px-4 py-2 bg-zinc-900/80 backdrop-blur-xl border border-white/[0.08] rounded-xl text-zinc-300 z-20 flex-shrink-0 shadow-lg">
        {/* Left: Timecode Readout */}
        <div className="flex items-center space-x-1.5 font-mono text-xs text-zinc-300">
          <span className="text-white font-bold bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.08] tracking-wider">
            {formatTimecode(currentTime)}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">{formatTimecode(duration)}</span>
        </div>

        {/* Center: Frame-by-Frame & Play Transport Controls */}
        <div className="flex items-center space-x-3">
          {/* Step Back 1 frame */}
          <button
            onClick={() => stepFrame(-1)}
            className="p-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Step Back 1 Frame (-1/30s)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Main Play / Pause Button (Apple Studio White Pill) */}
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shadow-lg shadow-white/15 transition-all active:scale-95 ring-2 ring-white/20"
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-black stroke-[2.2]" />
            ) : (
              <Play className="w-4 h-4 fill-black ml-0.5 stroke-[2.2]" />
            )}
          </button>

          {/* Step Forward 1 frame */}
          <button
            onClick={() => stepFrame(1)}
            className="p-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Step Forward 1 Frame (+1/30s)"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Volume & Fullscreen */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 hover:bg-white/[0.08] rounded-md hover:text-white text-zinc-400 transition-colors"
              title="Mute / Unmute"
            >
              {isMuted || videoVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : videoVolume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVideoVolume(val);
                setIsMuted(val === 0);
              }}
              className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-400"
            />
          </div>

          <button
            onClick={() => {
              if (containerRef.current) {
                if (!document.fullscreenElement) {
                  containerRef.current.requestFullscreen().catch(err => console.log(err));
                } else {
                  document.exitFullscreen();
                }
              }
            }}
            className="p-1.5 hover:bg-white/[0.08] rounded-md hover:text-white text-zinc-400 transition-colors"
            title="Fullscreen Preview"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
