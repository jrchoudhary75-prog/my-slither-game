const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Socket.io with CORS & Transports (Render production ke liye safe)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// Render dynamic port provide karta hai process.env.PORT se
const PORT = process.env.PORT || 3000;

// Path Setup: Static files ke liye
const publicPath = path.join(__dirname, 'public');

// Static files serve karein agar 'public' folder ho
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
}

// Main route handler: Chahe HTML file root par ho ya 'public/' folder mein, auto-detect kar lega
app.get('/', (req, res) => {
    const htmlInPublic = path.join(publicPath, 'index.html');
    const htmlInRoot = path.join(__dirname, 'index.html');

    if (fs.existsSync(htmlInPublic)) {
        res.sendFile(htmlInPublic);
    } else if (fs.existsSync(htmlInRoot)) {
        res.sendFile(htmlInRoot);
    } else {
        res.status(404).send('<h1>Error: index.html file nahi mili! Check project folder structure.</h1>');
    }
});

// Multiplayer players memory store
const players = {};

io.on('connection', (socket) => {
    console.log(`[+] Player Joined: ${socket.id}`);

    // Jab player multiplayer mode select karke enter kare
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
        console.log(`[+] Arena Active: ${players[socket.id].name} (${socket.id})`);
    });

    // Player Movement & Body Sync Update
    socket.on('updatePlayer', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].body = data.body;
            players[socket.id].score = data.score;
        }
    });

    // Handle Disconnect
    socket.on('disconnect', () => {
        console.log(`[-] Player Left: ${socket.id}`);
        delete players[socket.id];
    });
});

// Game State Broadcast Loop (30 FPS Sync)
setInterval(() => {
    io.emit('gameStateUpdate', players);
}, 1000 / 30);

// Host on 0.0.0.0 (Important for Render hosting)
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`🚀 Slither Pro Server is Live!`);
    console.log(`🌐 Running on Port: ${PORT}`);
    console.log(`=================================`);
});