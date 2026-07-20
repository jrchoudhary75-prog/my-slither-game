const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Socket.io initialization with WebSockets & Polling
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, 'public');

if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
}

app.get('/', (req, res) => {
    const htmlInPublic = path.join(publicPath, 'index.html');
    const htmlInRoot = path.join(__dirname, 'index.html');

    if (fs.existsSync(htmlInPublic)) res.sendFile(htmlInPublic);
    else if (fs.existsSync(htmlInRoot)) res.sendFile(htmlInRoot);
    else res.status(404).send('<h1>Error: index.html missing!</h1>');
});

// MAP CONSTANTS
const MAP_RADIUS = 4000;

// Connected Players Database
const players = {};

io.on('connection', (socket) => {
    console.log(`[+] Client Connected: ${socket.id}`);

    // Handle Player Join with complete initial size sync
    socket.on('joinMultiplayer', (data) => {
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDist = Math.random() * (MAP_RADIUS - 300);

        players[socket.id] = {
            id: socket.id,
            name: data.name || 'Player',
            skin: data.skin || 'Neon Stripe',
            x: Math.cos(randomAngle) * randomDist,
            y: Math.sin(randomAngle) * randomDist,
            angle: 0,
            score: data.score || 100,
            length: data.length || 45,
            radius: data.radius || 15
        };

        console.log(`[+] Arena Joined: ${players[socket.id].name} (${socket.id})`);
    });

    // Handle Realtime Movement, Size Sync, and Boundary Clamp
    socket.on('updatePlayer', (data) => {
        if (players[socket.id]) {
            let newX = data.x;
            let newY = data.y;

            // --- 4000px RADIUS BARRIER SERVER ENFORCEMENT ---
            const distFromCenter = Math.hypot(newX, newY);
            if (distFromCenter > MAP_RADIUS - 15) {
                const angle = Math.atan2(newY, newX);
                newX = Math.cos(angle) * (MAP_RADIUS - 15);
                newY = Math.sin(angle) * (MAP_RADIUS - 15);
            }

            // Sync updated state and exact player size
            players[socket.id].x = newX;
            players[socket.id].y = newY;
            players[socket.id].angle = data.angle;
            players[socket.id].score = data.score;
            players[socket.id].length = data.length || players[socket.id].length;
            players[socket.id].radius = data.radius || players[socket.id].radius;
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Client Disconnected: ${socket.id}`);
        delete players[socket.id];
    });
});

// Broadcast game state to all clients at 30 FPS
setInterval(() => {
    io.emit('gameStateUpdate', players);
}, 1000 / 30);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`🚀 Slither Pro Server Live!`);
    console.log(`🌐 Running on Port: ${PORT}`);
    console.log(`🗺️ Map Boundary: ${MAP_RADIUS}px Radius`);
    console.log(`=================================`);
});