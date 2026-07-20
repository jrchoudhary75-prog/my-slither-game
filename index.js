const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with WebSocket and Polling fallbacks for mobile support
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, 'public');

// Serve static assets from 'public' folder if present
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
}

// Fallback Route Handler
app.get('/', (req, res) => {
    const htmlInPublic = path.join(publicPath, 'index.html');
    const htmlInRoot = path.join(__dirname, 'index.html');

    if (fs.existsSync(htmlInPublic)) {
        res.sendFile(htmlInPublic);
    } else if (fs.existsSync(htmlInRoot)) {
        res.sendFile(htmlInRoot);
    } else {
        res.status(404).send('<h1>Error: index.html file not found! Place index.html inside root or public/ folder.</h1>');
    }
});

// Store connected multiplayer players
const players = {};

io.on('connection', (socket) => {
    console.log(`[+] New Client Connected: ${socket.id}`);

    // Handle Player Join
    socket.on('joinMultiplayer', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || 'Player',
            skin: data.skin || 'Neon Stripe',
            x: (Math.random() - 0.5) * 2000,
            y: (Math.random() - 0.5) * 2000,
            angle: 0,
            score: 100
        };
        console.log(`[+] Arena Joined: ${players[socket.id].name} (${socket.id})`);
    });

    // Handle Realtime Movement and Score Updates
    socket.on('updatePlayer', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].score = data.score;
        }
    });

    // Handle Disconnect
    socket.on('disconnect', () => {
        console.log(`[-] Client Disconnected: ${socket.id}`);
        delete players[socket.id];
    });
});

// Broadcast game state to all connected clients at 30 FPS
setInterval(() => {
    io.emit('gameStateUpdate', players);
}, 1000 / 30);

// Start Server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`🚀 Slither Pro Backend Live!`);
    console.log(`🌐 Server Running On Port: ${PORT}`);
    console.log(`=================================`);
});