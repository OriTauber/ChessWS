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
                declareDraw(parsedMessage.roomId, parsedMessage.reason);
                break;
            case 'end':
                declareGameEnd(parsedMessage.roomId, parsedMessage.winner, parsedMessage.reason);
                break;
            case 'chat':
                handleChatMessages(parsedMessage.roomId, parsedMessage.message, parsedMessage.color)

        }
    });

    ws.on('close', () => {
        handleDisconnect(ws);
    });
});
function handleChatMessages(roomId, message, senderColor){
    const room = rooms[roomId];

    if (room) {
        const opponent = senderColor === 'w' ? room.black : room.white;
        const newMessage = `${senderColor === 'b' ? 'Black:' : 'White:'} ${message}`
        opponent.send(JSON.stringify({
            type: 'chat',
            message: newMessage
        }))
    }
}
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
function declareGameEnd(roomId, winner, reason = "") {
    const room = rooms[roomId];
    if (room) {
        room.white.send(JSON.stringify({ type: 'end', reason, winner }))
        room.black.send(JSON.stringify({ type: 'end', reason, winner }))
        console.log(`Game ended by ${reason ? reason : "Unknown"}! ${winner} wins!`)
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
        room.moves = [];
        room.movesSinceLastCaptureOrPawnMove = 0;
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
        declareGameEnd(roomId, currentTurn === 'w' ? 'b' : 'w', "time");
    }
}

function handleMove(ws, message) {
    const roomId = message.roomId;
    const room = rooms[roomId];

    if (room) {
        
        const opponentColor = room.turn === 'w' ? 'b' : 'w';
        const whiteMoved = room.turn === 'w';
        


        const moveMessage = {
            type: 'move',
            board: message.board,
            from: message.from,
            to: message.to,
            turn: opponentColor
        };

        if (room.white && room.black) {
            room.white.send(JSON.stringify({...moveMessage, notation: whiteMoved ? '' : message.notation}));
            room.black.send(JSON.stringify({ ...moveMessage, notation: whiteMoved ? message.notation : ''}));
            room.moves.push(message.board);
        }
        checkForDraws(roomId, message);
        // Restart the clock after a move
        clearInterval(room.interval);
    
        room.interval = setInterval(() => updateClock(roomId), 1000);
        room.turn = opponentColor;
    }
}
function checkForDraws(roomId, moveData) {
    const room = rooms[roomId];

    if (room) {
        if (moveData.piece[1] === 'p' || moveData.isCapture) {
            room.movesSinceLastCaptureOrPawnMove = 0;
            room.moves = []
            return;
        }
        room.movesSinceLastCaptureOrPawnMove = room.movesSinceLastCaptureOrPawnMove + 1;
        if (room.movesSinceLastCaptureOrPawnMove === 50) {
            declareDraw(roomId, "Fifty move rule");
            return;
        }
        for (let move of room.moves) {
            if (findAmountOfDuplicates(move, room.moves) >= 3) {
                declareDraw(roomId, "Threefold repetition");
                return;
            }
        }

    }
}
function findAmountOfDuplicates(element, list) {
    let matches = 0;
    for (let current of list) {
        if (compareArrays(element, current)) {
            matches++;
        }
    }
    return matches;
}
const compareArrays = (a, b) => {
    return JSON.stringify(a) === JSON.stringify(b);
};
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
