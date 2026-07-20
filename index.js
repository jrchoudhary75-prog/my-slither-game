const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Low-latency Socket.io setup
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

// Serve static files from public directory
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
}

// Route for main entry point
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

// Real-time WebSockets logic
io.on('connection', (socket) => {
    
    // Ping/Latency Test Handler
    socket.on('pingTest', () => {
        socket.emit('pongTest');
    });

    // Handle Player Joining Multiplayer Mode
    socket.on('joinMultiplayer', (data) => {
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDist = Math.random() * (MAP_RADIUS - 500);

        players[socket.id] = {
            id: socket.id,
            name: data.name || 'ProPlayer',
            skin: data.skin || 'Neon',
            x: Math.cos(randomAngle) * randomDist,
            y: Math.sin(randomAngle) * randomDist,
            angle: 0,
            score: data.score || 100,
            length: data.length || 40,
            radius: data.radius || 14,
            isBoosting: false
        };
    });

    // Real-time Movement & Angle Sync Engine
    socket.on('updatePlayer', (data) => {
        if (players[socket.id]) {
            let newX = data.x;
            let newY = data.y;

            // Boundary Constraint Check (Server-Side Safety)
            const distFromCenter = Math.hypot(newX, newY);
            if (distFromCenter > MAP_RADIUS - 20) {
                const angle = Math.atan2(newY, newX);
                newX = Math.cos(angle) * (MAP_RADIUS - 20);
                newY = Math.sin(angle) * (MAP_RADIUS - 20);
            }

            players[socket.id].x = newX;
            players[socket.id].y = newY;
            players[socket.id].angle = data.angle;
            players[socket.id].score = data.score;
            players[socket.id].length = data.length || players[socket.id].length;
            players[socket.id].isBoosting = data.isBoosting || false;
        }
    });

    // Death / Collision Cleanup Event
    socket.on('playerDied', () => {
        if (players[socket.id]) {
            delete players[socket.id];
        }
    });

    // Disconnect Event Handler
    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// Broadcast game state to connected clients (30 updates per second)
setInterval(() => {
    io.volatile.emit('gameStateUpdate', { players: players });
}, 1000 / 30);

// Start High-Performance HTTP & Socket Server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 Slither Engine Running on Port: ${PORT}`);
    console.log(`🌐 Local Link: http://localhost:${PORT}`);
    console.log(`====================================================`);
});