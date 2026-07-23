const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (like index.html) from the root directory
app.use(express.static(__dirname));

const players = {};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Handle latency ping test from client
    socket.on('pingTest', () => {
        socket.emit('pongTest');
    });

    // Handle player joining the multiplayer arena
    socket.on('joinMultiplayer', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || "Player",
            skin: data.skin || "Neon Stripe",
            x: 0,
            y: 0,
            angle: 0,
            score: data.score || 100,
            length: data.length || 45,
            radius: data.radius || 15,
            isBoosting: false,
            region: data.region || 'Asia / India'
        };
    });

    // Handle real-time player movement and state updates
    socket.on('updatePlayer', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].score = data.score;
            players[socket.id].length = data.length;
            players[socket.id].radius = data.radius;
            players[socket.id].isBoosting = data.isBoosting;
        }
    });

    // Handle player death event
    socket.on('playerDied', () => {
        if (players[socket.id]) {
            delete players[socket.id];
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
    });
});

// Broadcast game state to all connected clients every 30ms (~33 updates per second)
setInterval(() => {
    io.emit('gameStateUpdate', { players });
}, 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Slither Pro Server is running on http://localhost:${PORT}`);
});