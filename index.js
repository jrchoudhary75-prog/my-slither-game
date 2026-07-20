const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Optimize Socket connection for low latency
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, 'public');

// Static assets serve
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
}

app.get('/', (req, res) => {
    const htmlInPublic = path.join(publicPath, 'index.html');
    const htmlInRoot = path.join(__dirname, 'index.html');

    if (fs.existsSync(htmlInPublic)) {
        res.sendFile(htmlInPublic);
    } else if (fs.existsSync(htmlInRoot)) {
        res.sendFile(htmlInRoot);
    } else {
        res.status(404).send('<h1>Error: index.html missing! Please check directory setup.</h1>');
    }
});

// Arena Grid Settings
const MAP_RADIUS = 6000; 
const CHUNK_SIZE = 1000; 

const players = {};

// Helper: Calculate Spatial Grid Chunk
function getChunkKey(x, y) {
    const chunkX = Math.floor((x + MAP_RADIUS) / CHUNK_SIZE);
    const chunkY = Math.floor((y + MAP_RADIUS) / CHUNK_SIZE);
    return `${chunkX}_${chunkY}`;
}

io.on('connection', (socket) => {
    console.log(`[+] New Connection: ${socket.id}`);

    socket.on('joinMultiplayer', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || 'Player',
            skin: data.skin || 'Neon Stripe',
            x: 0,
            y: 0,
            angle: 0,
            score: 100,
            body: [],
            chunkKey: getChunkKey(0, 0)
        };
        console.log(`[+] Player Entered Arena: ${players[socket.id].name} (${socket.id})`);
    });

    socket.on('updatePlayer', (data) => {
        const p = players[socket.id];
        if (p) {
            p.x = data.x;
            p.y = data.y;
            p.angle = data.angle;
            p.body = data.body;
            p.score = data.score;
            p.chunkKey = getChunkKey(data.x, data.y);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Player Disconnected: ${socket.id}`);
        delete players[socket.id];
    });
});

// Spatial Hashing Viewport Loop (30 Syncs/sec)
setInterval(() => {
    const socketIds = Object.keys(players);

    socketIds.forEach(id => {
        const p = players[id];
        const clientSocket = io.sockets.sockets.get(id);
        if (!clientSocket) return;

        const pChunkX = Math.floor((p.x + MAP_RADIUS) / CHUNK_SIZE);
        const pChunkY = Math.floor((p.y + MAP_RADIUS) / CHUNK_SIZE);

        const visiblePlayers = {};

        // Only sync nearby 9 chunks to save mobile & server performance
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const targetChunk = `${pChunkX + dx}_${pChunkY + dy}`;
                
                for (let otherId in players) {
                    if (players[otherId].chunkKey === targetChunk) {
                        visiblePlayers[otherId] = players[otherId];
                    }
                }
            }
        }

        clientSocket.emit('gameStateUpdate', visiblePlayers);
    });
}, 1000 / 30);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`🚀 Slither Pro Backend Engine Online`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`=================================`);
});