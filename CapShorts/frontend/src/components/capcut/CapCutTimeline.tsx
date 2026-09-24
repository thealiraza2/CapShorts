import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  MousePointer,
  Scissors,
  Trash2,
  Undo2,
  Redo2,
  Magnet,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Type,
  Video,
  Music,
  Plus,
  Edit2,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useVideoStore } from '../../store/useVideoStore';
import { WordToken, VideoSegment } from '../../types';
import { formatTimecode } from '../../utils/timeFormat';

/* ==========================================================================
   1. ISOLATED GPU-ACCELERATED TIMELINE PLAYHEAD (ZERO FORCED LAYOUT)
   ========================================================================== */
interface TimelinePlayheadProps {
  timelineZoom: number;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  containerWidth: number;
  onPlayheadMouseDown: (e: React.MouseEvent) => void;
}

const TimelinePlayhead: React.FC<TimelinePlayheadProps> = React.memo(({
  timelineZoom,
  scrollContainerRef,
  containerWidth,
  onPlayheadMouseDown,
}) => {
  const currentTime = useVideoStore((state) => state.currentTime);
  const isPlaying = useVideoStore((state) => state.isPlaying);
  const playheadX = currentTime * timelineZoom;
  const lastScrollTime = useRef(0);

  // Smooth auto-scroll to keep playhead in view during playback
  useEffect(() => {
    if (isPlaying && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollLeft = container.scrollLeft;

      if (playheadX > scrollLeft + containerWidth - 80) {
        container.scrollLeft = playheadX - containerWidth * 0.35;
      } else if (playheadX < scrollLeft) {
        container.scrollLeft = Math.max(0, playheadX - 60);
      }
    }
  }, [playheadX, isPlaying, containerWidth, scrollContainerRef]);

  return (
    <div
      style={{
        transform: `translate3d(${playheadX}px, 0, 0)`,
        willChange: 'transform',
      }}
      className="absolute top-0 bottom-0 left-0 w-[2px] bg-red-500 z-30 pointer-events-none shadow-[0_0_6px_rgba(239,68,68,0.7)]"
    >
      {/* Playhead Top Badge Handle (Click and drag to scrub) */}
      <div
        onMouseDown={onPlayheadMouseDown}
        className="absolute -top-1 -left-[7px] w-4 h-5 bg-red-500 hover:bg-red-400 active:scale-110 rounded-b-sm flex flex-col items-center justify-center pointer-events-auto cursor-ew-resize shadow-md shadow-red-500/40 transition-transform"
        title="Drag to scrub timeline"
      >
        <div className="w-1.5 h-1.5 bg-white rounded-full pointer-events-none mb-0.5" />
        <div className="w-0.5 h-1.5 bg-white/70 rounded-full pointer-events-none" />
      </div>

      {/* Red vertical stem handle: clicking anywhere on the line allows scrubbing */}
      <div
        onMouseDown={onPlayheadMouseDown}
        className="absolute top-4 bottom-0 -left-1.5 w-3.5 pointer-events-auto cursor-ew-resize hover:bg-red-500/20 transition-colors"
      />
    </div>
  );
});

/* ==========================================================================
   2. ISOLATED TIMECODE DISPLAY
   ========================================================================== */
const TimecodeDisplay: React.FC = React.memo(() => {
  const currentTime = useVideoStore((state) => state.currentTime);
  return (
    <div className="font-mono text-xs font-semibold text-zinc-200 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.08] shadow-inner tracking-wider">
      {formatTimecode(currentTime)}
    </div>
  );
});

/* ==========================================================================
   3. VIRTUALIZED RULER TRACK (ONLY RENDERS VISIBLE TICKS)
   ========================================================================== */
interface RulerTrackProps {
  effectiveDuration: number;
  timelineZoom: number;
  scrollLeft: number;
  containerWidth: number;
  onMouseDown: (e: React.MouseEvent) => void;
}

