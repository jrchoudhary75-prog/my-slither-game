const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

// Static files (HTML, CSS, JS) serve karne ke liye
app.use(express.static(path.join(__dirname, 'public')));

// Default route jo index.html loading sambhalega
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Real-time arena mein connected sabhi active players ka data
let activePlayers = {};

io.on('connection', (socket) => {
    console.log(`> Node Connection Established: ${socket.id}`);

    // Jab koi player multiplayer lobby se arena mein enter karega
    socket.on('joinMultiplayer', (playerData) => {
        activePlayers[socket.id] = {
            id: socket.id,
            name: playerData.name || "Slither_Guest",
            skin: playerData.skin || "Neon Stripe",
            x: 0,
            y: 0,
            angle: 0,
            body: [],
            score: 100
        };
        console.log(`> Player Spawned in Arena: ${activePlayers[socket.id].name} (${socket.id})`);
    });

    // Har frame par player ki badli hui position aur nodes ka sync data
    socket.on('updatePlayer', (data) => {
        if (activePlayers[socket.id]) {
            activePlayers[socket.id].x = data.x;
            activePlayers[socket.id].y = data.y;
            activePlayers[socket.id].angle = data.angle;
            activePlayers[socket.id].body = data.body;
            activePlayers[socket.id].score = data.score;
        }
    });

    // Jab player disconnect ho ya game leave kare
    socket.on('disconnect', () => {
        if (activePlayers[socket.id]) {
            console.log(`> Player Left Arena: ${activePlayers[socket.id].name}`);
            delete activePlayers[socket.id];
        }
        console.log(`> Connection Terminated: ${socket.id}`);
    });
});

// Sabhi connected clients ko 60FPS tick-rate par game state updates bhejna
setInterval(() => {
    io.emit('gameStateUpdate', activePlayers);
}, 1000 / 60);

// Server initialization listener
http.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🚀 SLITHER PRO SERVER ONLINE ON PORT: ${PORT}`);
    console.log(`🔗 Local Gateway: http://localhost:${PORT}`);
    console.log(`=============================================`);
});