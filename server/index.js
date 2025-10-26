import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

import { PORT } from './config.js';
import { findUserByEmail } from './users.js';
import { authenticateToken, authorizeRoles, generateToken } from './middleware/auth.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

app.use(express.json());
app.use(express.static(publicDir));

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await findUserByEmail(email);

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    return res.json({ token, role: user.role });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to process login' });
  }
});

app.get('/profile', authenticateToken, (req, res) => {
  return res.json({ id: req.user.id, email: req.user.email, role: req.user.role });
});

app.get('/master-only', authenticateToken, authorizeRoles('Master'), (req, res) => {
  return res.json({ message: 'Welcome, Master!' });
});

wss.on('connection', (socket) => {
  console.log('Client connected to WebSocket');
  socket.send(JSON.stringify({ type: 'welcome', message: 'Connected to ShrineVTT' }));

  socket.on('message', (message) => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    }
  });

  socket.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`ShrineVTT server listening on port ${PORT}`);
});
