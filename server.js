const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Static files server
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ⚠️ YAHAN APNA EMAIL AUR APP PASSWORD DABAYEIN ⚠️
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'jrchoudhary75@gmail.com',         // <-- Yahan apna real Gmail likhein
        pass: 'xzuq zrmr uvkc qhyu'           // <-- Yahan 16-digit ka App Password likhein
    }
});

const pendingOtps = {};

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Request Email OTP
    socket.on('request-otp', async ({ email }) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            socket.emit('otp-sent-error', { message: "Invalid email format!" });
            return;
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        pendingOtps[email] = otp;

        console.log(`[OTP GENERATED] Email: ${email} | OTP: ${otp}`);

        try {
            await transporter.sendMail({
                from: '"Slither Pro Game" <YOUR_EMAIL@gmail.com>', // Yahan bhi apna Email likhein
                to: email,
                subject: "Your Slither Pro Verification OTP",
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #0f0f1a; color: #ffffff; border-radius: 10px;">
                        <h2 style="color: #00ffaa; text-align: center;">Welcome to Slither Pro!</h2>
                        <p style="font-size: 15px; text-align: center;">Your 6-digit verification OTP code is:</p>
                        <div style="text-align: center; margin: 20px 0;">
                            <span style="color: #0088ff; font-size: 32px; font-weight: bold; letter-spacing: 6px; background: #1a1a2e; padding: 10px 25px; border-radius: 8px; border: 1px solid #00ffaa;">${otp}</span>
                        </div>
                        <p style="color: #8a8a9e; font-size: 13px; text-align: center;">This code is valid for 10 minutes. Please do not share it with anyone.</p>
                    </div>
                `
            });
            socket.emit('otp-sent-success');
        } catch (error) {
            console.error("Email Gateway Error:", error);
            socket.emit('otp-sent-error', { message: "Failed to send email. Check credentials." });
        }
    });

    // Verify OTP
    socket.on('verify-otp', ({ email, otp }) => {
        if (pendingOtps[email] && pendingOtps[email] === otp) {
            delete pendingOtps[email];
            socket.emit('otp-verification-success', { email });
            console.log(`Email verified successfully: ${email}`);
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