const RulerTrack: React.FC<RulerTrackProps> = React.memo(({
  effectiveDuration,
  timelineZoom,
  scrollLeft,
  containerWidth,
  onMouseDown,
}) => {
  const visibleStartSec = Math.max(0, Math.floor((scrollLeft - 100) / timelineZoom));
  const visibleEndSec = Math.min(effectiveDuration + 5, Math.ceil((scrollLeft + containerWidth + 100) / timelineZoom));

  const ticks = useMemo(() => {
    const list: { sec: number; isMajor: boolean }[] = [];
    const step = timelineZoom > 100 ? 1 : timelineZoom > 50 ? 2 : 5;
    for (let t = visibleStartSec; t <= visibleEndSec; t += step) {
      list.push({
        sec: t,
        isMajor: t % (step * 2) === 0 || t === 0,
      });
    }
    return list;
  }, [visibleStartSec, visibleEndSec, timelineZoom]);

  return (
    <div
      className="h-6 border-b border-white/[0.08] bg-zinc-950/60 relative cursor-pointer overflow-hidden backdrop-blur-sm"
      onMouseDown={onMouseDown}
    >
      {ticks.map((t) => (
        <div
          key={t.sec}
          style={{ left: `${t.sec * timelineZoom}px` }}
          className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
        >
          <div className={`w-[1px] ${t.isMajor ? 'h-3 bg-zinc-400' : 'h-1.5 bg-zinc-700'}`} />
          {t.isMajor && (
            <span className="text-[9px] font-mono text-zinc-400 pl-1 -translate-y-2 select-none font-medium">
              {Math.floor(t.sec)}s
            </span>
          )}
        </div>
      ))}
    </div>
  );
});

/* ==========================================================================
   4. VIRTUALIZED CAPTION BLOCK & TRACK (CLEAN PHRASES, ZERO DOM CLUTTER)
   ========================================================================== */
interface SubtitlePhraseBlock {
  id: string;
  words: WordToken[];
  start: number;
  end: number;
  text: string;
  hasKeyword: boolean;
}

interface SubtitleBlockProps {
  block: SubtitlePhraseBlock;
  isSelected: boolean;
  timelineZoom: number;
  onClick: (block: SubtitlePhraseBlock, e: React.MouseEvent) => void;
  onResizeStart: (blockId: string, edge: 'start' | 'end', e: React.MouseEvent) => void;
}

const SubtitleBlock: React.FC<SubtitleBlockProps> = React.memo(({
  block,
  isSelected,
  timelineZoom,
  onClick,
  onResizeStart,
}) => {
  const leftPx = block.start * timelineZoom;
  const widthPx = Math.max(10, (block.end - block.start) * timelineZoom);

  return (
    <div
      onClick={(e) => onClick(block, e)}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
      }}
      className={`absolute top-2 bottom-2 rounded-lg border flex items-center justify-between px-2 text-xs font-semibold select-none overflow-hidden cursor-pointer transition-all ${
        isSelected
          ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400/80 text-amber-200 shadow-lg shadow-amber-500/20 z-10'
          : block.hasKeyword
          ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/15 border-amber-500/40 text-amber-200 hover:border-amber-400 hover:bg-amber-500/25'
          : 'bg-zinc-800/80 border-white/[0.08] text-zinc-200 hover:border-white/20 hover:bg-zinc-800 shadow-xs'
      }`}
    >
      {isSelected && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(block.id, 'start', e);
          }}
          className="absolute left-0 top-0 bottom-0 w-2.5 bg-yellow-400 cursor-ew-resize hover:bg-white"
        />
      )}

      {widthPx >= 28 ? (
        <span className="truncate px-0.5 text-[11px] tracking-wide pointer-events-none font-semibold">
          {block.text}
        </span>
      ) : null}

      {isSelected && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(block.id, 'end', e);
          }}
          className="absolute right-0 top-0 bottom-0 w-2.5 bg-yellow-400 cursor-ew-resize hover:bg-white"
        />
      )}
    </div>
  );
});

interface VirtualizedSubtitleTrackProps {
  transcript: WordToken[];
  timelineZoom: number;
  scrollLeft: number;
  containerWidth: number;
  selectedTimelineItemId: string | null;
  selectedTimelineItemType: string | null;
  onBlockClick: (block: SubtitlePhraseBlock, e: React.MouseEvent) => void;
  onResizeStart: (blockId: string, edge: 'start' | 'end', e: React.MouseEvent) => void;
}

