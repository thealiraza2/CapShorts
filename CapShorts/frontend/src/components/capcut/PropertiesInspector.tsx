import React, { useMemo } from 'react';
import {
  Type,
  Video,
  Volume2,
  Sparkles,
  Flame,
  RotateCcw,
  Palette,
  Trash2,
  Edit2,
  ZoomIn,
  Move,
  Maximize2
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useVideoStore } from '../../store/useVideoStore';
import { SubtitlePreset } from '../../types';
import templatesData from '../../data/templates.json';

const FONTS = [
  'The Bold Font',
  'Montserrat',
  'Impact',
  'Komika Axis',
  'Poppins',
  'Inter',
  'Noto Nastaliq Urdu',
  'Arial'
];

export const PropertiesInspector: React.FC = () => {
  const {
    activeInspectorTab,
    setActiveInspectorTab,
    selectedTimelineItemId,
    selectedTimelineItemType,
    transcript,
    updateWord,
    deleteWord,
    toggleKeyword,
    activeTemplateId,
    customStyleOverrides,
    updateCustomStyle,
    resetCustomStyle,
    videoScale,
    setVideoScale,
    videoPosition,
    setVideoPosition,
    videoFitMode,
    setVideoFitMode,
    videoVolume,
    setVideoVolume,
    clips,
    selectedClipId,
    setIsExportModalOpen,
    showEmojis,
    setShowEmojis
  } = useVideoStore(
    useShallow((state) => ({
      activeInspectorTab: state.activeInspectorTab,
      setActiveInspectorTab: state.setActiveInspectorTab,
      selectedTimelineItemId: state.selectedTimelineItemId,
      selectedTimelineItemType: state.selectedTimelineItemType,
      transcript: state.transcript,
      updateWord: state.updateWord,
      deleteWord: state.deleteWord,
      toggleKeyword: state.toggleKeyword,
      activeTemplateId: state.activeTemplateId,
      customStyleOverrides: state.customStyleOverrides,
      updateCustomStyle: state.updateCustomStyle,
      resetCustomStyle: state.resetCustomStyle,
      videoScale: state.videoScale,
      setVideoScale: state.setVideoScale,
      videoPosition: state.videoPosition,
      setVideoPosition: state.setVideoPosition,
      videoFitMode: state.videoFitMode,
      setVideoFitMode: state.setVideoFitMode,
      videoVolume: state.videoVolume,
      setVideoVolume: state.setVideoVolume,
      clips: state.clips,
      selectedClipId: state.selectedClipId,
      setIsExportModalOpen: state.setIsExportModalOpen,
      showEmojis: state.showEmojis,
      setShowEmojis: state.setShowEmojis,
    }))
  );

  // Active Preset with live overrides
  const activePreset: SubtitlePreset = useMemo(() => {
    const rawList = templatesData as SubtitlePreset[];
    const found = rawList.find(t => t.id === activeTemplateId) || rawList[0];
    return { ...found, ...customStyleOverrides };
  }, [activeTemplateId, customStyleOverrides]);

  // Selected Word (if a subtitle word is currently selected)
  const selectedWordIndex = useMemo(() => {
    if (selectedTimelineItemType !== 'subtitle' || !selectedTimelineItemId) return -1;
    return transcript.findIndex(w => w.id === selectedTimelineItemId);
  }, [transcript, selectedTimelineItemId, selectedTimelineItemType]);

  const selectedWord = selectedWordIndex !== -1 ? transcript[selectedWordIndex] : null;

  // Selected Clip (if viral clip is active)
  const activeClip = useMemo(() => {
    return clips.find(c => c.id === selectedClipId) || null;
  }, [clips, selectedClipId]);

  return (
    <div className="w-[320px] lg:w-[350px] h-full flex flex-col bg-[#0e0e11]/95 backdrop-blur-2xl border-l border-white/[0.08] select-none flex-shrink-0 text-zinc-200">
      {/* Top macOS Segmented Inspector Tab Strip */}
      <div className="h-13 border-b border-white/[0.08] px-3 flex items-center justify-between bg-zinc-950/40 backdrop-blur-md">
        <div className="grid grid-cols-4 gap-1 w-full bg-zinc-900/80 p-1 rounded-xl border border-white/[0.06] shadow-inner">
          <button
            onClick={() => setActiveInspectorTab('text')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeInspectorTab === 'text'
                ? 'bg-zinc-800 text-white shadow-xs ring-1 ring-white/10 font-bold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <Type className="w-3.5 h-3.5 text-indigo-400" />
            <span>Text</span>
          </button>

          <button
            onClick={() => setActiveInspectorTab('video')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeInspectorTab === 'video'
                ? 'bg-zinc-800 text-white shadow-xs ring-1 ring-white/10 font-bold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-sky-400" />
            <span>Video</span>
          </button>

          <button
            onClick={() => setActiveInspectorTab('audio')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeInspectorTab === 'audio'
                ? 'bg-zinc-800 text-white shadow-xs ring-1 ring-white/10 font-bold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Audio</span>
          </button>

          <button
            onClick={() => setActiveInspectorTab('viral')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeInspectorTab === 'viral'
                ? 'bg-zinc-800 text-white shadow-xs ring-1 ring-white/10 font-bold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Hook</span>
          </button>
        </div>
      </div>

      {/* Panel Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* ======================= TEXT INSPECTOR ======================= */}
        {activeInspectorTab === 'text' && (
          <div className="space-y-4 animate-fade">
            {/* Selected Word Context Bar */}
            {selectedWord ? (
              <div className="bg-gradient-to-br from-indigo-500/10 via-white/[0.02] to-transparent border border-indigo-500/30 rounded-2xl p-3.5 space-y-3 shadow-lg shadow-indigo-500/5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-300 flex items-center space-x-1.5">
                    <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Selected Caption Word</span>
                  </span>
                  <button
                    onClick={() => toggleKeyword(selectedWordIndex)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-all ${
                      selectedWord.keyword
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                        : 'bg-white/[0.06] text-zinc-400 hover:text-zinc-200 border border-white/[0.06]'
                    }`}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>{selectedWord.keyword ? 'Viral Keyword: ON' : 'Make Keyword'}</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <input
                    type="text"
                    value={selectedWord.word}
                    onChange={(e) => updateWord(selectedWordIndex, { word: e.target.value })}
                    className="w-full bg-black/50 border border-indigo-400/40 focus:border-indigo-400 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-400/50 transition-all font-sans"
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1.5 border-t border-white/[0.06]">
                  <span className="font-mono text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                    {selectedWord.start.toFixed(2)}s - {selectedWord.end.toFixed(2)}s
                  </span>
                  <button
                    onClick={() => deleteWord(selectedWordIndex)}
                    className="text-red-400 hover:text-red-300 flex items-center space-x-1 transition-colors px-2 py-0.5 rounded hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete Word</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3 text-center text-xs text-zinc-400 leading-relaxed">
                <span>Select any word block in the timeline to edit text, timing, or toggle keyword highlights.</span>
              </div>
            )}

            {/* Typography Section */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3.5 shadow-sm backdrop-blur-md">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                  <Type className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Typography</span>
                </h4>
                <button
                  onClick={resetCustomStyle}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
                  title="Reset to Template Defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>

              {/* Font Family */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Font Family</label>
                <select
                  value={activePreset.fontFamily}
                  onChange={(e) => updateCustomStyle({ fontFamily: e.target.value })}
                  className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400/80 focus:ring-1 focus:ring-indigo-400/30 transition-all cursor-pointer"
                >
                  {FONTS.map(f => (
                    <option key={f} value={f} className="bg-zinc-900 text-white">{f}</option>
                  ))}
                </select>
              </div>

              {/* Font Size */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Font Size</span>
                  <span className="font-mono text-indigo-400 font-bold">{activePreset.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="24"
                  max="96"
                  step="2"
                  value={activePreset.fontSize}
                  onChange={(e) => updateCustomStyle({ fontSize: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                />
              </div>

              {/* Text Casing */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Text Casing</label>
                <div className="grid grid-cols-4 gap-1 bg-black/40 p-0.5 rounded-xl border border-white/[0.06]">
                  {(['UPPERCASE', 'lowercase', 'Title Case', 'Default'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => updateCustomStyle({ textCasing: c })}
                      className={`py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        activePreset.textCasing === c
                          ? 'bg-white text-black font-bold shadow-xs'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {c === 'UPPERCASE' ? 'UPPER' : c === 'lowercase' ? 'lower' : c === 'Title Case' ? 'Title' : 'Default'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Colors & Stroke */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3.5 shadow-sm backdrop-blur-md">
              <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                <Palette className="w-3.5 h-3.5 text-sky-400" />
                <span>Colors & Stroke</span>
              </h4>

              {/* Primary & Highlight Color */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Primary Fill</label>
                  <div className="flex items-center space-x-2 bg-black/50 border border-white/[0.08] rounded-xl p-1.5">
                    <input
                      type="color"
                      value={activePreset.primaryColor}
                      onChange={(e) => updateCustomStyle({ primaryColor: e.target.value })}
                      className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-[11px] font-mono text-zinc-300 font-semibold">{activePreset.primaryColor}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Highlight Color</label>
                  <div className="flex items-center space-x-2 bg-black/50 border border-white/[0.08] rounded-xl p-1.5">
                    <input
                      type="color"
                      value={activePreset.highlightColor}
                      onChange={(e) => updateCustomStyle({ highlightColor: e.target.value })}
                      className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-[11px] font-mono text-zinc-300 font-semibold">{activePreset.highlightColor}</span>
                  </div>
                </div>
              </div>

              {/* Stroke Outline */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Outline Width</span>
                  <span className="font-mono text-sky-400 font-bold">{activePreset.outlineWidth}px</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={activePreset.outlineWidth}
                    onChange={(e) => updateCustomStyle({ outlineWidth: parseFloat(e.target.value) })}
                    className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                  <input
                    type="color"
                    value={activePreset.outlineColor}
                    onChange={(e) => updateCustomStyle({ outlineColor: e.target.value })}
                    className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent flex-shrink-0"
                    title="Outline Color"
                  />
                </div>
              </div>

              {/* Shadow Depth */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Shadow Depth</span>
                  <span className="font-mono text-sky-400 font-bold">{activePreset.shadowDepth}px</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={activePreset.shadowDepth}
                    onChange={(e) => updateCustomStyle({ shadowDepth: parseInt(e.target.value) })}
                    className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                  <input
                    type="color"
                    value={activePreset.shadowColor}
                    onChange={(e) => updateCustomStyle({ shadowColor: e.target.value })}
                    className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent flex-shrink-0"
                    title="Shadow Color"
                  />
                </div>
              </div>
            </div>

            {/* Animation & Layout */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3.5 shadow-sm backdrop-blur-md">
              <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Animation & Layout</span>
              </h4>

              {/* Animation Trigger */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Word Animation</label>
                <div className="grid grid-cols-4 gap-1 bg-black/40 p-0.5 rounded-xl border border-white/[0.06]">
                  {(['pop', 'bounce', 'fade', 'none'] as const).map(anim => (
                    <button
                      key={anim}
                      onClick={() => updateCustomStyle({ animationTrigger: anim })}
                      className={`py-1.5 rounded-lg text-[10px] font-semibold capitalize transition-all ${
                        activePreset.animationTrigger === anim
                          ? 'bg-indigo-600 text-white font-bold shadow-xs'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {anim}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submagic Style AI Animated Emojis */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
                <div>
                  <div className="text-[11px] font-bold text-zinc-200 flex items-center space-x-1.5">
                    <span>✨ AI Animated Emojis</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-semibold">Submagic</span>
                  </div>
                  <p className="text-[9px] text-zinc-400 mt-0.5">Pop 3D emojis automatically on viral keywords</p>
                </div>
                <button
                  onClick={() => setShowEmojis(!showEmojis)}
                  className={`w-10 h-6 rounded-full transition-colors relative p-0.5 flex-shrink-0 ${
                    showEmojis ? 'bg-indigo-500' : 'bg-zinc-800'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform shadow-md ${
                      showEmojis ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Words Per Block */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Words Per Screen</span>
                  <span className="font-mono text-indigo-400 font-bold">{activePreset.maxWordsPerBlock} words</span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-black/40 p-0.5 rounded-xl border border-white/[0.06]">
                  {[1, 2, 3, 4].map(w => (
                    <button
                      key={w}
                      onClick={() => updateCustomStyle({ maxWordsPerBlock: w })}
                      className={`py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        activePreset.maxWordsPerBlock === w
                          ? 'bg-indigo-600 text-white font-bold shadow-xs'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {w === 1 ? '1 (Karaoke)' : `${w} words`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Position */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Screen Position</label>
                <div className="grid grid-cols-3 gap-1 bg-black/40 p-0.5 rounded-xl border border-white/[0.06]">
                  {(['top', 'middle', 'bottom'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => updateCustomStyle({ position: `${pos}-center` as SubtitlePreset['position'] })}
                      className={`py-1.5 rounded-lg text-[10px] font-semibold capitalize transition-all ${
                        activePreset.position.includes(pos)
                          ? 'bg-indigo-600 text-white font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= VIDEO INSPECTOR ======================= */}
        {activeInspectorTab === 'video' && (
          <div className="space-y-4 animate-fade">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-4 shadow-sm backdrop-blur-md">
              <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                <Video className="w-3.5 h-3.5 text-sky-400" />
                <span>Video Framing & Transform</span>
              </h4>

              {/* Quick Framing Presets */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Framing Presets</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setVideoFitMode('contain');
                      setVideoScale(1.0);
                      setVideoPosition({ x: 0, y: 0 });
                    }}
                    className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                      videoFitMode === 'contain' && videoScale <= 1.05
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold shadow-xs'
                        : 'bg-black/40 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    📺 Fit Full Video
                  </button>

                  <button
                    onClick={() => {
                      setVideoFitMode('cover');
                      setVideoScale(1.78);
                      setVideoPosition({ x: 0, y: 0 });
                    }}
                    className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                      videoFitMode === 'cover' && videoScale > 1.2 && videoPosition.x === 0
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold shadow-xs'
                        : 'bg-black/40 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    📱 Fill 9:16 Center
                  </button>

                  <button
                    onClick={() => {
                      setVideoFitMode('cover');
                      setVideoScale(1.78);
                      setVideoPosition({ x: 120, y: 0 });
                    }}
                    className="px-3 py-2 rounded-xl border bg-black/40 border-white/[0.08] text-xs font-medium text-zinc-300 hover:border-sky-500/50 hover:text-white transition-all"
                  >
                    👤 Left Speaker
                  </button>

                  <button
                    onClick={() => {
                      setVideoFitMode('cover');
                      setVideoScale(1.78);
                      setVideoPosition({ x: -120, y: 0 });
                    }}
                    className="px-3 py-2 rounded-xl border bg-black/40 border-white/[0.08] text-xs font-medium text-zinc-300 hover:border-sky-500/50 hover:text-white transition-all"
                  >
                    👤 Right Speaker
                  </button>
                </div>
              </div>

              {/* Scale / Zoom Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span className="flex items-center space-x-1">
                    <ZoomIn className="w-3 h-3 text-sky-400" />
                    <span>Scale / Zoom</span>
                  </span>
                  <span className="font-mono text-sky-400 font-bold">
                    {Math.round((videoScale > 5 ? videoScale / 100 : videoScale) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.05"
                  value={videoScale > 5 ? videoScale / 100 : videoScale}
                  onChange={(e) => setVideoScale(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
              </div>

              {/* Position X */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span className="flex items-center space-x-1">
                    <Move className="w-3 h-3 text-sky-400" />
                    <span>Pan X (Horizontal)</span>
                  </span>
                  <span className="font-mono text-sky-400 font-bold">{videoPosition.x}px</span>
                </div>
                <input
                  type="range"
                  min="-300"
                  max="300"
                  step="5"
                  value={videoPosition.x}
                  onChange={(e) => setVideoPosition({ ...videoPosition, x: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
              </div>

              {/* Position Y */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span className="flex items-center space-x-1">
                    <Move className="w-3 h-3 text-sky-400" />
                    <span>Pan Y (Vertical)</span>
                  </span>
                  <span className="font-mono text-sky-400 font-bold">{videoPosition.y}px</span>
                </div>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  step="5"
                  value={videoPosition.y}
                  onChange={(e) => setVideoPosition({ ...videoPosition, y: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
              </div>

              {/* Reset button */}
              <button
                onClick={() => {
                  setVideoFitMode('contain');
                  setVideoScale(1.0);
                  setVideoPosition({ x: 0, y: 0 });
                }}
                className="w-full py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-zinc-300 font-semibold transition-all active:scale-95 shadow-xs"
              >
                Reset Transform to Fit
              </button>
            </div>
          </div>
        )}

        {/* ======================= AUDIO INSPECTOR ======================= */}
        {activeInspectorTab === 'audio' && (
          <div className="space-y-4 animate-fade">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-4 shadow-sm backdrop-blur-md">
              <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Audio Levels & Gain</span>
              </h4>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                  <span>Master Volume</span>
                  <span className="font-mono text-emerald-400 font-bold">{Math.round(videoVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={videoVolume}
                  onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* ======================= AI HOOK INSPECTOR ======================= */}
        {activeInspectorTab === 'viral' && (
          <div className="space-y-4 animate-fade">
            {activeClip ? (
              <div className="bg-gradient-to-br from-amber-500/10 via-white/[0.03] to-transparent border border-amber-500/30 rounded-2xl p-4 space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                    <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>Virality Analysis</span>
                  </h4>
                  <div className="text-xs font-black text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                    {activeClip.virality_score}/100
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Hook Sentence</label>
                  <p className="text-xs text-zinc-200 italic bg-black/40 p-3 rounded-xl border border-white/[0.06] leading-relaxed">
                    "{activeClip.hook}"
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Detected Viral Keywords</label>
                  <div className="flex flex-wrap gap-1.5">
                    {activeClip.keywords?.map(k => (
                      <span key={k} className="px-2.5 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-[10px] text-indigo-300 font-mono font-semibold">
                        #{k}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 border border-indigo-400/30 active:scale-95 transition-all"
                >
                  Export This Viral Short
                </button>
              </div>
            ) : (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 text-center space-y-2">
                <Flame className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Select any AI Short in the Left Library to inspect its virality score and hook structure.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
