// WebRTC Peer Connection & DataChannel Manager with DTLS-SRTP encryption

export interface PeerStats {
  rttMs: number;
  packetsLost: number;
  candidateType: string;
  videoResolution: string;
  fps: number;
  cipherSuite: string;
}

export interface WebRTCCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onDataChannelMessage: (data: unknown) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private callbacks: WebRTCCallbacks;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  public initConnection(localStream?: MediaStream | null): RTCPeerConnection {
    this.close();

    this.localStream = localStream || null;
    this.pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // Add local tracks if available
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.pc && this.localStream) {
          this.pc.addTrack(track, this.localStream);
        }
      });
    }

    // ICE Candidate handler
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate(event.candidate);
      }
    };

    // Remote Track handler
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.callbacks.onRemoteStream(event.streams[0]);
      } else {
        const stream = new MediaStream([event.track]);
        this.callbacks.onRemoteStream(stream);
      }
    };

    // Connection state changes
    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.callbacks.onConnectionStateChange(this.pc.connectionState);
      }
    };

    // Incoming DataChannel
    this.pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    return this.pc;
  }

  // Set up data channel for P2P direct text/emoji exchange
  public createDataChannel(): RTCDataChannel | null {
    if (!this.pc) return null;
    try {
      this.dataChannel = this.pc.createDataChannel('chat_e2ee', {
        ordered: true,
      });
      this.setupDataChannel(this.dataChannel);
      return this.dataChannel;
    } catch (e) {
      console.warn('Failed to create data channel:', e);
      return null;
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    this.dataChannel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.callbacks.onDataChannelMessage(parsed);
      } catch {
        this.callbacks.onDataChannelMessage(event.data);
      }
    };
    this.dataChannel.onopen = () => {
      console.log('WebRTC DataChannel is now OPEN (Direct P2P E2EE)');
    };
    this.dataChannel.onclose = () => {
      console.log('WebRTC DataChannel closed');
    };
  }

  public sendData(data: unknown): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(typeof data === 'string' ? data : JSON.stringify(data));
        return true;
      } catch (err) {
        console.error('Error sending data over data channel:', err);
      }
    }
    return false;
  }

  // Create WebRTC Offer (Initiator)
  public async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.pc.setLocalDescription(offer);
      return offer;
    } catch (err) {
      console.error('Error creating offer:', err);
      return null;
    }
  }

  // Create WebRTC Answer (Receiver)
  public async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Process any queued candidates received before setRemoteDescription
      while (this.pendingCandidates.length > 0) {
        const cand = this.pendingCandidates.shift();
        if (cand) {
          await this.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
      }

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      return answer;
    } catch (err) {
      console.error('Error creating answer:', err);
      return null;
    }
  }

  // Set remote answer on Initiator
  public async setAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      while (this.pendingCandidates.length > 0) {
        const cand = this.pendingCandidates.shift();
        if (cand) {
          await this.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Error setting remote answer:', err);
    }
  }

  // Add remote ICE candidate
  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('Error adding ice candidate:', err);
    }
  }

  // Replace video track for screen sharing or camera toggle
  public async replaceVideoTrack(newTrack: MediaStreamTrack | null): Promise<void> {
    if (!this.pc) return;
    const senders = this.pc.getSenders();
    const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
    if (videoSender) {
      await videoSender.replaceTrack(newTrack);
    } else if (newTrack && this.localStream) {
      this.pc.addTrack(newTrack, this.localStream);
    }
  }

  // Replace audio track
  public async replaceAudioTrack(newTrack: MediaStreamTrack | null): Promise<void> {
    if (!this.pc) return;
    const senders = this.pc.getSenders();
    const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
    if (audioSender) {
      await audioSender.replaceTrack(newTrack);
    }
  }

  // Get real-time WebRTC stats (DTLS cipher, ping RTT, resolution)
  public async getStats(): Promise<PeerStats | null> {
    if (!this.pc) return null;
    try {
      const stats = await this.pc.getStats();
      let rttMs = 0;
      let packetsLost = 0;
      let candidateType = 'unknown';
      let videoResolution = 'Unknown';
      let fps = 0;
      let cipherSuite = 'AES_128_GCM (DTLS-SRTP)';

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (typeof report.currentRoundTripTime === 'number') {
            rttMs = Math.round(report.currentRoundTripTime * 1000);
          }
        }
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          if (typeof report.packetsLost === 'number') packetsLost = report.packetsLost;
          if (typeof report.framesPerSecond === 'number') fps = Math.round(report.framesPerSecond);
          if (report.frameWidth && report.frameHeight) {
            videoResolution = `${report.frameWidth}x${report.frameHeight}`;
          }
        }
        if (report.type === 'transport') {
          if (report.dtlsCipher) {
            cipherSuite = `${report.dtlsCipher} (DTLS-SRTP)`;
          } else if (report.srtpCipher) {
            cipherSuite = `${report.srtpCipher} (SRTP)`;
          }
        }
        if (report.type === 'remote-candidate') {
          if (report.candidateType) candidateType = report.candidateType;
        }
      });

      return {
        rttMs,
        packetsLost,
        candidateType,
        videoResolution,
        fps,
        cipherSuite,
      };
    } catch {
      return null;
    }
  }

  // Clean close
  public close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.ondatachannel = null;
      this.pc.close();
      this.pc = null;
    }
    this.pendingCandidates = [];
  }
}
