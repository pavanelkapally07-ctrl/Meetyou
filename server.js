require('dotenv').config();
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false }, maxHttpBufferSize: 1e5 });
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.static('public'));
app.get('/health', (_req, res) => res.json({ ok: true, app: 'Meetyou MVP', paymentsEnabled: false }));

const rooms = new Map(); // Demo-only in-memory room membership; resets when server restarts.
const blockedWords = [];
function cleanText(value, max = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, max);
}
function roomSet(room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  return rooms.get(room);
}
function emitMembers(room) {
  const members = [...(rooms.get(room) || [])].map(id => {
    const s = io.sockets.sockets.get(id);
    return s ? { id, name: s.data.displayName || 'Guest' } : null;
  }).filter(Boolean);
  io.to(room).emit('members', members);
}

io.on('connection', socket => {
  socket.data.rooms = new Set();
  socket.on('join-room', payload => {
    const room = cleanText(payload?.room, 32).replace(/[^a-zA-Z0-9_-]/g, '');
    const name = cleanText(payload?.name, 32);
    const ageConfirmed = payload?.ageConfirmed === true;
    const consentAccepted = payload?.consentAccepted === true;
    if (!room || room.length < 4 || !name || !ageConfirmed || !consentAccepted) {
      socket.emit('app-error', 'Enter a room code, display name, confirm you are 18+, and accept the community/consent rules.');
      return;
    }
    // Demo guardrails: cap room size and prevent one socket joining many rooms.
    if (socket.data.rooms.size >= 1 || roomSet(room).size >= 6) {
      socket.emit('app-error', 'You are already in a room, or this room has reached its 6-person demo limit.');
      return;
    }
    socket.data.displayName = name;
    socket.data.rooms.add(room);
    socket.join(room);
    roomSet(room).add(socket.id);
    socket.data.activeRoom = room;
    socket.emit('joined', { room, selfId: socket.id, demo: true });
    socket.to(room).emit('system-message', `${name} joined the room.`);
    emitMembers(room);
  });

  socket.on('chat-message', raw => {
    const room = socket.data.activeRoom;
    if (!room || !roomSet(room).has(socket.id)) return;
    const text = cleanText(raw, 500);
    if (!text) return;
    io.to(room).emit('chat-message', { id: socket.id, name: socket.data.displayName, text, at: new Date().toISOString() });
  });

  // WebRTC signaling only; media flows peer-to-peer and is not recorded by this server.
  for (const event of ['webrtc-offer', 'webrtc-answer', 'webrtc-ice']) {
    socket.on(event, payload => {
      const room = socket.data.activeRoom;
      if (!room || !roomSet(room).has(socket.id)) return;
      const target = cleanText(payload?.target, 80);
      if (!target || !roomSet(room).has(target)) return;
      socket.to(target).emit(event, { from: socket.id, data: payload.data });
    });
  }
  socket.on('report-user', payload => {
    const room = socket.data.activeRoom;
    if (!room || !roomSet(room).has(socket.id)) return;
    const target = cleanText(payload?.target, 80);
    const reason = cleanText(payload?.reason, 200);
    // Demo only: log report to server output. Production must persist reports and provide human review.
    console.warn('[DEMO SAFETY REPORT]', { room, reporter: socket.data.displayName, target, reason, at: new Date().toISOString() });
    socket.emit('report-received', 'Report recorded in this demo server log. A production service needs a real moderation queue.');
  });
  socket.on('leave-room', () => leaveRoom(socket));
  socket.on('disconnect', () => leaveRoom(socket));
});
function leaveRoom(socket) {
  const room = socket.data.activeRoom;
  if (!room) return;
  const name = socket.data.displayName || 'Guest';
  socket.to(room).emit('system-message', `${name} left the room.`);
  socket.to(room).emit('peer-left', { id: socket.id });
  socket.leave(room);
  rooms.get(room)?.delete(socket.id);
  if (rooms.get(room)?.size === 0) rooms.delete(room); else emitMembers(room);
  socket.data.rooms?.delete(room);
  socket.data.activeRoom = null;
}

server.listen(PORT, () => console.log(`Meetyou MVP running at http://localhost:${PORT}`));
