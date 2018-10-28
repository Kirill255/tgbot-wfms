const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    telegram_id: {
        type: Number,
        required: true
    },
    films: {
        type: [String],
        default: []
    },
    created_date: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model("User", UserSchema);


module.exports = User;