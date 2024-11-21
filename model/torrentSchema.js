const mongoose = require('mongoose');

const peerSchema = new mongoose.Schema({
    peer_id: {
        type: String,
        required: true,
        maxlength: 20 
    },
    ip: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(v);
            },
            message: props => `${props.value} không phải là địa chỉ IP hợp lệ!`
        }
    },
    port: {
        type: String,
        required: true,
    },
}, { _id: false }); 

const torrentSchema = new mongoose.Schema({
    info_hash: {
        type: String,
        required: true,
        unique: true,
        maxlength: 40 
    },
    peers: {
        type: [peerSchema], 
        default: []
    },
    interval: {
        type: Number,
        default: 1800000, 
        required: true
    },
}, { timestamps: true });

module.exports = mongoose.model('Torrent', torrentSchema);