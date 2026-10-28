// WebSocket client for real-time matchmaking & WebRTC signaling

export interface ServerStats {
  onlineCount: number;
  queuedCount: number;
  activeChatCount: number;
  totalMatches: number;
}

export interface MatchData {
  roomId: string;
  peerId: string;
  peerCountry: string;
  initiator: boolean;
  commonInterests: string[];
  e2eeFingerprint: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  fromStranger: boolean;
  timestamp: number;
  isSystem?: boolean;
}

export type WSMessageHandler = {
  onConnected?: (userId: string, onlineCount: number) => void;
  onStatsUpdate?: (stats: ServerStats) => void;
  onSearching?: (interests: string[]) => void;
  onMatched?: (match: MatchData) => void;
  onSignal?: (from: string, signalData: RTCSessionDescriptionInit | RTCIceCandidateInit) => void;
  onChatMessage?: (message: ChatMessage) => void;
  onTypingIndicator?: (isTyping: boolean) => void;
  onReaction?: (emoji: string) => void;
  onStrangerDisconnected?: (reason: 'stranger_left' | 'stranger_skipped') => void;
  onSearchCancelled?: () => void;
};

class WSClient {
  private ws: WebSocket | null = null;
  private handlers: WSMessageHandler = {};
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isExplicitlyClosed = false;
  private userId: string = '';

  constructor() {
    this.userId = `user_${Math.random().toString(36).substring(2, 9)}`;
  }

  public getUserId(): string {
    return this.userId;
  }

  public setHandlers(handlers: WSMessageHandler) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Connected to OmeSphere signaling server');
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        this.send({
          type: 'REGISTER',
          userId: this.userId,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      this.ws.onclose = () => {
        if (!this.isExplicitlyClosed) {
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, 2000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket encountered error:', err);
      };
    } catch (err) {
      console.error('Failed to establish WebSocket connection:', err);
    }
  }

  private handleMessage(msg: Record<string, unknown>) {
    switch (msg.type) {
      case 'CONNECTED':
        if (typeof msg.userId === 'string') this.userId = msg.userId;
        this.handlers.onConnected?.(this.userId, Number(msg.onlineCount) || 1);
        break;

      case 'STATS_UPDATE':
        this.handlers.onStatsUpdate?.({
          onlineCount: Number(msg.onlineCount) || 1,
          queuedCount: Number(msg.queuedCount) || 0,
          activeChatCount: Number(msg.activeChatCount) || 0,
          totalMatches: Number(msg.totalMatches) || 0,
        });
        break;

      case 'SEARCHING':
        this.handlers.onSearching?.((msg.interests as string[]) || []);
        break;

      case 'MATCHED':
        this.handlers.onMatched?.({
          roomId: String(msg.roomId),
          peerId: String(msg.peerId),
          peerCountry: String(msg.peerCountry || 'Global'),
          initiator: Boolean(msg.initiator),
          commonInterests: (msg.commonInterests as string[]) || [],
          e2eeFingerprint: String(msg.e2eeFingerprint || '7F4B-91C0-33EA-D802'),
        });
        break;

      case 'SIGNAL':
        this.handlers.onSignal?.(
          String(msg.from),
          msg.signalData as RTCSessionDescriptionInit | RTCIceCandidateInit
        );
        break;

      case 'CHAT_MESSAGE':
        this.handlers.onChatMessage?.({
          id: String(msg.messageId || Date.now()),
          text: String(msg.text),
          fromStranger: Boolean(msg.fromStranger),
          timestamp: Number(msg.timestamp) || Date.now(),
        });
        break;

      case 'TYPING_INDICATOR':
        this.handlers.onTypingIndicator?.(Boolean(msg.isTyping));
        break;

      case 'REACTION':
        this.handlers.onReaction?.(String(msg.emoji));
        break;

      case 'STRANGER_DISCONNECTED':
        this.handlers.onStrangerDisconnected?.(
          (msg.reason as 'stranger_left' | 'stranger_skipped') || 'stranger_left'
        );
        break;

      case 'SEARCH_CANCELLED':
        this.handlers.onSearchCancelled?.();
        break;
    }
  }

  public send(data: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public findMatch(mode: 'video' | 'text', interests: string[], country: string = 'Global') {
    this.send({
      type: 'FIND_MATCH',
      mode,
      interests,
      country,
    });
  }

  public cancelSearch() {
    this.send({ type: 'CANCEL_SEARCH' });
  }

  public sendSignal(to: string, signalData: RTCSessionDescriptionInit | RTCIceCandidateInit) {
    this.send({
      type: 'SIGNAL',
      to,
      signalData,
    });
  }

  public sendChatMessage(to: string, text: string, messageId: string) {
    this.send({
      type: 'CHAT_MESSAGE',
      to,
      text,
      messageId,
    });
  }

  public sendTyping(to: string, isTyping: boolean) {
    this.send({
      type: 'TYPING_INDICATOR',
      to,
      isTyping,
    });
  }

  public sendReaction(to: string, emoji: string) {
    this.send({
      type: 'REACTION',
      to,
      emoji,
    });
  }

  public nextStranger() {
    this.send({ type: 'NEXT_STRANGER' });
  }

  public leave() {
    this.send({ type: 'LEAVE' });
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WSClient();
