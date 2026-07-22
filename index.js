const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios'); // Optional: real SMS API call ke liye

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const pendingOtps = {};

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Request Real OTP
    socket.on('request-otp', async ({ phone }) => {
        // Validate 10-digit phone format on server
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
               Aapko apni Fast2SMS API Key yahan daalni hogi:
               
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
            socket.emit('otp-sent-error', { message: "Failed to dispatch SMS. Check server configuration." });
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

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});