const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const PORT = 3000;
const path = require("path");
const mongoose = require("mongoose");
const TorrentSchema = require("../model/torrentSchema");
const os = require('os');
const connectDatabase = require('../database');

function getLocalIP() {
    const networkInterfaces = os.networkInterfaces(); // Lấy danh sách các giao diện mạng
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const net of interfaces) {
            // Kiểm tra nếu giao diện mạng là IPv4 và không phải địa chỉ nội bộ (127.0.0.1)
            if (net.family === 'IPv4' && !net.internal) {
                return net.address; // Trả về địa chỉ IP
            }
        }
    }
    return 'Không tìm thấy IP phù hợp'; // Trường hợp không tìm thấy IP
}

console.log("mạng hiện tại có IP là: " + getLocalIP())

// Middleware để parse các yêu cầu
app.use(bodyParser.json());

connectDatabase();

// Route để handle announce (nhận thông tin từ Seeder)
app.get('/announce', async (req, res) => {
    const { info_hash, peer_id, port } = req.query;

    if (!info_hash || !peer_id || !port) {
        return res.status(400).send('Missing required parameters');
    }

    const peer = {
        peer_id,
        ip: req.connection.remoteAddress, // IP từ kết nối của client
        port: port, 
    };

    console.log(info_hash, peer_id, port)
    

    try {
        // Kiểm tra xem torrent đã tồn tại trong cơ sở dữ liệu chưa
        let torrent = await TorrentSchema.findOne({ info_hash });

        if (torrent) {
            // Nếu tồn tại, thêm peer mới vào danh sách nếu chưa có
            const isPeerExist = torrent.peers.some(p => p.peer_id === peer_id);
            if (!isPeerExist) {
                torrent.peers.push(peer);
                await torrent.save(); // Lưu thay đổi
            }
        } else {
            
            torrent = new TorrentSchema({
                info_hash,
                peers: [peer],
                interval: 1800000, // Interval mặc định
            });

            await torrent.save();
            console.log("đã lưu vào database peer: " + torrent)

        }

        console.log(`Đã lưu/ cập nhật torrent: ${info_hash}`);
        
        // Trả về danh sách các peers hiện tại
        res.json({
            interval: torrent.interval, // Interval cho lần announce tiếp theo
            peers: torrent.peers.map(({ peer_id, ip, port }) => ({ peer_id, ip, port })),
        });

    } catch (error) {
        console.error('Lỗi khi lưu vào cơ sở dữ liệu:', error);
        res.status(500).send('Internal Server Error');
    }
});



// Lắng nghe trên cổng 3000
app.listen(PORT ,`${getLocalIP()}`, () => {
 
    console.log(`Tracker đang chạy tại http://${getLocalIP()}:${PORT}`);
});
