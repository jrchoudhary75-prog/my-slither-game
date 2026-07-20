const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

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

const players = {};

io.on('connection', (socket) => {
    console.log(`[+] Connected: ${socket.id}`);

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
        console.log(`[+] Arena Joined: ${players[socket.id].name} (${socket.id})`);
    });

    socket.on('updatePlayer', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].body = data.body;
            players[socket.id].score = data.score;
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Disconnected: ${socket.id}`);
        delete players[socket.id];
    });
});

// Broadcast state continuously (30 Ticks/sec)
setInterval(() => {
    io.emit('gameStateUpdate', players);
}, 1000 / 30);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`🚀 Slither Pro Smooth Cluster Live!`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`=================================`);
});