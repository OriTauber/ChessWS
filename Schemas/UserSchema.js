const Joi = require('joi');

const UserSchema = Joi.object({
    username: Joi.string().required().min(3).max(10),
    password: Joi.string().required().min(3).max(10),
    games: Joi.array(),
})


module.exports.UserSchema = UserSchema;