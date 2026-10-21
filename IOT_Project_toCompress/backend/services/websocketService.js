const { WebSocketServer } = require('ws');

let wss = null;

function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws/realtime' });

  wss.on('connection', (ws, req) => {
    console.log(`[WS] Client kết nối từ: ${req.socket.remoteAddress}`);

    ws.on('close', () => {
      console.log('[WS] Client đã ngắt kết nối');
    });

    ws.on('error', (err) => {
      console.error('[WS] Lỗi socket:', err.message);
    });
  });
}

function broadcastRealtime(payload) {
  if (!wss) return;
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

module.exports = { initWebSocket, broadcastRealtime };