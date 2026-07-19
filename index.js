const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

let players = {};
let serverFoods = [];
let serverBots = [];
const MAP_RADIUS = 3000;
const TOTAL_FOODS = 600;
const TOTAL_BOTS = 15; // Balanced Multiplayer Bots

const skins = ['Neon Stripe', 'Cosmic Polka', 'Magma Flow', 'Cyber Grid', 'Glow Phantom', 'Void Nebula', 'Rainbow Pulse'];

function createServerFood() {
    return {
        id: Math.random().toString(36).substring(2, 9),
        x: (Math.random() - 0.5) * MAP_RADIUS * 1.6,
        y: (Math.random() - 0.5) * MAP_RADIUS * 1.6,
        color: `hsl(${Math.random() * 360},100%, 65%)`,
        maxRadius: Math.random() * 2 + 4, 
        value: 1 // 1 Food = 1 Score
    };
}

for (let i = 0; i < TOTAL_FOODS; i++) {
    serverFoods.push(createServerFood());
}

// Generate Global Bots on Server
for (let i = 0; i < TOTAL_BOTS; i++) {
    let rx = (Math.random() - 0.5) * MAP_RADIUS;
    let ry = (Math.random() - 0.5) * MAP_RADIUS;
    serverBots.push({
        id: "server_bot_" + i,
        name: "AI_Bot_" + Math.floor(Math.random() * 900),
        x: rx, y: ry,
        angle: Math.random() * Math.PI * 2,
        targetAngle: Math.random() * Math.PI * 2,
        changeDirTimer: Math.floor(Math.random() * 60) + 20,
        skin: skins[Math.floor(Math.random() * skins.length)],
        score: 0, 
        length: 45,
        body: Array(45).fill({ x: rx, y: ry }),
        currentRadius: 15,
        speed: 3.0,
        maxTurnSpeed: 0.07
    });
}

// Server Physics Loop
setInterval(() => {
    // Move Bots
    serverBots.forEach(b => {
        b.changeDirTimer--;
        if (b.changeDirTimer <= 0) {
            let closeFood = null; let minDist = 300;
            serverFoods.forEach(f => {
                let fD = Math.sqrt(Math.pow(f.x - b.x, 2) + Math.pow(f.y - b.y, 2));
                if (fD < minDist) { minDist = fD; closeFood = f; }
            });
            if (closeFood) {
                b.targetAngle = Math.atan2(closeFood.y - b.y, closeFood.x - b.x);
            } else {
                b.targetAngle = Math.random() * Math.PI * 2;
            }
            b.changeDirTimer = Math.floor(Math.random() * 80) + 40;
        }

        let bAngleDiff = b.targetAngle - b.angle;
        while (bAngleDiff < -Math.PI) bAngleDiff += Math.PI * 2;
        while (bAngleDiff > Math.PI) bAngleDiff -= Math.PI * 2;
        b.angle += Math.max(-b.maxTurnSpeed, Math.min(b.maxTurnSpeed, bAngleDiff));

        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;

        // Bot body follow logic
        let spacing = 6;
        let head = { x: b.x, y: b.y };
        b.body.unshift(head);
        if (b.body.length > b.length) {
            b.body.pop();
        }

        // Bot eats food
        for (let i = serverFoods.length - 1; i >= 0; i--) {
            let f = serverFoods[i];
            let dist = Math.sqrt(Math.pow(b.x - f.x, 2) + Math.pow(b.y - f.y, 2));
            if (dist < b.currentRadius + 6) {
                b.score += f.value;
                b.length = 45 + Math.floor(b.score / 5); // 5 score = 1 segment
                serverFoods[i] = createServerFood();
            }
        }
    });

    // Bot-to-Bot Collision System Check
    for (let i = serverBots.length - 1; i >= 0; i--) {
        let b1 = serverBots[i];
        let botExploded = false;

        for (let k = 0; k < serverBots.length; k++) {
            if (i === k) continue; 
            let b2 = serverBots[k];

            for (let j = 3; j < b2.body.length; j++) {
                if(!b2.body[j]) continue;
                let dist = Math.sqrt(Math.pow(b1.x - b2.body[j].x, 2) + Math.pow(b1.y - b2.body[j].y, 2));
                if (dist < b1.currentRadius + 10) {
                    botExploded = true;
                    break;
                }
            }
            if (botExploded) break;
        }

        if (botExploded) {
            b1.body.forEach((seg, idx) => {
                if (idx % 4 === 0) {
                    serverFoods.push({
                        id: Math.random().toString(36).substring(2, 9),
                        x: seg.x + (Math.random() - 0.5) * 15,
                        y: seg.y + (Math.random() - 0.5) * 15,
                        color: '#00ffaa',
                        maxRadius: 5, value: 1
                    });
                }
            });
            
            let rx = (Math.random() - 0.5) * MAP_RADIUS;
            let ry = (Math.random() - 0.5) * MAP_RADIUS;
            serverBots[i] = {
                id: "server_bot_" + i,
                name: "AI_Bot_" + Math.floor(Math.random() * 900),
                x: rx, y: ry,
                angle: Math.random() * Math.PI * 2,
                targetAngle: Math.random() * Math.PI * 2,
                changeDirTimer: 80,
                skin: skins[Math.floor(Math.random() * skins.length)],
                score: 0, length: 45,
                body: Array(45).fill({ x: rx, y: ry }),
                currentRadius: 15, speed: 3.0, maxTurnSpeed: 0.07
            };
        }
    }

    io.emit('serverGameStateUpdate', {
        players: players,
        foods: serverFoods,
        bots: serverBots
    });
}, 1000 / 60);

io.on('connection', (socket) => {
    socket.on('joinMultiplayer', (data) => {
        let rx = (Math.random() - 0.5) * 1000;
        let ry = (Math.random() - 0.5) * 1000;
        players[socket.id] = {
            id: socket.id,
            name: data.name || "Guest_" + Math.floor(Math.random()*90),
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

    socket.on('foodEatenIndex', (foodId) => {
        let fIdx = serverFoods.findIndex(f => f.id === foodId);
        if(fIdx !== -1) {
            serverFoods[fIdx] = createServerFood();
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
                        maxRadius: 5, value: 1
                    });
                }
            });
            delete players[socket.id];
            socket.emit('forceClientGameOver');
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

http.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
});