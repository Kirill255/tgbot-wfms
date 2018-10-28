const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CinemaSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    uuid: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    location: {
        type: Schema.Types.Mixed,
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

const Cinema = mongoose.model("Cinema", CinemaSchema);


module.exports = Cinema;