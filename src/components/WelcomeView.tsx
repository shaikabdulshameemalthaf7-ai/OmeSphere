import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  MessageSquare,
  Mic,
  MicOff,
  VideoOff,
  Tag,
  Plus,
  X,
  Lock,
  Globe,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface WelcomeViewProps {
  localStream: MediaStream | null;
  hasMediaPermission: boolean;
  onRequestMedia: () => void;
  onStartMatch: (mode: 'video' | 'text', interests: string[], country: string) => void;
  onlineCount: number;
  activeVideoFilter: string;
  onSelectVideoFilter: (filter: string) => void;
}

const POPULAR_TAGS = [
  'Coding',
  'Gaming',
  'Music',
  'Anime',
  'Languages',
  'Tech',
  'Movies',
  'Art',
  'Fitness',
  'Travel',
  'Philosophy',
  'Science',
];

const FILTER_PRESETS: { id: string; label: string; class: string }[] = [
  { id: 'normal', label: 'Normal', class: '' },
  { id: 'studio', label: 'Studio Glow', class: 'brightness-110 contrast-105 saturate-110' },
  { id: 'cyberpunk', label: 'Cyberpunk', class: 'hue-rotate-30 saturate-150 contrast-125' },
  { id: 'retro', label: 'Retro Noir', class: 'grayscale contrast-125' },
  { id: 'warm', label: 'Warm Glow', class: 'sepia-[0.35] saturate-125 brightness-105' },
];

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  localStream,
  hasMediaPermission,
  onRequestMedia,
  onStartMatch,
  onlineCount,
  activeVideoFilter,
  onSelectVideoFilter,
}) => {
  const [mode, setMode] = useState<'video' | 'text'>('video');
  const [interests, setInterests] = useState<string[]>(['Coding', 'Music']);
  const [tagInput, setTagInput] = useState('');
  const [countryPreference, setCountryPreference] = useState('Worldwide');
  const [micMuted, setMicMuted] = useState(false);
  const [camMuted, setCamMuted] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Bind local preview stream
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Mic level monitor for local feedback
  useEffect(() => {
    if (!localStream || micMuted) {
      setAudioLevel(0);
      return;
    }

    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(localStream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(normalized);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();

      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        source.disconnect();
        audioCtx.close().catch(() => {});
      };
    } catch {
      // AudioContext policy
    }
  }, [localStream, micMuted]);

  // Toggle local mic mute
  const handleToggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle local camera mute
  const handleToggleCam = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCamMuted(!videoTrack.enabled);
      }
    }
  };

  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim().replace(/^#/, '');
    if (clean && !interests.some(t => t.toLowerCase() === clean.toLowerCase()) && interests.length < 8) {
      soundEffects.playClick();
      setInterests([...interests, clean]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    soundEffects.playClick();
    setInterests(interests.filter(t => t !== tagToRemove));
  };

  const handleStart = () => {
    if (!agreedToTerms) return;
    soundEffects.playClick();
    onStartMatch(mode, interests, countryPreference);
  };

  const currentFilterClass = FILTER_PRESETS.find(f => f.id === activeVideoFilter)?.class || '';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
      {/* Hero Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-300 mb-3 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Real-time End-to-End Encrypted WebRTC Video Chat</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-3">
          Meet Strangers <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">Face to Face</span>
        </h1>
        <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto">
          Random video chat with zero servers watching. WebRTC direct peer-to-peer encryption with interest-based matchmaking.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Live Camera Check & Filter Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl relative">
            {/* Top Bar of Camera Preview */}
            <div className="px-4 py-3 bg-neutral-950/60 border-b border-neutral-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-semibold text-neutral-300">Live Camera Check</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsMirrored(!isMirrored)}
                  className={`px-2 py-1 text-xs rounded border transition-all ${
                    isMirrored ? 'bg-neutral-800 text-indigo-300 border-indigo-500/30' : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                  }`}
                  title="Flip mirror orientation"
                >
                  <RotateCcw className="w-3 h-3 inline mr-1" />
                  Mirror
                </button>
              </div>
            </div>

            {/* Video Viewport Container */}
            <div className="relative aspect-video w-full bg-neutral-950 flex items-center justify-center overflow-hidden">
              {hasMediaPermission && localStream && !camMuted ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-all duration-300 ${isMirrored ? 'scale-x-[-1]' : ''} ${currentFilterClass}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center">
                    {camMuted ? <VideoOff className="w-8 h-8 text-neutral-400" /> : <Video className="w-8 h-8 text-neutral-400" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-200">
                      {camMuted ? 'Camera is Muted' : 'Camera Access Needed'}
                    </h4>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                      {camMuted ? 'Turn on camera to preview your video' : 'Grant camera and microphone permission to start video chatting'}
                    </p>
                  </div>
                  {!hasMediaPermission && (
                    <button
                      onClick={onRequestMedia}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                    >
                      Enable Camera & Mic
                    </button>
                  )}
                </div>
              )}

              {/* In-viewport Controls overlay */}
              {hasMediaPermission && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                  {/* Mic & Cam toggle pills */}
                  <div className="flex items-center space-x-2 bg-neutral-900/80 backdrop-blur-md p-1.5 rounded-xl border border-neutral-700/50">
                    <button
                      onClick={handleToggleMic}
                      className={`p-2 rounded-lg transition-colors cursor-pointer ${
                        micMuted ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                      }`}
                      title={micMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                    >
                      {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                    </button>
                    <button
                      onClick={handleToggleCam}
                      className={`p-2 rounded-lg transition-colors cursor-pointer ${
                        camMuted ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                      }`}
                      title={camMuted ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                      {camMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-emerald-400" />}
                    </button>

                    {/* Live Mic volume visualizer */}
                    <div className="flex items-center space-x-1 pl-2 pr-1 border-l border-neutral-700/60">
                      <div className="w-16 h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-75 rounded-full"
                          style={{ width: `${audioLevel}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Active filter badge */}
                  <div className="bg-neutral-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-neutral-700/50 text-xs text-neutral-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{FILTER_PRESETS.find(f => f.id === activeVideoFilter)?.label || 'Normal'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Video Filters Picker */}
            <div className="p-3 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between gap-2 overflow-x-auto">
              <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1 whitespace-nowrap">
                <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400" />
                Filter:
              </span>
              <div className="flex items-center gap-1.5">
                {FILTER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      soundEffects.playClick();
                      onSelectVideoFilter(preset.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                      activeVideoFilter === preset.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Testing tip banner */}
          <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex items-center gap-3 text-xs text-neutral-400">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <strong className="text-neutral-200">How to test with another stranger:</strong> Open this URL in a second browser window or private tab to connect instantly with yourself as a paired peer!
            </div>
          </div>
        </div>

        {/* Right Column: Preferences, Interests & Start Action */}
        <div className="lg:col-span-5 space-y-5">
          {/* Mode Switcher */}
          <div className="bg-neutral-900 border border-neutral-800 p-1.5 rounded-2xl flex items-center">
            <button
              onClick={() => {
                soundEffects.playClick();
                setMode('video');
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                mode === 'video'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Video Chat</span>
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                setMode('text');
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                mode === 'text'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Text Only</span>
            </button>
          </div>

          {/* Interests Section */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-indigo-400" />
                  What are you into?
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Match with strangers who share your passions
                </p>
              </div>
              <span className="text-[11px] font-semibold text-neutral-500">{interests.length}/8 tags</span>
            </div>

            {/* Input tag */}
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(tagInput);
                  }
                }}
                placeholder="Add an interest (e.g. Anime, Coding)..."
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                onClick={() => handleAddTag(tagInput)}
                className="px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {/* Current Selected Tags */}
            {interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {interests.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Popular Suggestions */}
            <div>
              <span className="text-[11px] font-semibold text-neutral-500 block mb-2 uppercase tracking-wider">
                Popular topics:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_TAGS.map((tag) => {
                  const isSelected = interests.some(t => t.toLowerCase() === tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      onClick={() => (isSelected ? handleRemoveTag(tag) : handleAddTag(tag))}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                      }`}
                    >
                      +{tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Region / Country Match filter */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-neutral-800 text-neutral-300">
                <Globe className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Match Region</h4>
                <p className="text-[11px] text-neutral-400">Match with anyone or specific region</p>
              </div>
            </div>
            <select
              value={countryPreference}
              onChange={(e) => setCountryPreference(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              <option value="Worldwide">Worldwide (Any)</option>
              <option value="North America">North America</option>
              <option value="Europe">Europe</option>
              <option value="Asia">Asia</option>
              <option value="Latin America">Latin America</option>
            </select>
          </div>

          {/* Terms & Guidelines Checkbox */}
          <div className="p-3.5 rounded-2xl bg-neutral-900/50 border border-neutral-800/80 space-y-2">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 rounded border-neutral-700 bg-neutral-950 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-neutral-400 leading-snug">
                I confirm I am 18+ and agree to the <strong className="text-neutral-300">Community Safety Terms</strong>. Zero tolerance for nudity, abuse, harassment, or illegal content.
              </span>
            </label>
            <div className="flex items-center space-x-2 text-[11px] text-amber-400/90 pl-6">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Video chats are unmoderated peer-to-peer. Practice online safety.</span>
            </div>
          </div>

          {/* Big Start Button */}
          <button
            onClick={handleStart}
            disabled={!agreedToTerms}
            className={`w-full py-4 rounded-2xl text-base font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xl ${
              agreedToTerms
                ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 hover:from-indigo-500 hover:via-violet-500 hover:to-pink-500 text-white shadow-indigo-600/30 hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
          >
            {mode === 'video' ? <Video className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
            <span>Start {mode === 'video' ? 'Video Chat' : 'Text Chat'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
