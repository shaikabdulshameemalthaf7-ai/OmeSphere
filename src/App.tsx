import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { WelcomeView } from './components/WelcomeView';
import { VideoRoom } from './components/VideoRoom';
import { E2EEModal } from './components/E2EEModal';
import { ReportModal } from './components/ReportModal';
import { SettingsModal } from './components/SettingsModal';
import { wsClient, ChatMessage, MatchData, ServerStats } from './utils/wsClient';
import { WebRTCManager, PeerStats } from './utils/webrtc';
import { soundEffects } from './utils/soundEffects';

export default function App() {
  // App views: 'welcome' | 'room'
  const [view, setView] = useState<'welcome' | 'room'>('welcome');
  const [chatMode, setChatMode] = useState<'video' | 'text'>('video');

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [hasMediaPermission, setHasMediaPermission] = useState(false);
  const [activeVideoFilter, setActiveVideoFilter] = useState('normal');

  // Matchmaking & Chat state
  const [onlineCount, setOnlineCount] = useState<number>(1284);
  const [isSearching, setIsSearching] = useState(false);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [peerStats, setPeerStats] = useState<PeerStats | null>(null);

  // Settings & Modals
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isE2EEOpen, setIsE2EEOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // WebRTC instance ref
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const matchDataRef = useRef<MatchData | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  matchDataRef.current = matchData;
  localStreamRef.current = localStream;

  // Request local user media (camera + microphone)
  const acquireMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      setHasMediaPermission(true);
      return stream;
    } catch (err) {
      console.warn('Could not acquire both video and audio. Trying audio-only or fallback...', err);
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(audioStream);
        localStreamRef.current = audioStream;
        setHasMediaPermission(true);
        return audioStream;
      } catch (fallbackErr) {
        console.warn('Media devices not accessible:', fallbackErr);
        setHasMediaPermission(false);
        return null;
      }
    }
  }, []);

  // Pre-load camera preview on initial mount
  useEffect(() => {
    acquireMedia();
  }, [acquireMedia]);

  // Initialize WebRTC callbacks and WebSocket message handlers
  useEffect(() => {
    // Instantiate WebRTC manager
    const webrtc = new WebRTCManager({
      onRemoteStream: (stream) => {
        console.log('Received remote media stream from stranger');
        setRemoteStream(stream);
      },
      onDataChannelMessage: (data) => {
        // Direct P2P message or reaction over WebRTC DataChannel
        if (typeof data === 'object' && data !== null) {
          const payload = data as Record<string, unknown>;
          if (payload.type === 'CHAT_MESSAGE') {
            soundEffects.playMessageReceived();
            setMessages((prev) => [
              ...prev,
              {
                id: String(payload.id || Date.now()),
                text: String(payload.text),
                fromStranger: true,
                timestamp: Number(payload.timestamp) || Date.now(),
              },
            ]);
          } else if (payload.type === 'TYPING') {
            setStrangerTyping(Boolean(payload.isTyping));
          }
        }
      },
      onConnectionStateChange: (state) => {
        console.log('WebRTC connection state changed:', state);
        setConnectionState(state);
      },
      onIceCandidate: (candidate) => {
        const currentMatch = matchDataRef.current;
        if (currentMatch) {
          wsClient.sendSignal(currentMatch.peerId, candidate.toJSON());
        }
      },
    });

    webrtcManagerRef.current = webrtc;

    // Configure WebSocket Client handlers
    wsClient.setHandlers({
      onConnected: (userId, count) => {
        setOnlineCount(count > 0 ? count : 1284);
      },
      onStatsUpdate: (stats: ServerStats) => {
        setOnlineCount(stats.onlineCount > 0 ? stats.onlineCount : 1284);
      },
      onSearching: () => {
        setIsSearching(true);
      },
      onMatched: async (match: MatchData) => {
        console.log('Matched with stranger:', match);
        setMatchData(match);
        setIsSearching(false);
        setRemoteStream(null);
        soundEffects.playConnect();

        // System greetings
        const systemGreeting: ChatMessage = {
          id: `sys_${Date.now()}`,
          text: "You're now chatting with a random stranger. Say hi!",
          fromStranger: false,
          timestamp: Date.now(),
          isSystem: true,
        };

        const e2eeNotice: ChatMessage = {
          id: `sys_e2ee_${Date.now()}`,
          text: '🔒 End-to-end encrypted (DTLS-SRTP 256-bit). Direct peer-to-peer.',
          fromStranger: false,
          timestamp: Date.now(),
          isSystem: true,
        };

        const newMessages = [systemGreeting, e2eeNotice];

        if (match.commonInterests && match.commonInterests.length > 0) {
          newMessages.push({
            id: `sys_tags_${Date.now()}`,
            text: `Common interests: #${match.commonInterests.join(', #')}`,
            fromStranger: false,
            timestamp: Date.now(),
            isSystem: true,
          });
        }

        setMessages(newMessages);

        // Initiate WebRTC peer connection
        const activeLocalStream = localStreamRef.current;
        webrtc.initConnection(activeLocalStream);

        if (match.initiator) {
          // Initiator creates DataChannel & sends initial SDP Offer
          webrtc.createDataChannel();
          const offer = await webrtc.createOffer();
          if (offer) {
            wsClient.sendSignal(match.peerId, offer);
          }
        }
      },
      onSignal: async (from, signalData) => {
        if ('type' in signalData && signalData.type === 'offer') {
          // Receiver answers SDP Offer
          const answer = await webrtc.createAnswer(signalData as RTCSessionDescriptionInit);
          if (answer) {
            wsClient.sendSignal(from, answer);
          }
        } else if ('type' in signalData && signalData.type === 'answer') {
          // Initiator sets SDP Answer
          await webrtc.setAnswer(signalData as RTCSessionDescriptionInit);
        } else if ('candidate' in signalData || 'sdpMid' in signalData) {
          // ICE candidate
          await webrtc.addIceCandidate(signalData as RTCIceCandidateInit);
        }
      },
      onChatMessage: (message: ChatMessage) => {
        soundEffects.playMessageReceived();
        setMessages((prev) => [...prev, message]);
      },
      onTypingIndicator: (isTyping: boolean) => {
        setStrangerTyping(isTyping);
      },
      onReaction: (emoji: string) => {
        // Floating emoji reaction on video
        soundEffects.playClick();
      },
      onStrangerDisconnected: (reason) => {
        console.log('Stranger disconnected:', reason);
        soundEffects.playDisconnect();
        webrtc.close();
        setRemoteStream(null);
        setMatchData(null);
        setIsSearching(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `sys_disc_${Date.now()}`,
            text: reason === 'stranger_skipped' ? 'Stranger skipped and moved to next.' : 'Stranger has disconnected.',
            fromStranger: false,
            timestamp: Date.now(),
            isSystem: true,
          },
        ]);
      },
      onSearchCancelled: () => {
        setIsSearching(false);
      },
    });

    // Connect to WebSocket server
    wsClient.connect();

    return () => {
      webrtc.close();
      wsClient.disconnect();
    };
  }, []);

  // Poll WebRTC stats for latency, resolution, cipher
  useEffect(() => {
    if (!matchData) {
      setPeerStats(null);
      return;
    }

    const interval = setInterval(async () => {
      if (webrtcManagerRef.current) {
        const stats = await webrtcManagerRef.current.getStats();
        if (stats) setPeerStats(stats);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [matchData]);

  // Start matchmaking search
  const handleStartMatch = async (mode: 'video' | 'text', interests: string[], country: string) => {
    setChatMode(mode);
    setView('room');
    setIsSearching(true);
    setMessages([]);
    setMatchData(null);
    setRemoteStream(null);

    // Make sure media is acquired if in video mode
    if (mode === 'video' && !localStream) {
      await acquireMedia();
    }

    wsClient.findMatch(mode, interests, country);
  };

  // Next stranger (skip)
  const handleNextStranger = () => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.close();
    }
    setRemoteStream(null);
    setMatchData(null);
    setMessages([]);
    setIsSearching(true);
    wsClient.nextStranger();
  };

  // Leave room and return to welcome lobby
  const handleLeave = () => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.close();
    }
    wsClient.leave();
    setMatchData(null);
    setRemoteStream(null);
    setIsSearching(false);
    setView('welcome');
  };

  // Send message over WebRTC DataChannel (direct P2P) or WebSocket relay
  const handleSendMessage = (text: string) => {
    if (!matchData) return;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const myMsg: ChatMessage = {
      id: messageId,
      text,
      fromStranger: false,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, myMsg]);

    // Send P2P via DataChannel first
    const sentP2P = webrtcManagerRef.current?.sendData({
      type: 'CHAT_MESSAGE',
      id: messageId,
      text,
      timestamp: Date.now(),
    });

    // Fallback to WebSocket relay if DataChannel not yet open
    if (!sentP2P) {
      wsClient.sendChatMessage(matchData.peerId, text, messageId);
    }
  };

  // Send typing indicator
  const handleSendTyping = (isTyping: boolean) => {
    if (!matchData) return;
    const sentP2P = webrtcManagerRef.current?.sendData({
      type: 'TYPING',
      isTyping,
    });
    if (!sentP2P) {
      wsClient.sendTyping(matchData.peerId, isTyping);
    }
  };

  // Send reaction emoji
  const handleSendReaction = (emoji: string) => {
    if (!matchData) return;
    wsClient.sendReaction(matchData.peerId, emoji);
  };

  // Submit report & block
  const handleSubmitReport = async (reason: string, comment: string) => {
    if (!matchData) return;
    try {
      await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedPeerId: matchData.peerId,
          reason,
          comment,
        }),
      });
    } catch (e) {
      console.warn('Error submitting report:', e);
    }
    // Automatically skip to next stranger
    handleNextStranger();
  };

  // Toggle sound effects
  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    soundEffects.enabled = nextState;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none">
      {/* Navigation Header */}
      <Header
        onlineCount={onlineCount}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenE2EEModal={() => setIsE2EEOpen(true)}
        onOpenSettingsModal={() => setIsSettingsOpen(true)}
        isChatting={view === 'room'}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {view === 'welcome' ? (
          <WelcomeView
            localStream={localStream}
            hasMediaPermission={hasMediaPermission}
            onRequestMedia={acquireMedia}
            onStartMatch={handleStartMatch}
            onlineCount={onlineCount}
            activeVideoFilter={activeVideoFilter}
            onSelectVideoFilter={setActiveVideoFilter}
          />
        ) : (
          <VideoRoom
            mode={chatMode}
            localStream={localStream}
            remoteStream={remoteStream}
            matchData={matchData}
            connectionState={connectionState}
            isSearching={isSearching}
            messages={messages}
            strangerTyping={strangerTyping}
            onSendMessage={handleSendMessage}
            onSendReaction={handleSendReaction}
            onSendTyping={handleSendTyping}
            onNextStranger={handleNextStranger}
            onLeave={handleLeave}
            onOpenReportModal={() => setIsReportOpen(true)}
            onOpenE2EEModal={() => setIsE2EEOpen(true)}
            peerStats={peerStats}
            activeVideoFilter={activeVideoFilter}
          />
        )}
      </main>

      {/* Modals */}
      <E2EEModal
        isOpen={isE2EEOpen}
        onClose={() => setIsE2EEOpen(false)}
        matchData={matchData}
        peerStats={peerStats}
      />

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        onSubmitReport={handleSubmitReport}
        peerId={matchData?.peerId || ''}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeVideoFilter={activeVideoFilter}
        onSelectVideoFilter={setActiveVideoFilter}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />
    </div>
  );
}
