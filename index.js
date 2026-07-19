const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('Ek naya khiladi jud gaya: ' + socket.id);
});

http.listen(3000, () => {
    console.log('Server chal raha hai http://localhost:3000 par');
});