const VirtualizedSubtitleTrack: React.FC<VirtualizedSubtitleTrackProps> = React.memo(({
  transcript,
  timelineZoom,
  scrollLeft,
  containerWidth,
  selectedTimelineItemId,
  selectedTimelineItemType,
  onBlockClick,
  onResizeStart,
}) => {
  // Group words into clean phrase blocks (2 to 4 words per block like CapCut Desktop)
  const blocks = useMemo(() => {
    if (!transcript || transcript.length === 0) return [];
    const list: SubtitlePhraseBlock[] = [];
    const blockSize = 3;

    for (let i = 0; i < transcript.length; i += blockSize) {
      const slice = transcript.slice(i, i + blockSize);
      const start = slice[0].start;
      const end = slice[slice.length - 1].end;
      list.push({
        id: slice[0].id,
        words: slice,
        start,
        end: Math.max(end, start + 0.35),
        text: slice.map(w => w.word).join(' '),
        hasKeyword: slice.some(w => w.keyword)
      });
    }
    return list;
  }, [transcript]);

  // Virtualization window: only render blocks that intersect the visible scroll window
  const visibleStartPx = Math.max(0, scrollLeft - 150);
  const visibleEndPx = scrollLeft + containerWidth + 150;

  const visibleBlocks = useMemo(() => {
    return blocks.filter(b => {
      const bLeft = b.start * timelineZoom;
      const bRight = b.end * timelineZoom;
      return bRight >= visibleStartPx && bLeft <= visibleEndPx;
    });
  }, [blocks, timelineZoom, visibleStartPx, visibleEndPx]);

  return (
    <div className="h-16 border-b border-white/[0.06] relative flex items-center px-1 bg-zinc-950/30 overflow-hidden">
      {visibleBlocks.map((block) => {
        const isSelected = (selectedTimelineItemId === block.id || block.words.some(w => w.id === selectedTimelineItemId)) && selectedTimelineItemType === 'subtitle';
        return (
          <SubtitleBlock
            key={block.id}
            block={block}
            isSelected={isSelected}
            timelineZoom={timelineZoom}
            onClick={onBlockClick}
            onResizeStart={onResizeStart}
          />
        );
      })}
    </div>
  );
});

/* ==========================================================================
   5. MULTI-SEGMENT VIDEO FILMSTRIP TRACK (SPLIT & RIPPLE DELETE)
   ========================================================================== */
interface VideoTrackProps {
  segments: VideoSegment[];
  timelineZoom: number;
  selectedTimelineItemId: string | null;
  selectedTimelineItemType: string | null;
  isBladeActive: boolean;
  onSegmentClick: (segment: VideoSegment, e: React.MouseEvent) => void;
}

