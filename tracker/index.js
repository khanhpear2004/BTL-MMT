const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const PORT = 3000;
const path = require("path")

// Dữ liệu lưu trữ các peers và torrent info_hash
let torrents = {};

// Middleware để parse các yêu cầu
app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.send("this is the test")
})

// Route để handle announce (nhận thông tin từ Seeder)
app.get('/announce', (req, res) => {
    const { info_hash, peer_id, port } = req.query;

    if (!info_hash || !peer_id || !port) {
        return res.status(400).send('Missing required parameters');
    }

    if (!torrents[info_hash]) {
        torrents[info_hash] = [];
    }
    console.log(info_hash, peer_id, port)
    

    // Thêm peer mới vào danh sách
    torrents[info_hash].push({
        peer_id,
        port,
        ip: req.connection.remoteAddress,
    });
    
    console.log(torrents)

    // Trả về danh sách peers hiện tại
    res.json({
        interval: 1800000, // Interval time để lần sau announce
        peers: torrents[info_hash].map(peer => ({
            // info_hash: info_hash,
            peer_id: peer.peer_id,
            ip: peer.ip,
            port: peer.port,
        })),
    });


});

app.post('/announce', (req, res) => {
    const { info_hash, peer_id, port, uploaded, downloaded, left } = req.body;

    console.log('Nhận thông báo từ peer mới:');
    console.log(`info_hash: ${info_hash}`);
    console.log(`peer_id: ${peer_id}`);
    console.log(`port: ${port}`);
    console.log(`uploaded: ${uploaded}`);
    console.log(`downloaded: ${downloaded}`);
    console.log(`left: ${left}`);

    // Lưu thông tin peer vào danh sách
    torrents.push({ info_hash, peer_id, port });

    // Gửi phản hồi về cho peer
    res.json({
        message: 'Tracker nhận thông báo thành công.',
        interval: 1800, // Thời gian giữa các lần announce
        torrents, // Danh sách các peer đã lưu
    });
});

// Lắng nghe trên cổng 3000
app.listen(PORT ,"192.168.101.31", () => {
    console.log(`Tracker đang chạy tại http://192.168.101.31:${PORT}`);
});
