import React, { useState, useEffect } from 'react';
import { Sliders, X, Camera, Mic, Volume2, ShieldCheck, Sparkles } from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeVideoFilter: string;
  onSelectVideoFilter: (filter: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onDeviceChange?: (kind: 'video' | 'audio', deviceId: string) => void;
}

const FILTER_PRESETS = [
  { id: 'normal', label: 'Normal (Raw)' },
  { id: 'studio', label: 'Studio Glow' },
  { id: 'cyberpunk', label: 'Cyberpunk Neon' },
  { id: 'retro', label: 'Retro Noir' },
  { id: 'warm', label: 'Warm Sunset' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeVideoFilter,
  onSelectVideoFilter,
  soundEnabled,
  onToggleSound,
}) => {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');

  useEffect(() => {
    if (isOpen && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
        setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const testAudioTone = () => {
    soundEffects.playConnect();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Settings & Devices</h3>
              <p className="text-xs text-neutral-400">Configure your camera, audio & filters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Device Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-indigo-400" />
            Camera Input
          </label>
          <select
            value={selectedVideoDevice}
            onChange={(e) => setSelectedVideoDevice(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            {videoDevices.length > 0 ? (
              videoDevices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))
            ) : (
              <option value="">Default Web Camera</option>
            )}
          </select>
        </div>

        {/* Audio Device Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-indigo-400" />
            Microphone Input
          </label>
          <select
            value={selectedAudioDevice}
            onChange={(e) => setSelectedAudioDevice(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            {audioDevices.length > 0 ? (
              audioDevices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Microphone ${i + 1}`}
                </option>
              ))
            ) : (
              <option value="">Default Microphone</option>
            )}
          </select>
        </div>

        {/* Video Filter Preset */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Camera Visual Effect
          </label>
          <div className="grid grid-cols-2 gap-2">
            {FILTER_PRESETS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  soundEffects.playClick();
                  onSelectVideoFilter(f.id);
                }}
                className={`p-2.5 rounded-xl text-xs font-semibold border text-left transition-all cursor-pointer ${
                  activeVideoFilter === f.id
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sound Effects Controls */}
        <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-neutral-900 text-neutral-300">
              <Volume2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">Audio Chimes & Sound Effects</h4>
              <p className="text-[11px] text-neutral-400">Play chimes on match, message, disconnect</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={testAudioTone}
              className="px-2.5 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg cursor-pointer"
            >
              Test
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                onToggleSound();
              }}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                soundEnabled ? 'bg-indigo-600' : 'bg-neutral-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
                  soundEnabled ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};
