const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Socket.io initialization with high-performance real-time flags
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    },
    transports: ['websocket'],
    perMessageDeflate: false
});

const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, 'public');

// Serve static assets from 'public' directory if it exists
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
}

// Serve index.html as the primary entry point
app.get('/', (req, res) => {
    const htmlInPublic = path.join(publicPath, 'index.html');
    const htmlInRoot = path.join(__dirname, 'index.html');

    if (fs.existsSync(htmlInPublic)) {
        res.sendFile(htmlInPublic);
    } else if (fs.existsSync(htmlInRoot)) {
        res.sendFile(htmlInRoot);
    } else {
        res.status(404).send('<h1>Error: index.html file not found!</h1>');
    }
});

const MAP_RADIUS = 4000;
const players = {};

// Socket.io Connection & Event Handling
io.on('connection', (socket) => {

    // Ping-Pong handler for ping measurement
    socket.on('pingTest', () => {
        socket.emit('pongTest');
    });

    // Handle Player Joining Multiplayer Session
    socket.on('joinMultiplayer', (data) => {
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDist = Math.random() * (MAP_RADIUS - 400);

        players[socket.id] = {
            id: socket.id,
            name: data.name || 'Player',
            skin: data.skin || 'Neon Stripe',
            region: data.region || 'Asia / India',
            x: Math.cos(randomAngle) * randomDist,
            y: Math.sin(randomAngle) * randomDist,
            angle: 0,
            score: data.score || 100,
            length: data.length || 45,
            radius: data.radius || 15,
            isBoosting: false
        };
    });

    // Handle Real-Time Position & Movement Sync
    socket.on('updatePlayer', (data) => {
        if (players[socket.id]) {
            let newX = data.x;
            let newY = data.y;

            // Strict Server-Side Map Barrier Check
            const distFromCenter = Math.hypot(newX, newY);
            if (distFromCenter > MAP_RADIUS - 15) {
                const angle = Math.atan2(newY, newX);
                newX = Math.cos(angle) * (MAP_RADIUS - 15);
                newY = Math.sin(angle) * (MAP_RADIUS - 15);
            }

            players[socket.id].x = newX;
            players[socket.id].y = newY;
            players[socket.id].angle = data.angle;
            players[socket.id].score = data.score;
            players[socket.id].length = data.length || players[socket.id].length;
            players[socket.id].radius = data.radius || players[socket.id].radius;
            players[socket.id].isBoosting = data.isBoosting || false;
        }
    });

    // Handle Player Elimination / Disconnects
    socket.on('playerDied', () => {
        if (players[socket.id]) {
            delete players[socket.id];
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// Broadcast Real-time Game State Updates to all clients (30 Updates per Second)
setInterval(() => {
    io.volatile.emit('gameStateUpdate', { players: players });
}, 1000 / 30);

// Start the Slither Server Engine
server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 Slither Engine Server Active on Port: ${PORT}`);
    console.log(`🌐 Local Web Interface: http://localhost:${PORT}`);
    console.log(`====================================================`);
});