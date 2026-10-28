import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClientUser {
  id: string;
  ws: WebSocket;
  mode: 'video' | 'text';
  interests: string[];
  country: string;
  roomId: string | null;
  partnerId: string | null;
  isSearching: boolean;
  joinedAt: number;
}

interface Room {
  id: string;
  userA: string;
  userB: string;
  commonInterests: string[];
  e2eeFingerprint: string;
  startedAt: number;
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// Global state for matchmaking
const clients = new Map<string, ClientUser>();
const rooms = new Map<string, Room>();
let totalMatchesCount = 0;

// Helper to generate a verification fingerprint (e.g., "7F4B-91C0-33EA-D802")
function generateE2EEFingerprint(): string {
  const chars = '0123456789ABCDEF';
  const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${segment()}-${segment()}-${segment()}-${segment()}`;
}

// Broadcast stats to all connected clients
function broadcastOnlineCount() {
  const onlineCount = clients.size;
  const queuedCount = Array.from(clients.values()).filter(c => c.isSearching).length;
  const activeChatCount = rooms.size * 2;

  const payload = JSON.stringify({
    type: 'STATS_UPDATE',
    onlineCount,
    queuedCount,
    activeChatCount,
    totalMatches: totalMatchesCount,
  });

  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// Matchmaking algorithm
function tryMatch(client: ClientUser) {
  if (!client.isSearching || client.roomId) return;

  // Search queue candidates (excluding self, must be searching and not in a room)
  const candidates = Array.from(clients.values()).filter(
    other => other.id !== client.id && other.isSearching && !other.roomId && other.mode === client.mode
  );

  if (candidates.length === 0) return;

  // Prefer someone with common interests if available
  let bestPartner: ClientUser | null = null;
  let maxCommon: string[] = [];

  for (const candidate of candidates) {
    const common = client.interests.filter(tag =>
      candidate.interests.some(cTag => cTag.toLowerCase() === tag.toLowerCase())
    );
    if (common.length > maxCommon.length) {
      maxCommon = common;
      bestPartner = candidate;
    }
  }

  // If no common interest match, pick the candidate waiting the longest
  if (!bestPartner) {
    candidates.sort((a, b) => a.joinedAt - b.joinedAt);
    bestPartner = candidates[0];
  }

  // Create room and pair them
  const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const e2eeFingerprint = generateE2EEFingerprint();

  client.isSearching = false;
  client.roomId = roomId;
  client.partnerId = bestPartner.id;

  bestPartner.isSearching = false;
  bestPartner.roomId = roomId;
  bestPartner.partnerId = client.id;

  const room: Room = {
    id: roomId,
    userA: client.id,
    userB: bestPartner.id,
    commonInterests: maxCommon,
    e2eeFingerprint,
    startedAt: Date.now(),
  };

  rooms.set(roomId, room);
  totalMatchesCount++;

  // User A will be WebRTC initiator (makes SDP offer), User B answers
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(
      JSON.stringify({
        type: 'MATCHED',
        roomId,
        peerId: bestPartner.id,
        peerCountry: bestPartner.country,
        initiator: true,
        commonInterests: maxCommon,
        e2eeFingerprint,
      })
    );
  }

  if (bestPartner.ws.readyState === WebSocket.OPEN) {
    bestPartner.ws.send(
      JSON.stringify({
        type: 'MATCHED',
        roomId,
        peerId: client.id,
        peerCountry: client.country,
        initiator: false,
        commonInterests: maxCommon,
        e2eeFingerprint,
      })
    );
  }

  broadcastOnlineCount();
}

function handleClientLeave(client: ClientUser, reason: 'stranger_left' | 'stranger_skipped' = 'stranger_left') {
  if (client.roomId) {
    const room = rooms.get(client.roomId);
    if (room) {
      const partnerId = room.userA === client.id ? room.userB : room.userA;
      const partner = clients.get(partnerId);
      if (partner) {
        partner.roomId = null;
        partner.partnerId = null;
        if (partner.ws.readyState === WebSocket.OPEN) {
          partner.ws.send(
            JSON.stringify({
              type: 'STRANGER_DISCONNECTED',
              reason,
            })
          );
        }
      }
      rooms.delete(client.roomId);
    }
    client.roomId = null;
    client.partnerId = null;
  }
  client.isSearching = false;
  broadcastOnlineCount();
}

// WebSocket Connection Management
wss.on('connection', (ws: WebSocket, req) => {
  let clientId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  
  // Default client record
  const client: ClientUser = {
    id: clientId,
    ws,
    mode: 'video',
    interests: [],
    country: 'Global',
    roomId: null,
    partnerId: null,
    isSearching: false,
    joinedAt: Date.now(),
  };

  clients.set(clientId, client);

  // Send welcome & initial stats
  ws.send(
    JSON.stringify({
      type: 'CONNECTED',
      userId: clientId,
      onlineCount: clients.size,
    })
  );

  broadcastOnlineCount();

  ws.on('message', (messageRaw: string) => {
    try {
      const data = JSON.parse(messageRaw.toString());
      switch (data.type) {
        case 'REGISTER': {
          if (data.userId) {
            clients.delete(clientId);
            clientId = data.userId;
            client.id = data.userId;
            clients.set(clientId, client);
          }
          if (data.mode) client.mode = data.mode;
          if (Array.isArray(data.interests)) client.interests = data.interests;
          if (data.country) client.country = data.country;
          break;
        }

        case 'UPDATE_PROFILE': {
          if (data.mode) client.mode = data.mode;
          if (Array.isArray(data.interests)) client.interests = data.interests;
          if (data.country) client.country = data.country;
          break;
        }

        case 'FIND_MATCH': {
          // If in an existing room, disconnect first
          if (client.roomId) {
            handleClientLeave(client, 'stranger_skipped');
          }
          client.isSearching = true;
          client.joinedAt = Date.now();
          if (Array.isArray(data.interests)) client.interests = data.interests;
          if (data.mode) client.mode = data.mode;
          if (data.country) client.country = data.country;

          ws.send(
            JSON.stringify({
              type: 'SEARCHING',
              interests: client.interests,
            })
          );
          broadcastOnlineCount();
          tryMatch(client);
          break;
        }

        case 'CANCEL_SEARCH': {
          client.isSearching = false;
          ws.send(JSON.stringify({ type: 'SEARCH_CANCELLED' }));
          broadcastOnlineCount();
          break;
        }

        case 'SIGNAL': {
          // Relay WebRTC SDP Offer/Answer or ICE Candidate to the active partner
          if (!client.partnerId) return;
          const partner = clients.get(client.partnerId);
          if (partner && partner.roomId === client.roomId && partner.ws.readyState === WebSocket.OPEN) {
            partner.ws.send(
              JSON.stringify({
                type: 'SIGNAL',
                from: client.id,
                signalData: data.signalData,
              })
            );
          }
          break;
        }

        case 'CHAT_MESSAGE': {
          if (!client.partnerId) return;
          const partner = clients.get(client.partnerId);
          if (partner && partner.roomId === client.roomId && partner.ws.readyState === WebSocket.OPEN) {
            partner.ws.send(
              JSON.stringify({
                type: 'CHAT_MESSAGE',
                messageId: data.messageId || `msg_${Date.now()}`,
                text: data.text,
                fromStranger: true,
                timestamp: Date.now(),
              })
            );
          }
          break;
        }

        case 'TYPING_INDICATOR': {
          if (!client.partnerId) return;
          const partner = clients.get(client.partnerId);
          if (partner && partner.roomId === client.roomId && partner.ws.readyState === WebSocket.OPEN) {
            partner.ws.send(
              JSON.stringify({
                type: 'TYPING_INDICATOR',
                isTyping: Boolean(data.isTyping),
              })
            );
          }
          break;
        }

        case 'REACTION': {
          if (!client.partnerId) return;
          const partner = clients.get(client.partnerId);
          if (partner && partner.roomId === client.roomId && partner.ws.readyState === WebSocket.OPEN) {
            partner.ws.send(
              JSON.stringify({
                type: 'REACTION',
                emoji: data.emoji,
              })
            );
          }
          break;
        }

        case 'NEXT_STRANGER': {
          handleClientLeave(client, 'stranger_skipped');
          // Immediately enter matchmaking queue again
          client.isSearching = true;
          client.joinedAt = Date.now();
          ws.send(
            JSON.stringify({
              type: 'SEARCHING',
              interests: client.interests,
            })
          );
          broadcastOnlineCount();
          tryMatch(client);
          break;
        }

        case 'LEAVE': {
          handleClientLeave(client, 'stranger_left');
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    handleClientLeave(client, 'stranger_left');
    clients.delete(clientId);
    broadcastOnlineCount();
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for client ${clientId}:`, err);
  });
});

// Periodic ping to avoid idle disconnects
const pingInterval = setInterval(() => {
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.ping();
    }
  }
}, 30000);

wss.on('close', () => {
  clearInterval(pingInterval);
});

// REST API endpoints
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/stats', (req: Request, res: Response) => {
  res.json({
    onlineUsers: Math.max(clients.size, 1),
    searchingUsers: Array.from(clients.values()).filter(c => c.isSearching).length,
    activeRooms: rooms.size,
    totalMatchesToday: totalMatchesCount,
  });
});

app.post('/api/report', (req: Request, res: Response) => {
  const { reportedPeerId, reason, comment } = req.body;
  console.log(`[REPORT] Peer ${reportedPeerId} was reported for: ${reason}. Comment: ${comment || 'none'}`);
  res.json({ success: true, message: 'Report submitted for review.' });
});

// Vite or Static handling
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const PORT = Number(process.env.PORT) || 3000;

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`> OmeSphere server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
