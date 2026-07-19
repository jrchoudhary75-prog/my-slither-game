const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

let players = {};
let serverFoods = [];
const MAP_RADIUS = 2500;
const TOTAL_FOODS = 500;

function createServerFood() {
    return {
        id: Math.random().toString(36).substring(2, 9),
        x: (Math.random() - 0.5) * MAP_RADIUS * 1.6,
        y: (Math.random() - 0.5) * MAP_RADIUS * 1.6,
        color: `hsl(${Math.random() * 360}, 100%, 60%)`,
        radius: Math.random() * 2 + 5,
        value: 1
    };
}

for (let i = 0; i < TOTAL_FOODS; i++) {
    serverFoods.push(createServerFood());
}

// Server Game Loop (60 FPS)
setInterval(() => {
    // Exact Server Side Food Collision Detection to prevent ghost food
    for (let id in players) {
        let p = players[id];
        if (!p.body || p.body.length === 0) continue;
        
        let head = p.body[0];
        for (let i = serverFoods.length - 1; i >= 0; i--) {
            let f = serverFoods[i];
            let dist = Math.sqrt(Math.pow(head.x - f.x, 2) + Math.pow(head.y - f.y, 2));
            if (dist < p.currentRadius + f.radius) {
                p.score += f.value;
                p.length = 45 + Math.floor(p.score / 5); // 5 score = 1 segment
                serverFoods[i] = createServerFood(); // Replace instantly on server
            }
        }
    }

    io.emit('serverGameStateUpdate', { players: players, foods: serverFoods });
}, 1000 / 60);

io.on('connection', (socket) => {
    socket.on('joinMultiplayer', (data) => {
        let rx = (Math.random() - 0.5) * 800;
        let ry = (Math.random() - 0.5) * 800;
        players[socket.id] = {
            id: socket.id,
            name: data.name || "Guest",
            skin: data.skin || "Neon Stripe",
            x: rx, y: ry,
            angle: 0,
            score: 0,
            length: 45,
            currentRadius: 15,
            body: Array(45).fill({x: rx, y: ry}),
            isBoosting: false
        };
    });

    socket.on('updatePlayerMovement', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].body = data.body;
            players[socket.id].score = data.score;
            players[socket.id].length = data.length;
            players[socket.id].isBoosting = data.isBoosting;
        }
    });

    socket.on('playerExplodedDeath', () => {
        if (players[socket.id]) {
            players[socket.id].body.forEach((seg, index) => {
                if (index % 4 === 0) {
                    serverFoods.push({
                        id: Math.random().toString(36).substring(2, 9),
                        x: seg.x + (Math.random()-0.5)*15,
                        y: seg.y + (Math.random()-0.5)*15,
                        color: '#ff3355',
                        radius: 6, value: 1
                    });
                }
            });
            delete players[socket.id];
            socket.emit('forceClientGameOver');
        }
    });

    socket.on('disconnect', () => { delete players[socket.id]; });
});

http.listen(PORT, () => { console.log(`Server running on port: ${PORT}`); });