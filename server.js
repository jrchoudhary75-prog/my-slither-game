const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Directly serve the assetlinks.json content without needing any physical folder
app.get('/.well-known/assetlinks.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send([
      {
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
          "namespace": "android_app",
          "package_name": "com.onrender.my_slither_game.twa",
          "sha256_cert_fingerprints": ["3C:D8:69:42:52:62:A2:4A:8A:82:25:19:33:23:E6:9F:8E:9D:7F:94:76:5C:C3:90:0C:09:16:37:71:C1:3D:73"]
        }
      }
    ]);
});

// Serve static files from the root directory
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

    // Handle player requesting a revive after watching an AdMob rewarded ad
    socket.on('requestRevive', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || "Player",
            skin: data.skin || "Neon Stripe",
            x: Math.random() * 800 - 400, 
            y: Math.random() * 800 - 400,
            angle: 0,
            score: data.score || 100,
            length: data.length || 45,
            radius: data.radius || 15,
            isBoosting: false,
            region: 'Asia / India'
        };
        console.log(`Player successfully revived via AdMob: ${socket.id}`);
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