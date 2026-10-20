(() => {
  const socket = io();
  const $ = id => document.getElementById(id);
  const joinPanel = $('join-panel'), workspace = $('workspace');
  const messages = $('messages');
  let room = null, selfId = null, members = [], localStream = null, peerConnections = new Map(), currentPeer = null, muted = false;
  const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }; // Add a TURN provider for reliable production calls.
  function toast(text) { const el = $('toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 4200); }
  function addSystem(text) { const el = document.createElement('div'); el.className = 'system-msg'; el.textContent = text; messages.appendChild(el); messages.scrollTop = messages.scrollHeight; }
  function addMessage(m) { const el = document.createElement('div'); el.className = 'msg' + (m.id === selfId ? ' mine' : ''); const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${m.name || 'Guest'} · ${new Date(m.at || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`; const body = document.createElement('div'); body.textContent = m.text; el.append(meta, body); messages.appendChild(el); messages.scrollTop = messages.scrollHeight; }
  function updateMembers(list) { members = list; const select = $('report-target'); select.replaceChildren(new Option('Choose a person', '')); list.filter(m => m.id !== selfId).forEach(m => select.add(new Option(m.name, m.id))); const peer = list.find(m => m.id === currentPeer); $('remote-label').textContent = peer ? peer.name : 'Other person'; }
  $('join-form').addEventListener('submit', e => { e.preventDefault(); socket.emit('join-room', { name: $('display-name').value.trim(), room: $('room-code').value.trim(), ageConfirmed: $('age-confirm').checked, consentAccepted: $('consent-confirm').checked }); });
  socket.on('joined', data => { room = data.room; selfId = data.selfId; joinPanel.classList.add('hidden'); workspace.classList.remove('hidden'); $('room-label').textContent = room; addSystem('You joined. Share the room code only with people you want to meet.'); toast('Joined room. Please respect consent and boundaries.'); });
  socket.on('app-error', msg => toast(msg)); socket.on('members', updateMembers); socket.on('system-message', addSystem); socket.on('chat-message', addMessage); socket.on('report-received', toast);
  $('chat-form').addEventListener('submit', e => { e.preventDefault(); const input = $('message-input'); if (input.value.trim()) { socket.emit('chat-message', input.value.trim()); input.value = ''; } });
  async function getPeer(target) {
    if (peerConnections.has(target)) return peerConnections.get(target);
    const pc = new RTCPeerConnection(rtcConfig); peerConnections.set(target, pc); currentPeer = target;
    if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    pc.onicecandidate = e => { if (e.candidate) socket.emit('webrtc-ice', { target, data: e.candidate }); };
    pc.ontrack = e => { $('remote-video').srcObject = e.streams[0]; const p = members.find(m => m.id === target); $('remote-label').textContent = p?.name || 'Other person'; };
    pc.onconnectionstatechange = () => { if (['failed','disconnected','closed'].includes(pc.connectionState)) toast('Video connection ended. You can try again.'); };
    return pc;
  }
  $('start-call').addEventListener('click', async () => {
    if (!room) return toast('Join a room first.');
    const peer = members.find(m => m.id !== selfId);
    if (!peer) return toast('Wait for another person to join the same room.');
    try {
      if (!localStream) { localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); $('local-video').srcObject = localStream; $('mute-btn').disabled = false; $('end-call').disabled = false; }
      const pc = await getPeer(peer.id); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); socket.emit('webrtc-offer', { target: peer.id, data: pc.localDescription }); toast('Call invitation sent. The other person must accept by starting their call.');
    } catch (err) { toast(err.name === 'NotAllowedError' ? 'Camera/microphone permission was denied.' : 'Could not start camera. Use HTTPS or localhost and check your devices.'); }
  });
  socket.on('webrtc-offer', async ({ from, data }) => {
    try { if (!localStream) { localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); $('local-video').srcObject = localStream; $('mute-btn').disabled = false; $('end-call').disabled = false; } const pc = await getPeer(from); await pc.setRemoteDescription(data); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); socket.emit('webrtc-answer', { target: from, data: pc.localDescription }); toast('Video call connected. You can end it at any time.'); } catch (e) { toast('Could not accept call. Check camera/microphone permission.'); }
  });
  socket.on('webrtc-answer', async ({ from, data }) => { const pc = peerConnections.get(from); if (pc) { try { await pc.setRemoteDescription(data); toast('Video call connected.'); } catch (_) {} } });
  socket.on('webrtc-ice', async ({ from, data }) => { const pc = peerConnections.get(from); if (pc) { try { await pc.addIceCandidate(data); } catch (_) {} } });
  function endCall() { peerConnections.forEach(pc => pc.close()); peerConnections.clear(); currentPeer = null; if (localStream) localStream.getTracks().forEach(t => t.stop()); localStream = null; $('local-video').srcObject = null; $('remote-video').srcObject = null; $('mute-btn').disabled = true; $('end-call').disabled = true; muted = false; $('mute-btn').textContent = 'Mute mic'; toast('Call ended.'); }
  $('end-call').addEventListener('click', endCall);
  $('mute-btn').addEventListener('click', () => { if (!localStream) return; muted = !muted; localStream.getAudioTracks().forEach(t => t.enabled = !muted); $('mute-btn').textContent = muted ? 'Unmute mic' : 'Mute mic'; });
  $('report-btn').addEventListener('click', () => { const target = $('report-target').value; if (!target) return toast('Choose a person to report.'); socket.emit('report-user', { target, reason: $('report-reason').value }); });
  $('block-btn').addEventListener('click', () => { const target = $('report-target').value; if (!target) return toast('Choose a person first.'); const pc = peerConnections.get(target); if (pc) { pc.close(); peerConnections.delete(target); } if ($('remote-video').srcObject) $('remote-video').srcObject = null; toast('Disconnected locally for this demo. Production blocking must be enforced on the server.'); });
  $('leave-btn').addEventListener('click', () => { endCall(); socket.emit('leave-room'); room = null; selfId = null; members = []; workspace.classList.add('hidden'); joinPanel.classList.remove('hidden'); messages.replaceChildren(); });
  socket.on('peer-left', ({id}) => { const pc = peerConnections.get(id); if (pc) { pc.close(); peerConnections.delete(id); } if (currentPeer === id) { $('remote-video').srcObject = null; currentPeer = null; } });
  window.addEventListener('beforeunload', () => { endCall(); });
})();
