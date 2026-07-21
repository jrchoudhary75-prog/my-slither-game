const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const Razorpay = require('razorpay');

const app = express();
const server = http.createServer(app);

app.use(express.json()); // JSON parsing ke liye

// Low-latency socket initialization
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket'],
    perMessageDeflate: false
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
    else res.status(404).send('<h1>Error: index.html not found!</h1>');
});

// 💳 RAZORPAY PAYMENT GATEWAY SETUP
// Key Dashboard se lekar yahan replace karein
const razorpay = new Razorpay({
    key_id: 'rzp_test_YOUR_KEY_HERE', // Put your Razorpay Key ID
    key_secret: 'YOUR_SECRET_HERE'     // Put your Razorpay Key Secret
});

// Create Payment Order Route
app.post('/api/create-order', async (req, res) => {
    try {
        const { itemId, price } = req.body;
        const options = {
            amount: price * 100, // Amount in Paise (e.g., Rs 49 = 4900 paise)
            currency: "INR",
            receipt: `order_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Verify Payment Route
app.post('/api/verify-payment', (req, res) => {
    const { razorpay_payment_id, itemId } = req.body;
    if (razorpay_payment_id) {
        res.json({ success: true, message: "Purchase Successful!", itemId });
    } else {
        res.status(400).json({ success: false, message: "Payment Failed" });
    }
});

const MAP_RADIUS = 4000;
const players = {};

io.on('connection', (socket) => {
    socket.on('pingTest', () => socket.emit('pongTest'));

    socket.on('joinMultiplayer', (data) => {
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDist = Math.random() * (MAP_RADIUS - 400);

        players[socket.id] = {
            id: socket.id,
            name: data.name || 'Player',
            skin: data.skin || 'Neon Stripe',
            region: data.region || 'Asia / India',
            x: Math.cos(randomAngle) * randomDist,
            y: Math.sin(randomAngle) * randomDist,
            angle: 0, score: data.score || 100, length: data.length || 45, radius: data.radius || 15,
            isBoosting: false
        };
    });

    socket.on('updatePlayer', (data) => {
        if (players[socket.id]) {
            let newX = data.x, newY = data.y;
            const distFromCenter = Math.hypot(newX, newY);
            if (distFromCenter > MAP_RADIUS - 15) {
                const angle = Math.atan2(newY, newX);
                newX = Math.cos(angle) * (MAP_RADIUS - 15);
                newY = Math.sin(angle) * (MAP_RADIUS - 15);
            }
            players[socket.id].x = newX;
            players[socket.id].y = newY;
            players[socket.id].angle = data.angle;
            players[socket.id].score = data.score;
            players[socket.id].length = data.length || players[socket.id].length;
            players[socket.id].radius = data.radius || players[socket.id].radius;
            players[socket.id].isBoosting = data.isBoosting || false;
        }
    });

    socket.on('playerDied', () => { delete players[socket.id]; });
    socket.on('disconnect', () => { delete players[socket.id]; });
});

setInterval(() => {
    io.volatile.emit('gameStateUpdate', { players: players });
}, 1000 / 30);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🔥 Slither Server with IAP Live on Port: ${PORT}`);
    console.log(`====================================================`);
});