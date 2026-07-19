const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

// Public directory se static HTML, CSS aur JS files serve karega
app.use(express.static(path.join(__dirname, 'public')));

// Default entry point
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Multiplayer Arena mein connect hue saare active players ka registry object
let activePlayers = {};

io.on('connection', (socket) => {
    console.log(`> [CONNECT] New player connected: ${socket.id}`);

    // Jab player multiplayer mode select karke spawn hota hai
    socket.on('joinMultiplayer', (playerData) => {
        activePlayers[socket.id] = {
            id: socket.id,
            name: playerData.name || "Slither_Guest",
            skin: playerData.skin || "Neon Stripe",
            x: 0,
            y: 0,
            angle: 0,
            body: [],
            score: 100,
            length: 45,
            targetLength: 45
        };
        console.log(`> [SPAWN] Player Joined Arena: ${activePlayers[socket.id].name} (${socket.id})`);
    });

    // Client side se per-frame position aur body movement sync receive karna
    socket.on('updatePlayer', (data) => {
        if (activePlayers[socket.id]) {
            activePlayers[socket.id].x = data.x;
            activePlayers[socket.id].y = data.y;
            activePlayers[socket.id].angle = data.angle;
            activePlayers[socket.id].body = data.body;
            activePlayers[socket.id].score = data.score;
            if (data.targetLength) {
                activePlayers[socket.id].targetLength = data.targetLength;
            }
        }
    });

    // Disconnect event handler
    socket.on('disconnect', () => {
        if (activePlayers[socket.id]) {
            console.log(`> [DISCONNECT] Player Left: ${activePlayers[socket.id].name}`);
            delete activePlayers[socket.id];
        } else {
            console.log(`> [DISCONNECT] Connection closed: ${socket.id}`);
        }
    });
});

// 60 FPS (approx 16.6ms) frequency par arena ke sabhi clients ko state broad-cast karna
setInterval(() => {
    io.emit('gameStateUpdate', activePlayers);
}, 1000 / 60);

// HTTP Server start
http.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🚀 SLITHER PRO SERVER ONLINE ON PORT: ${PORT}`);
    console.log(`🔗 Local Address: http://localhost:${PORT}`);
    console.log(`=============================================`);
});