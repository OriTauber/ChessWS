const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

const rooms = {}; // Key: roomId, Value: { white: ws, black: ws, turn: 'w', time: { w: initialTime, b: initialTime }, interval: null }
const initialTime = 300; // 5 minutes in seconds

server.on('connection', (ws) => {
    ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message);

        switch (parsedMessage.type) {
            case 'join':
                handleJoin(ws, parsedMessage.roomId);
                break;
            case 'move':
                handleMove(ws, parsedMessage);
                break;
            case 'enpassant':
                handleEnpassant(ws, parsedMessage);
                break;
            case 'draw':
                declareDraw(parsedMessage.roomId, parsedMessage.reason)    
        }
    });

    ws.on('close', () => {
        handleDisconnect(ws);
    });
});
function handleEnpassant(ws, message) {
    const roomId = message.roomId;
    const room = rooms[roomId];

    if (room) {
        const opponent = message.point.color === 'w' ? room.black : room.white;

        opponent.send(JSON.stringify({
            type: 'enpassant',
            point: message.point
        }))
    }
}
function handleJoin(ws, roomId) {
    if (!rooms[roomId]) {
        rooms[roomId] = {
            white: ws,
            black: null,
            turn: 'w',
            time: { w: initialTime, b: initialTime },
            interval: null
        };
        ws.send(JSON.stringify({ type: 'data', color: 'w', roomId }));
        console.log("Player joined as white.");
    } else if (!rooms[roomId].black && rooms[roomId].white != ws) {
        rooms[roomId].black = ws;
        ws.send(JSON.stringify({ type: 'data', color: 'b', roomId }));
        console.log("Player joined as black.");
        startGame(roomId);
    }
}
function declareDraw(roomId, reason = "") {
    const room = rooms[roomId];
    if (room) {
        room.white.send(JSON.stringify({ type: 'draw', reason }))
        room.black.send(JSON.stringify({ type: 'draw', reason }))
        console.log("Game ended peacefully!")
        deleteRoom(roomId);
    }
}
function startGame(roomId) {
    const room = rooms[roomId];
    if (room.white && room.black) {
        console.log("Both players connected. Starting game.");
        room.white.send(JSON.stringify({ type: 'start' }));
        room.black.send(JSON.stringify({ type: 'start' }));
        room.started = true;
        room.interval = setInterval(() => updateClock(roomId), 1000);
    }
}

function updateClock(roomId) {
    const room = rooms[roomId];
    if (!room || !room.started) return;

    const currentTurn = room.turn;
    room.time[currentTurn] -= 1;

    // Send updated time to both players
    const timeMessage = JSON.stringify({
        type: 'time',
        time: room.time,
        color: currentTurn
    });

    room.white.send(timeMessage);
    room.black.send(timeMessage);

    // Check if time has run out
    if (room.time[currentTurn] <= 0) {
        clearInterval(room.interval);
        const endMessage = JSON.stringify({
            type: 'end',
            winner: currentTurn === 'w' ? 'b' : 'w'
        });
        room.white.send(endMessage);
        room.black.send(endMessage);
        rooms[roomId] = null;
    }
}

function handleMove(ws, message) {
    const roomId = message.roomId;
    const room = rooms[roomId];

    if (room) {
        const opponentColor = room.turn === 'w' ? 'b' : 'w';
        room.turn = opponentColor;

        const moveMessage = {
            type: 'move',
            board: message.board,
            from: message.from,
            to: message.to,
            turn: room.turn
        };
        console.log("MOPVEFVEefafew")
        if (room.white && room.black) {
            room.white.send(JSON.stringify(moveMessage));
            room.black.send(JSON.stringify(moveMessage));
        }

        // Restart the clock after a move
        clearInterval(room.interval);
        room.interval = setInterval(() => updateClock(roomId), 1000);
    }
}

function handleDisconnect(ws) {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room.white && room.black && room.white === ws || room.black === ws) {
            deleteRoom(roomId)
            console.log(`Player(s) disconnected. Room ${roomId} closed.`);
            break;
        }
    }
}

function getPlayerColor(ws, room) {
    if (!room) return null;
    if (ws === room.white) return 'w';
    if (ws === room.black) return 'b';
    return null;
}
function deleteRoom(roomId) {
    const room = rooms[roomId];
    if (room) {
        clearInterval(room.interval);
        delete rooms[roomId];
    }
}
