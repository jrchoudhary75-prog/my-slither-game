const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static HTML file
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store all active players in multiplayer mode
const players = {};

io.on('connection', (socket) => {
    console.log(`[+] New Player Connected: ${socket.id}`);

    // When a player joins multiplayer arena
    socket.on('joinMultiplayer', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || 'Player',
            skin: data.skin || 'Neon Stripe',
            x: 0,
            y: 0,
            angle: 0,
            score: 100,
            body: []
        };
        console.log(`[+] Player Joined Arena: ${players[socket.id].name} (${socket.id})`);
    });

    // Receive player position & body updates from client
    socket.on('updatePlayer', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].body = data.body;
            players[socket.id].score = data.score;
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`[-] Player Disconnected: ${socket.id}`);
        delete players[socket.id];
    });
});

// Broadcast game state to all connected clients 30 times per second (30 FPS sync)
setInterval(() => {
    io.emit('gameStateUpdate', players);
}, 1000 / 30);

server.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Slither Pro Server Running!`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`=================================`);
});