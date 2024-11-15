// Define User model
const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    name:{type: String},
    password: { type: String, required: true }
});

const UserModel = mongoose.model('User', userSchema);

module.exports = UserModel;