const VideoTrack: React.FC<VideoTrackProps> = React.memo(({
  segments,
  timelineZoom,
  selectedTimelineItemId,
  selectedTimelineItemType,
  isBladeActive,
  onSegmentClick,
}) => {
  if (!segments || segments.length === 0) return <div className="h-16 border-b border-white/[0.06] bg-zinc-950/50" />;

  return (
    <div className="h-16 border-b border-white/[0.06] relative flex items-center bg-zinc-950/50 overflow-hidden">
      {segments.map((seg) => {
        const isSelected = selectedTimelineItemId === seg.id && selectedTimelineItemType === 'video';
        const leftPx = seg.start * timelineZoom;
        const widthPx = Math.max(2, (seg.end - seg.start) * timelineZoom);

        return (
          <div
            key={seg.id}
            onClick={(e) => onSegmentClick(seg, e)}
            style={{
              left: `${leftPx}px`,
              width: `${widthPx}px`,
            }}
            className={`absolute top-2 bottom-2 rounded-lg border-y border-l overflow-hidden select-none flex items-center justify-between px-2 cursor-pointer transition-all ${
              isSelected
                ? 'bg-indigo-950/70 border-indigo-400 ring-2 ring-indigo-400/80 shadow-lg shadow-indigo-500/20 z-20 border-r border-r-indigo-400'
                : isBladeActive
                ? 'bg-zinc-900/90 border-indigo-500/40 hover:border-indigo-400 border-r-2 border-r-indigo-400/90'
                : 'bg-zinc-900/85 border-white/[0.08] hover:border-white/20 border-r-2 border-r-indigo-500/40'
            }`}
          >
            {widthPx >= 65 ? (
              <div className="flex items-center space-x-1.5 text-zinc-200 pointer-events-none truncate min-w-0">
                <Video className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="text-[11px] font-bold truncate">
                  {seg.name}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 flex-shrink-0 bg-black/40 px-1 py-0.5 rounded">
                  {seg.duration.toFixed(1)}s
                </span>
              </div>
            ) : widthPx >= 22 ? (
              <div className="flex items-center justify-center w-full pointer-events-none text-sky-400">
                <Video className="w-3 h-3" />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});

/* ==========================================================================
   6. HIGH-PERFORMANCE AUDIO WAVEFORM CANVAS (ZERO DOM ELEMENTS)
   ========================================================================== */
interface AudioWaveformCanvasProps {
  duration: number;
  timelineZoom: number;
}

const AudioWaveformCanvas: React.FC<AudioWaveformCanvasProps> = React.memo(({ duration, timelineZoom }) => {
  const width = Math.max(800, Math.round((duration || 10) * timelineZoom));

  return (
    <div className="h-14 relative flex items-center px-1 bg-zinc-950/40 overflow-hidden">
      <div
        style={{ width: `${width}px` }}
        className="h-full relative flex items-center bg-emerald-950/20 border border-emerald-500/20 rounded-lg overflow-hidden pointer-events-none"
      >
        <div
          className="w-full h-8 opacity-85"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, #34d399 0px, #34d399 2px, transparent 2px, transparent 6px), radial-gradient(ellipse at center, rgba(52, 211, 153, 0.45) 0%, transparent 80%)`,
            backgroundSize: '6px 75%, 100% 100%',
            backgroundRepeat: 'repeat-x, no-repeat',
            backgroundPosition: 'center, center',
          }}
        />
      </div>
    </div>
  );
});

/* ==========================================================================
   7. MAIN CAPCUT TIMELINE CONTAINER (ZERO LAG ARCHITECTURE)
   ========================================================================== */
export const CapCutTimeline: React.FC = () => {
  const {
    duration,
    isPlaying,
    setIsPlaying,
    transcript,
    updateWord,
    timelineZoom,
    setTimelineZoom,
    isBladeActive,
    setIsBladeActive,
    isSnapEnabled,
    setIsSnapEnabled,
    selectedTimelineItemId,
    selectedTimelineItemType,
    setSelectedTimelineItem,
    splitAtPlayhead,
    deleteSelectedTimelineItem,
    videoName,
    detectAndRemoveSilence,
    undoSilenceRemoval,
    isDetectingSilence,
    removedSilenceDuration,
    setCurrentTime,
    videoSegments,
    splitSegmentAtTime,
    isScrubbing,
    setIsScrubbing,
  } = useVideoStore(
    useShallow((state) => ({
      duration: state.duration,
      isPlaying: state.isPlaying,
      setIsPlaying: state.setIsPlaying,
      transcript: state.transcript,
      updateWord: state.updateWord,
      timelineZoom: state.timelineZoom,
      setTimelineZoom: state.setTimelineZoom,
      isBladeActive: state.isBladeActive,
      setIsBladeActive: state.setIsBladeActive,
      isSnapEnabled: state.isSnapEnabled,
      setIsSnapEnabled: state.setIsSnapEnabled,
      selectedTimelineItemId: state.selectedTimelineItemId,
      selectedTimelineItemType: state.selectedTimelineItemType,
      setSelectedTimelineItem: state.setSelectedTimelineItem,
      splitAtPlayhead: state.splitAtPlayhead,
      deleteSelectedTimelineItem: state.deleteSelectedTimelineItem,
      videoName: state.videoName,
      detectAndRemoveSilence: state.detectAndRemoveSilence,
      undoSilenceRemoval: state.undoSilenceRemoval,
      isDetectingSilence: state.isDetectingSilence,
      removedSilenceDuration: state.removedSilenceDuration,
      setCurrentTime: state.setCurrentTime,
      videoSegments: state.videoSegments,
      splitSegmentAtTime: state.splitSegmentAtTime,
      isScrubbing: state.isScrubbing,
      setIsScrubbing: state.setIsScrubbing,
    }))
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [resizingWordId, setResizingWordId] = useState<string | null>(null);
  const [resizeEdge, setResizeEdge] = useState<'start' | 'end' | null>(null);
  const [track1Locked, setTrack1Locked] = useState(false);
  const [track2Locked, setTrack2Locked] = useState(false);
  const [track3Locked, setTrack3Locked] = useState(false);

  // Viewport geometry state for virtualization (no forced clientWidth in loop)
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [bladeHoverX, setBladeHoverX] = useState<number | null>(null);
  const [bladeHoverTime, setBladeHoverTime] = useState<number | null>(null);

  const effectiveDuration = Math.max(duration || 10, transcript.length ? transcript[transcript.length - 1].end + 2 : 10);
  const timelineWidth = Math.max(800, effectiveDuration * timelineZoom);

  // Initialize and track container width on resize
  useEffect(() => {
    if (scrollContainerRef.current) {
      setContainerWidth(scrollContainerRef.current.clientWidth);
    }
    const handleResize = () => {
      if (scrollContainerRef.current) {
        setContainerWidth(scrollContainerRef.current.clientWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  // Throttled RAF scroll handler (Zero lag, drops duplicate frame scrolls)
  const handleContainerScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (scrollContainerRef.current) {
        setScrollLeft(scrollContainerRef.current.scrollLeft);
      }
    });
  }, []);

  const containerLeftRef = useRef(0);

  // Scrub time calculation
  const getTimeFromMouseEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!scrollContainerRef.current) return 0;
    const curLeft = containerLeftRef.current || scrollContainerRef.current.getBoundingClientRect().left;
    const curScroll = scrollContainerRef.current.scrollLeft;
    const clickX = e.clientX - curLeft + curScroll;
    const calculatedTime = Math.max(0, Math.min(effectiveDuration, clickX / timelineZoom));
    return Number(calculatedTime.toFixed(2));
  }, [effectiveDuration, timelineZoom]);

  // Unified Scrub Start Handler for Ruler and Playhead Handle
  const handleScrubStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPlaying(false);
    setIsScrubbing(true);
    if (scrollContainerRef.current) {
      containerLeftRef.current = scrollContainerRef.current.getBoundingClientRect().left;
    }
    const newTime = getTimeFromMouseEvent(e);
    setCurrentTime(newTime);
  }, [getTimeFromMouseEvent, setCurrentTime, setIsPlaying, setIsScrubbing]);

  // Window-level dragging effect with 60 FPS RAF throttling
  useEffect(() => {
    if (!isScrubbing && !resizingWordId) return;

    if (isScrubbing) {
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    let scrubRaf: number | null = null;
    let targetTime: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (isScrubbing) {
        const newTime = getTimeFromMouseEvent(e);
        targetTime = newTime;

        // Decouple mouse event spam from React renders via RAF (smooth 60fps)
        if (scrubRaf === null) {
          scrubRaf = requestAnimationFrame(() => {
            if (targetTime !== null) {
              setCurrentTime(targetTime);
            }
            scrubRaf = null;
          });
        }
      } else if (resizingWordId && resizeEdge) {
        const newTime = getTimeFromMouseEvent(e);
        const currentTranscript = useVideoStore.getState().transcript;
        const idx = currentTranscript.findIndex(w => w.id === resizingWordId);
        if (idx !== -1) {
          const w = currentTranscript[idx];
          if (resizeEdge === 'start') {
            const clampedStart = Math.max(0, Math.min(w.end - 0.1, newTime));
            updateWord(idx, { start: Number(clampedStart.toFixed(2)) });
          } else {
            const clampedEnd = Math.max(w.start + 0.1, newTime);
            updateWord(idx, { end: Number(clampedEnd.toFixed(2)) });
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (scrubRaf !== null) {
        cancelAnimationFrame(scrubRaf);
        scrubRaf = null;
      }
      if (isScrubbing && targetTime !== null) {
        setCurrentTime(targetTime);
      }
      setIsScrubbing(false);
      setResizingWordId(null);
      setResizeEdge(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (scrubRaf !== null) cancelAnimationFrame(scrubRaf);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isScrubbing, resizingWordId, resizeEdge, getTimeFromMouseEvent, updateWord, setCurrentTime, setIsScrubbing]);

  // Handle video segment click (Blade split or selection)
  const handleSegmentClick = useCallback((seg: VideoSegment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBladeActive) {
      const clickTime = getTimeFromMouseEvent(e);
      splitSegmentAtTime(clickTime, 'video');
      setCurrentTime(clickTime);
    } else {
      setSelectedTimelineItem(seg.id, 'video');
      setCurrentTime(seg.start);
    }
  }, [isBladeActive, getTimeFromMouseEvent, splitSegmentAtTime, setSelectedTimelineItem, setCurrentTime]);

  // Handle subtitle block click (Blade split or selection)
  const handleBlockClick = useCallback((block: SubtitlePhraseBlock, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBladeActive) {
      const clickTime = getTimeFromMouseEvent(e);
      splitSegmentAtTime(clickTime, 'subtitle');
      setCurrentTime(clickTime);
    } else {
      setSelectedTimelineItem(block.id, 'subtitle');
      setCurrentTime(block.start);
    }
  }, [isBladeActive, getTimeFromMouseEvent, splitSegmentAtTime, setSelectedTimelineItem, setCurrentTime]);

  const handleResizeStart = useCallback((blockId: string, edge: 'start' | 'end', e: React.MouseEvent) => {
    setResizingWordId(blockId);
    setResizeEdge(edge);
  }, []);

  return (
    <div
      className={`${
        isMinimized ? 'h-10' : 'h-[270px]'
      } flex flex-col bg-[#0b0b0e] border-t border-white/[0.08] select-none text-zinc-200 flex-shrink-0 transition-all duration-200 ease-in-out overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,0.5)]`}
    >
      {/* Top Timeline Toolbar */}
      <div
        onDoubleClick={() => setIsMinimized(!isMinimized)}
        className="h-11 border-b border-white/[0.08] px-3.5 flex items-center justify-between bg-zinc-950/75 backdrop-blur-xl"
        title="Double click to minimize/expand timeline"
      >
        {/* Left Toolbar Tools */}
        <div className="flex items-center space-x-2">
          {/* Tool Segment (V vs B) */}
          <div className="flex items-center bg-zinc-900/90 border border-white/[0.06] rounded-xl p-0.5 shadow-inner">
            {/* Select Tool (V) */}
            <button
              onClick={() => setIsBladeActive(false)}
              className={`p-1.5 rounded-lg transition-all ${
                !isBladeActive
                  ? 'bg-zinc-800 text-white shadow-xs ring-1 ring-white/10 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
              title="Selection Tool (V)"
            >
              <MousePointer className="w-3.5 h-3.5" />
            </button>

            {/* Razor Blade Tool (B) */}
            <button
              onClick={() => setIsBladeActive(!isBladeActive)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg transition-all text-xs font-semibold ${
                isBladeActive
                  ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-white/15 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
              title="Razor Blade Tool (B) - Click anywhere on timeline to cut"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Razor (B)</span>
            </button>
          </div>

          <div className="h-4 w-[1px] bg-white/[0.08]" />

          {/* Instant Split at Playhead Button (Ctrl+B / Cmd+B) */}
          <button
            onClick={splitAtPlayhead}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 text-xs font-medium border border-white/[0.08] transition-all group active:scale-95 shadow-xs"
            title="Split Clip & Caption at Playhead (Ctrl+B / ⌘B)"
          >
            <Scissors className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
            <span className="font-semibold">Split</span>
            <span className="text-[10px] text-zinc-400 font-mono">⌘B</span>
          </button>

          {/* Delete Tool (Del) */}
          <button
            onClick={deleteSelectedTimelineItem}
            disabled={!selectedTimelineItemId}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/[0.06] transition-colors disabled:opacity-40 disabled:hover:text-zinc-400"
            title="Delete Selected Clip (Del / Backspace)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-white/[0.08]" />

          {/* Magnet / Snap Toggle (N) */}
          <button
            onClick={() => setIsSnapEnabled(!isSnapEnabled)}
            className={`p-1.5 rounded-lg transition-all ${
              isSnapEnabled
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
            }`}
            title="Snapping (N)"
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-white/[0.08]" />

          {/* Smart Silence & Dead-Air Remover Button */}
          {removedSilenceDuration > 0 ? (
            <div className="flex items-center space-x-1.5 bg-emerald-950/40 border border-emerald-500/40 px-2.5 py-1 rounded-lg">
              <span className="text-[11px] font-bold text-emerald-300">
                ✂️ Cut {removedSilenceDuration}s Silence
              </span>
              <button
                onClick={undoSilenceRemoval}
                className="text-[10px] text-zinc-400 hover:text-white underline ml-1"
                title="Undo Silence Jump Cut"
              >
                Undo
              </button>
            </div>
          ) : (
            <button
              onClick={detectAndRemoveSilence}
              disabled={isDetectingSilence || transcript.length === 0}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500/15 via-indigo-500/10 to-transparent hover:from-indigo-500/25 border border-indigo-500/30 text-xs font-semibold text-indigo-300 transition-all active:scale-95 disabled:opacity-40"
              title="Automatically detect pauses & silence (>0.5s) and jump-cut dead air for maximum retention"
            >
              <Zap className={`w-3.5 h-3.5 text-indigo-400 ${isDetectingSilence ? 'animate-spin' : ''}`} />
              <span>{isDetectingSilence ? 'Analyzing Silence...' : 'Remove Dead Air'}</span>
            </button>
          )}

          <div className="h-4 w-[1px] bg-white/[0.08]" />

          {/* Isolated Timecode Reader */}
          <TimecodeDisplay />
        </div>

        {/* Right Zoom & View Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTimelineZoom(timelineZoom - 10)}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min="20"
            max="160"
            step="5"
            value={timelineZoom}
            onChange={(e) => setTimelineZoom(parseInt(e.target.value))}
            className="w-24 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />

          <button
            onClick={() => setTimelineZoom(timelineZoom + 10)}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setTimelineZoom(60)}
            className="px-2 py-0.5 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white text-xs font-mono border border-white/[0.06] transition-colors"
            title="Reset Zoom"
          >
            1x
          </button>

          <div className="h-4 w-[1px] bg-white/[0.08]" />

          {/* Minimize / Expand Timeline Button */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all text-xs font-medium ${
              isMinimized
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
            }`}
            title={isMinimized ? "Restore / Expand Timeline" : "Minimize Timeline (Maximize video canvas)"}
          >
            {isMinimized ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-bold text-indigo-300">Expand</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Minimize</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Tracks Workspace (Smooth 60 FPS Virtualized Canvas) */}
      {!isMinimized && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Track Headers Column */}
          <div className="w-28 border-r border-white/[0.08] bg-[#0d0d10] flex flex-col flex-shrink-0 z-20 select-none">
            {/* Ruler Corner Spacer */}
            <div className="h-6 border-b border-white/[0.08] bg-zinc-950/60 flex items-center justify-between px-2.5 text-[10px] text-zinc-400 font-mono">
              <span>TRACKS</span>
              <span className="text-[9px] text-zinc-600">3</span>
            </div>

            {/* Track 1: Subtitle / Captions Track Header */}
            <div className="h-16 border-b border-white/[0.06] px-2.5 flex items-center justify-between text-xs font-semibold bg-zinc-950/20">
              <div className="flex items-center space-x-1.5 text-indigo-400">
                <Type className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold text-zinc-200">Captions</span>
              </div>
              <button
                onClick={() => setTrack1Locked(!track1Locked)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-white/[0.04] transition-colors"
              >
                {track1Locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
              </button>
            </div>

            {/* Track 2: Video Track Header */}
            <div className="h-16 border-b border-white/[0.06] px-2.5 flex items-center justify-between text-xs font-semibold bg-zinc-950/30">
              <div className="flex items-center space-x-1.5 text-sky-400">
                <Video className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold text-zinc-200">Video 1</span>
              </div>
              <button
                onClick={() => setTrack2Locked(!track2Locked)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-white/[0.04] transition-colors"
              >
                {track2Locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
              </button>
            </div>

            {/* Track 3: Audio Track Header */}
            <div className="h-14 border-b border-white/[0.06] px-2.5 flex items-center justify-between text-xs font-semibold bg-zinc-950/20">
              <div className="flex items-center space-x-1.5 text-emerald-400">
                <Music className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold text-zinc-200">Audio 1</span>
              </div>
              <button
                onClick={() => setTrack3Locked(!track3Locked)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-white/[0.04] transition-colors"
              >
                {track3Locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Right Scrollable Timeline Canvas */}
          <div
            ref={scrollContainerRef}
            onScroll={handleContainerScroll}
            onMouseMove={(e) => {
              if (isBladeActive && scrollContainerRef.current) {
                const rect = scrollContainerRef.current.getBoundingClientRect();
                const curScroll = scrollContainerRef.current.scrollLeft;
                const clickX = e.clientX - rect.left + curScroll;
                const t = Math.max(0, Math.min(effectiveDuration, clickX / timelineZoom));
                setBladeHoverX(clickX);
                setBladeHoverTime(Number(t.toFixed(2)));
              }
            }}
            onMouseLeave={() => {
              if (bladeHoverX !== null) {
                setBladeHoverX(null);
                setBladeHoverTime(null);
              }
            }}
            className={`flex-1 overflow-x-auto overflow-y-hidden relative bg-[#09090c] ${
              isBladeActive ? 'cursor-crosshair' : 'cursor-default'
            }`}
            onClick={(e) => {
              if (isBladeActive) {
                const clickTime = getTimeFromMouseEvent(e);
                splitSegmentAtTime(clickTime, 'video');
                setCurrentTime(clickTime);
              } else {
                setSelectedTimelineItem(null, null);
              }
            }}
          >
            <div
              style={{ width: `${timelineWidth}px` }}
              className="h-full relative flex flex-col"
            >
              {/* Interactive Razor / Scissors Guide Line */}
              {isBladeActive && bladeHoverX !== null && (
                <div
                  style={{ left: `${bladeHoverX}px` }}
                  className="absolute top-0 bottom-0 w-[1.5px] bg-cyan-400 z-40 pointer-events-none shadow-[0_0_8px_rgba(34,211,238,0.9)]"
                >
                  <div className="absolute top-0 -left-6 bg-cyan-500 text-black px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center space-x-1 shadow-lg pointer-events-none">
                    <Scissors className="w-2.5 h-2.5" />
                    <span>{bladeHoverTime?.toFixed(2)}s</span>
                  </div>
                </div>
              )}
              {/* 1. Timecode Ruler Track (Virtualized, ~20 ticks in DOM) */}
              <RulerTrack
                effectiveDuration={effectiveDuration}
                timelineZoom={timelineZoom}
                scrollLeft={scrollLeft}
                containerWidth={containerWidth}
                onMouseDown={handleScrubStart}
              />

              {/* 2. Subtitle Phrase Track (CapCut Desktop Style, Virtualized ~8 blocks in DOM) */}
              <VirtualizedSubtitleTrack
                transcript={transcript}
                timelineZoom={timelineZoom}
                scrollLeft={scrollLeft}
                containerWidth={containerWidth}
                selectedTimelineItemId={selectedTimelineItemId}
                selectedTimelineItemType={selectedTimelineItemType}
                onBlockClick={handleBlockClick}
                onResizeStart={handleResizeStart}
              />

              {/* 3. Video Filmstrip Track (Multi-segment Split & Ripple Support) */}
              <VideoTrack
                segments={videoSegments}
                timelineZoom={timelineZoom}
                selectedTimelineItemId={selectedTimelineItemId}
                selectedTimelineItemType={selectedTimelineItemType}
                isBladeActive={isBladeActive}
                onSegmentClick={handleSegmentClick}
              />

              {/* 4. GPU HTML5 Audio Waveform Canvas (1 DOM node, zero overhead) */}
              <AudioWaveformCanvas
                duration={duration}
                timelineZoom={timelineZoom}
              />

              {/* 5. GPU Hardware-Accelerated Playhead (Drag Handle & Line) */}
              <TimelinePlayhead
                timelineZoom={timelineZoom}
                scrollContainerRef={scrollContainerRef}
                containerWidth={containerWidth}
                onPlayheadMouseDown={handleScrubStart}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
