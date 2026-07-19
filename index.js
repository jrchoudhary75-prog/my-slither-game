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
const TOTAL_BOTS = 20;

const skins = ['Neon Stripe', 'Cosmic Polka', 'Magma Flow', 'Cyber Grid', 'Glow Phantom', 'Void Nebula', 'Rainbow Pulse'];

// Initialize Global Foods on Server Start
function createServerFood() {
    return {
        id: Math.random().toString(36).substring(2, 9),
        x: (Math.random() - 0.5) * MAP_RADIUS * 1.6,
        y: (Math.random() - 0.5) * MAP_RADIUS * 1.6,
        color: `hsl(${Math.random() * 360},100%, 65%)`,
        maxRadius: Math.random() * 2 + 4, 
        value: 1 // FIX 2: Per food strictly 1 score
    };
}

for (let i = 0; i < TOTAL_FOODS; i++) {
    serverFoods.push(createServerFood());
}

// Initialize Global Background Bots
for (let i = 0; i < TOTAL_BOTS; i++) {
    let rx = (Math.random() - 0.5) * MAP_RADIUS * 1.5;
    let ry = (Math.random() - 0.5) * MAP_RADIUS * 1.5;
    let bBody = Array(45).fill({ x: rx, y: ry });
    serverBots.push({
        id: "server_bot_" + i,
        name: "AI_Bot_" + Math.floor(Math.random() * 900),
        x: rx, y: ry,
        angle: Math.random() * Math.PI * 2,
        targetAngle: Math.random() * Math.PI * 2,
        changeDirTimer: Math.floor(Math.random() * 60),
        skin: skins[Math.floor(Math.random() * skins.length)],
        score: 0, 
        length: 45,
        body: bBody,
        currentRadius: 15,
        speed: 3.0,
        maxTurnSpeed: 0.07
    });
}

// Dedicated Server Physics Loop
setInterval(() => {
    // Move AI Bots
    serverBots.forEach(b => {
        b.changeDirTimer--;
        if (b.changeDirTimer <= 0 || Math.random() < 0.02) {
            let closeFood = null; let minDist = 400;
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

        let spacing = 6;
        let head = { x: b.x, y: b.y };
        b.body[0] = head;
        for (let j = 1; j < b.body.length; j++) {
            let bdx = b.body[j].x - b.body[j-1].x;
            let bdy = b.body[j].y - b.body[j-1].y;
            let bdist = Math.sqrt(bdx*bdx + bdy*bdy);
            if (bdist > spacing && bdist > 0) {
                b.body[j].x = b.body[j-1].x + (bdx / bdist) * spacing;
                b.body[j].y = b.body[j-1].y + (bdy / bdist) * spacing;
            }
        }

        // Server side Food Eating for Bots
        for (let i = serverFoods.length - 1; i >= 0; i--) {
            let f = serverFoods[i];
            let dist = Math.sqrt(Math.pow(b.x - f.x, 2) + Math.pow(b.y - f.y, 2));
            if (dist < b.currentRadius + 6) {
                b.score += f.value;
                b.length = 45 + Math.floor(b.score / 5); // FIX 2: 5 score = 1 segment
                while(b.body.length < b.length) b.body.push({x: b.body[b.body.length-1].x, y: b.body[b.body.length-1].y});
                serverFoods[i] = createServerFood();
            }
        }
    });

    // FIX 1: Bot-to-Bot Collision System Check
    for (let i = serverBots.length - 1; i >= 0; i--) {
        let b1 = serverBots[i];
        let botExploded = false;

        for (let k = 0; k < serverBots.length; k++) {
            if (i === k) continue; // khud se collide nahi hona
            let b2 = serverBots[k];

            for (let j = 2; j < b2.body.length; j++) {
                let dist = Math.sqrt(Math.pow(b1.x - b2.body[j].x, 2) + Math.pow(b1.y - b2.body[j].y, 2));
                if (dist < b1.currentRadius + b2.currentRadius - 4) {
                    botExploded = true;
                    break;
                }
            }
            if (botExploded) break;
        }

        if (botExploded) {
            // Turn dead bot into food
            b1.body.forEach((seg, idx) => {
                if (idx % 3 === 0) {
                    serverFoods.push({
                        id: Math.random().toString(36).substring(2, 9),
                        x: seg.x + (Math.random() - 0.5) * 15,
                        y: seg.y + (Math.random() - 0.5) * 15,
                        color: '#00ffaa',
                        maxRadius: 6, value: 1
                    });
                }
            });
            
            // Respawn Bot instantly at random place
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
        let rx = (Math.random() - 0.5) * 1500;
        let ry = (Math.random() - 0.5) * 1500;
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

    socket.on('playerExplodedDeath', (data) => {
        if (players[socket.id]) {
            players[socket.id].body.forEach((seg, index) => {
                if (index % 3 === 0) {
                    serverFoods.push({
                        id: Math.random().toString(36).substring(2, 9),
                        x: seg.x + (Math.random()-0.5)*15,
                        y: seg.y + (Math.random()-0.5)*15,
                        color: '#ff3355',
                        maxRadius: 6, value: 1
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