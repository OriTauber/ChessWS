const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {type: String, required: true},
    password: {type: String, required: true},
    games: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Game' }]
});


const User = mongoose.model('User', UserSchema);

module.exports = User;