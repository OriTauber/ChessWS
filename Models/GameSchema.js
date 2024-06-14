const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
    white: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    black: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moves: [String]
});


const Game = mongoose.model('Game', GameSchema);

module.exports = Game;