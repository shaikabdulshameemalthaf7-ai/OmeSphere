import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  EyeOff,
  Eye,
  Flag,
  Send,
  Sparkles,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Volume2,
  VolumeX,
  RotateCcw,
  Smile,
  Zap,
} from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';
import { ChatMessage, MatchData } from '../utils/wsClient';
import { PeerStats } from '../utils/webrtc';

interface VideoRoomProps {
  mode: 'video' | 'text';
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  matchData: MatchData | null;
  connectionState: RTCPeerConnectionState;
  isSearching: boolean;
  messages: ChatMessage[];
  strangerTyping: boolean;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onSendTyping: (isTyping: boolean) => void;
  onNextStranger: () => void;
  onLeave: () => void;
  onOpenReportModal: () => void;
  onOpenE2EEModal: () => void;
  peerStats: PeerStats | null;
  activeVideoFilter: string;
}

const EMOJI_REACTIONS = ['❤️', '😂', '🔥', '👏', '😮', '👋', '🎉', '💯'];

export const VideoRoom: React.FC<VideoRoomProps> = ({
  mode,
  localStream,
  remoteStream,
  matchData,
  connectionState,
  isSearching,
  messages,
  strangerTyping,
  onSendMessage,
  onSendReaction,
  onSendTyping,
  onNextStranger,
  onLeave,
  onOpenReportModal,
  onOpenE2EEModal,
  peerStats,
  activeVideoFilter,
}) => {
  const [inputText, setInputText] = useState('');
  const [micMuted, setMicMuted] = useState(false);
  const [camMuted, setCamMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [emergencyBlur, setEmergencyBlur] = useState(false);
  const [strangerMuted, setStrangerMuted] = useState(false);
  const [strangerVolume, setStrangerVolume] = useState(1);
  const [reallyStop, setReallyStop] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string; left: number }[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reallyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Adjust stranger video volume
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = strangerMuted;
      remoteVideoRef.current.volume = strangerMuted ? 0 : strangerVolume;
    }
  }, [strangerMuted, strangerVolume]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, strangerTyping]);

  // Handle Esc shortcut for "Stop" / "Really?" / "Next"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in input and Escape is pressed, trigger stop
      if (e.key === 'Escape') {
        e.preventDefault();
        handleStopOrNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reallyStop, isSearching, matchData]);

  // Floating emoji reaction animation
  const triggerReaction = (emoji: string) => {
    soundEffects.playClick();
    onSendReaction(emoji);
    const id = Date.now() + Math.random();
    const left = 20 + Math.random() * 60; // 20% to 80%
    setFloatingEmojis((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 2000);
  };

  // Esc / Next logic
  const handleStopOrNext = () => {
    soundEffects.playClick();
    if (isSearching) {
      // Cancel search
      onLeave();
      return;
    }

    if (!matchData) {
      // Disconnected state -> Start searching next stranger immediately
      onNextStranger();
      return;
    }

    // Currently chatting: First click says "Really?", second confirms next
    if (!reallyStop) {
      setReallyStop(true);
      if (reallyTimeoutRef.current) clearTimeout(reallyTimeoutRef.current);
      reallyTimeoutRef.current = setTimeout(() => {
        setReallyStop(false);
      }, 2500);
    } else {
      setReallyStop(false);
      if (reallyTimeoutRef.current) clearTimeout(reallyTimeoutRef.current);
      onNextStranger();
    }
  };

  // Toggle local mic mute
  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle local cam mute
  const toggleCam = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCamMuted(!videoTrack.enabled);
      }
    }
  };

  // Screen share handler
  const handleScreenShare = async () => {
    if (isScreenSharing) {
      // Switch back to webcam
      if (localStream && localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = displayStream;
        }
        setIsScreenSharing(true);
        displayStream.getVideoTracks()[0].onended = () => {
          if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
          setIsScreenSharing(false);
        };
      } catch (err) {
        console.warn('Screen share canceled or denied:', err);
      }
    }
  };

  // Send message
  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (trimmed && matchData) {
      soundEffects.playMessageSent();
      onSendMessage(trimmed);
      setInputText('');
      onSendTyping(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  // Typing indicator trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (matchData) {
      onSendTyping(e.target.value.length > 0);
    }
  };

  // Fullscreen container toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-neutral-950">
      {/* LEFT AREA: Video Streams & Primary Controls */}
      <div className="flex-1 flex flex-col p-3 md:p-4 gap-3 overflow-hidden">
        {/* Video Canvas Container (Split or Stranger View + Floating Local) */}
        <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-2xl relative overflow-hidden flex flex-col justify-center items-center shadow-2xl">
          {/* STRANGER VIDEO (Main) */}
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {matchData && remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-all duration-300 ${
                  emergencyBlur ? 'blur-3xl brightness-75 scale-105' : ''
                }`}
              />
            ) : isSearching ? (
              // Searching Animation
              <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-indigo-400 animate-pulse" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Looking for a stranger...</h3>
                  <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                    Searching globally for someone who shares your interests. Ready to talk!
                  </p>
                </div>
              </div>
            ) : (
              // Stranger Disconnected or Idle
              <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                  <VideoOff className="w-7 h-7 text-neutral-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-200">Stranger disconnected</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[11px] border border-neutral-700">Esc</kbd> or click New to meet someone new.
                  </p>
                </div>
                <button
                  onClick={onNextStranger}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  Find Next Stranger
                </button>
              </div>
            )}

            {/* Emergency Blur Indicator Banner */}
            {emergencyBlur && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-md p-6 text-center z-10">
                <EyeOff className="w-12 h-12 text-amber-400 mb-2 animate-bounce" />
                <h4 className="text-base font-bold text-white">Emergency Video Blur Active</h4>
                <p className="text-xs text-neutral-300 max-w-xs mt-1 mb-4">
                  Stranger's video is shielded from your screen. You can unblur or skip anytime.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEmergencyBlur(false)}
                    className="px-4 py-2 rounded-xl bg-neutral-800 text-xs font-semibold text-white hover:bg-neutral-700 cursor-pointer"
                  >
                    Unblur
                  </button>
                  <button
                    onClick={onNextStranger}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
                  >
                    Next Stranger
                  </button>
                </div>
              </div>
            )}

            {/* Top Stranger Status Bar */}
            {matchData && (
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                {/* Stranger info badge */}
                <div className="flex items-center space-x-2 bg-neutral-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-700/50 pointer-events-auto">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-white">Stranger</span>
                  <span className="text-[11px] text-neutral-400 font-medium">({matchData.peerCountry})</span>
                  {peerStats?.rttMs ? (
                    <span className="text-[10px] text-cyan-400 font-mono pl-1 border-l border-neutral-700">
                      {peerStats.rttMs}ms
                    </span>
                  ) : null}
                </div>

                {/* Stranger Safety Controls: Blur, Mute, Report, Fullscreen */}
                <div className="flex items-center space-x-1.5 pointer-events-auto bg-neutral-900/80 backdrop-blur-md p-1 rounded-xl border border-neutral-700/50">
                  {/* Emergency Blur Button */}
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setEmergencyBlur(!emergencyBlur);
                    }}
                    className={`p-2 rounded-lg text-xs transition-colors cursor-pointer ${
                      emergencyBlur
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                    }`}
                    title={emergencyBlur ? 'Turn off video blur' : 'Emergency Shield: Blur stranger video immediately'}
                  >
                    {emergencyBlur ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>

                  {/* Stranger audio mute */}
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setStrangerMuted(!strangerMuted);
                    }}
                    className={`p-2 rounded-lg text-xs transition-colors cursor-pointer ${
                      strangerMuted ? 'bg-red-500/20 text-red-400' : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                    title={strangerMuted ? 'Unmute Stranger' : 'Mute Stranger Audio'}
                  >
                    {strangerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  {/* Report user */}
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onOpenReportModal();
                    }}
                    className="p-2 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Report stranger for inappropriate behavior"
                  >
                    <Flag className="w-4 h-4" />
                  </button>

                  {/* Fullscreen toggle */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Floating Reaction Emojis Animation on Stranger Video */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
              {floatingEmojis.map((item) => (
                <div
                  key={item.id}
                  className="absolute bottom-10 text-4xl animate-float-fade"
                  style={{ left: `${item.left}%` }}
                >
                  {item.emoji}
                </div>
              ))}
            </div>

            {/* LOCAL VIDEO (Picture in Picture overlay in corner) */}
            <div className="absolute bottom-3 right-3 w-36 sm:w-48 aspect-video bg-neutral-950 rounded-xl overflow-hidden border border-neutral-700 shadow-2xl z-10 group">
              {mode === 'video' && localStream && !camMuted ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isMirrored && !isScreenSharing ? 'scale-x-[-1]' : ''}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-500 text-xs font-medium">
                  {camMuted ? 'Camera Muted' : 'Text Only'}
                </div>
              )}

              {/* Local control overlay on hover */}
              <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                <button
                  onClick={toggleMic}
                  className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                    micMuted ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-200'
                  }`}
                  title={micMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                  {micMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
                <button
                  onClick={toggleCam}
                  className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                    camMuted ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-200'
                  }`}
                  title={camMuted ? 'Turn Cam On' : 'Turn Cam Off'}
                >
                  {camMuted ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
                <button
                  onClick={() => setIsMirrored(!isMirrored)}
                  className="p-1.5 rounded-lg bg-neutral-800 text-neutral-200 text-xs cursor-pointer"
                  title="Flip mirror"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* "You" badge */}
              <span className="absolute bottom-1.5 left-1.5 bg-neutral-950/80 backdrop-blur-sm text-[10px] font-bold text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-800">
                You {micMuted && '• Muted'}
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR (Omegle Classic Stop / Next Button & Media Controls) */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-2.5 flex items-center justify-between gap-3">
          {/* THE BIG "STOP" / "REALLY?" / "NEW" BUTTON */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleStopOrNext}
              className={`px-6 py-3 rounded-xl font-black text-sm tracking-wide transition-all cursor-pointer shadow-lg select-none flex items-center gap-2 ${
                isSearching
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                  : reallyStop
                  ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                  : matchData
                  ? 'bg-neutral-800 hover:bg-red-600/90 text-white border border-neutral-700 hover:border-red-500'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
            >
              {isSearching ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Searching... (Esc)</span>
                </>
              ) : reallyStop ? (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Really? (Esc)</span>
                </>
              ) : matchData ? (
                <>
                  <span>Stop (Esc)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>New Stranger (Esc)</span>
                </>
              )}
            </button>

            {/* Leave / Exit to Menu button */}
            <button
              onClick={() => {
                soundEffects.playClick();
                onLeave();
              }}
              className="px-3 py-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs font-semibold border border-neutral-800 cursor-pointer transition-colors"
              title="Leave chat and return to lobby"
            >
              Exit to Lobby
            </button>
          </div>

          {/* Common Interests tags indicator */}
          {matchData && matchData.commonInterests && matchData.commonInterests.length > 0 && (
            <div className="hidden md:flex items-center space-x-1.5 overflow-hidden">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Common:
              </span>
              {matchData.commonInterests.map((interest) => (
                <span
                  key={interest}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                >
                  #{interest}
                </span>
              ))}
            </div>
          )}

          {/* Local Device quick bar */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={toggleMic}
              className={`p-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                micMuted
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:bg-neutral-700'
              }`}
              title={micMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              onClick={toggleCam}
              className={`p-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                camMuted
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:bg-neutral-700'
              }`}
              title={camMuted ? 'Turn Cam On' : 'Turn Cam Off'}
            >
              {camMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              onClick={handleScreenShare}
              className={`p-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isScreenSharing
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
              }`}
              title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
            >
              <Monitor className="w-4 h-4" />
            </button>

            {/* E2EE Lock Icon */}
            <button
              onClick={onOpenE2EEModal}
              className="p-2.5 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/40 transition-colors cursor-pointer"
              title="End-to-End Encryption verified"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT AREA: Live Text Chat & Reactions */}
      <div className="w-full lg:w-96 flex flex-col border-t lg:border-t-0 lg:border-l border-neutral-800 bg-neutral-900/60 backdrop-blur-md">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Stranger Chat
            </span>
            {matchData && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                P2P Connected
              </span>
            )}
          </div>
          <button
            onClick={onOpenE2EEModal}
            className="text-[11px] font-semibold text-neutral-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>DTLS 256-bit</span>
          </button>
        </div>

        {/* Messages Scroll Area */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
          {/* Welcome greeting */}
          <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-400 space-y-1">
            <div className="font-bold text-neutral-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Direct Peer-to-Peer Encrypted</span>
            </div>
            <p>Video, audio, and messages travel directly between browsers via WebRTC with DTLS-SRTP encryption.</p>
          </div>

          {/* Render chat message history */}
          {messages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="text-center my-2">
                  <span className="inline-block px-3 py-1 rounded-full text-[11px] font-medium bg-neutral-800/80 text-amber-300/90 border border-neutral-700/60">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isStranger = msg.fromStranger;
            return (
              <div key={msg.id} className={`flex flex-col ${isStranger ? 'items-start' : 'items-end'}`}>
                <span className={`text-[10px] font-bold mb-0.5 ${isStranger ? 'text-rose-400' : 'text-cyan-400'}`}>
                  {isStranger ? 'Stranger' : 'You'}
                </span>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-sm ${
                    isStranger
                      ? 'bg-neutral-800 text-neutral-100 rounded-tl-sm border border-neutral-700/60'
                      : 'bg-indigo-600 text-white rounded-tr-sm shadow-indigo-600/20'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}

          {/* Stranger typing indicator */}
          {strangerTyping && (
            <div className="flex items-center space-x-1.5 text-xs text-neutral-400 py-1 pl-1">
              <span className="text-[11px] font-medium text-rose-400">Stranger is typing</span>
              <span className="flex space-x-1">
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
              </span>
            </div>
          )}
        </div>

        {/* Emoji Reaction Bar */}
        <div className="px-3 py-2 bg-neutral-950/40 border-t border-neutral-800/80 flex items-center justify-between gap-1">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider pl-1">
            Reactions:
          </span>
          <div className="flex items-center gap-1 overflow-x-auto">
            {EMOJI_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => triggerReaction(emoji)}
                disabled={!matchData}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-800 text-base transition-transform active:scale-125 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 border-t border-neutral-800 bg-neutral-950 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            disabled={!matchData}
            placeholder={
              matchData
                ? 'Type a message (Press Enter)...'
                : isSearching
                ? 'Finding stranger...'
                : 'Stranger disconnected'
            }
            className="flex-1 bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || !matchData}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
