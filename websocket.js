const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

const rooms = {}; // Key: roomId, Value: { white: ws, black: ws, turn: 'w' }
const moveQueue = {}; // Key: roomId, Value: array of moves

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
        }
    });
});

function handleJoin(ws, roomId) {
    if (!rooms[roomId]) {

        rooms[roomId] = { white: ws, black: null, turn: 'w' };
        ws.send(JSON.stringify({ type: 'data', color: 'w', roomId }));
        console.log("Player joined as white.");
        checkStartGame(roomId);

    } else if (!rooms[roomId].black) {
        rooms[roomId].black = ws;
        ws.send(JSON.stringify({ type: 'data', color: 'b', roomId }));
        console.log("Player joined as black.");
        checkStartGame(roomId);
    }
}

function checkStartGame(roomId) {
    const room = rooms[roomId];
    if (room.white && room.black) {
        console.log("Both players connected. Starting game.");
        room.white.send(JSON.stringify({ type: 'start' }));
        room.black.send(JSON.stringify({ type: 'start' }));
        moveQueue[roomId] = [];
        processMoveQueue(roomId);
    }
}

function handleMove(ws, message) {
    const roomId = message.roomId;
    const room = rooms[roomId];


    if (room) {
        const move = {
            type: 'move',
            board: message.board,
            from: message.from,
            to: message.to,
            turn: message.turn
        };
        room.white.send(JSON.stringify(move));
        room.black.send(JSON.stringify(move));
        
    }
}

function processMoveQueue(roomId) {
    const room = rooms[roomId];
    const queue = moveQueue[roomId];

    if (room && queue && queue.length >= 2) {
        const move1 = queue.shift();
        const move2 = queue.shift();
        const opponentWs = room.turn === 'w' ? room.black : room.white;

        room.turn = room.turn === 'w' ? 'b' : 'w';

        opponentWs.send(JSON.stringify({
            type: 'move',
            from: move1.from,
            to: move1.to,
            turn: room.turn
        }));
        console.log("asaddsssss")
        opponentWs.send(JSON.stringify({
            type: 'move',
            from: move2.from,
            to: move2.to,
            turn: room.turn
        }));

        // Check if there are additional moves in the queue
        if (queue.length > 0) {
            processMoveQueue(roomId);
        }
    }
}


function getPlayerColor(ws, room) {
    if (!room) return null;
    if (ws === room.white) return 'w';
    if (ws === room.black) return 'b';
    return null;
}
