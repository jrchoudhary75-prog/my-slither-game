const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const axios = require('axios'); // Optional for real SMS Gateway

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// ✅ Fix "Cannot GET /": Serve all static files from root directory
app.use(express.static(path.join(__dirname)));

// Root route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const pendingOtps = {};

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Request Real OTP
    socket.on('request-otp', async ({ phone }) => {
        if (!phone || phone.length !== 10 || isNaN(phone)) {
            socket.emit('otp-sent-error', { message: "Invalid mobile number format!" });
            return;
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        pendingOtps[phone] = otp;

        console.log(`[OTP GENERATED] Phone: ${phone} | OTP: ${otp}`);

        try {
            /* 
               👇 REAL SMS GATEWAY INTEGRATION (Example with Fast2SMS)
               await axios.get(`https://www.fast2sms.com/dev/bulkV2`, {
                   params: {
                       authorization: "YOUR_FAST2SMS_API_KEY",
                       route: "otp",
                       variables_values: otp,
                       numbers: phone
                   }
               });
            */
            socket.emit('otp-sent-success');
        } catch (error) {
            console.error("SMS Gateway Error:", error);
            socket.emit('otp-sent-error', { message: "Failed to dispatch SMS." });
        }
    });

    // Verify OTP
    socket.on('verify-otp', ({ phone, otp }) => {
        if (pendingOtps[phone] && pendingOtps[phone] === otp) {
            delete pendingOtps[phone]; 
            socket.emit('otp-verification-success', { phone });
            console.log(`Phone verified successfully: ${phone}`);
        } else {
            socket.emit('otp-verification-failed');
        }
    });

    // Multiplayer Game Handlers
    socket.on('joinMultiplayer', (data) => {
        socket.data = data;
        socket.broadcast.emit('playerJoined', { id: socket.id, ...data });
    });

    socket.on('updatePlayer', (data) => {
        socket.broadcast.emit('gameStateUpdate', { [socket.id]: data });
    });

    socket.on('playerDied', () => {
        socket.broadcast.emit('gameStateUpdate', { [socket.id]: null });
    });

    socket.on('pingTest', () => {
        socket.emit('pongTest');
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        socket.broadcast.emit('gameStateUpdate', { [socket.id]: null });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});