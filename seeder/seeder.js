const fs = require('fs');
const crypto = require('crypto');
const bencode = require('bencode');
const path = require('path');
const axios = require('axios');
const net = require('net');
const express = require('express');
const {splitFile} = require('../splitFile/splitFile');
// import create_torrent from 'create-torrent';

const filename = "test";

const filePath = `../file/${filename}.txt`;
const trackerURL = 'http://192.168.101.31:3000/announce';
const outputFileName = path.join(path.dirname(filePath), `${filename}.torrent`);

// const PORT = 3000;
const SEEDER_PORT = 6882;
const TRACKER_PORT = 3000; 

// Hàm dùng để tạo file torrent từ dữ liệu
async function createTorrent(filePath, trackerURL, outputFileName){
    const fileStats = fs.statSync(filePath);
    const fileName = filePath.split('/').pop();

    // Đọc dữ liệu file
    const fileData = fs.readFileSync(filePath);
    // Tính toán piece length (ở đây chọn 512 KB)
    const pieceLength = 8; 
    const pieces = [];
    const FormalPieces = [];

    // Chia nhỏ file thành các pieces
    for (let i = 0; i < fileData.length; i += pieceLength) {
        const piece = fileData.slice(i, i + pieceLength);
        const hash = crypto.createHash('sha1').update(piece).digest();
        pieces.push(hash);
        FormalPieces.push(piece);
    }


    for(let i = 0; i < pieces.length; i++){
        console.log(`thông tin mảnh thứ ${i + 1}: ${FormalPieces[i].toString()}`)
    }

    console.log("tổng cộng có " + pieces.length + " mảnh")

    // Tạo metadata cho file torrent
    const torrent = {
        announce: trackerURL,
        info: {
            name: fileName,
            length: fileStats.size,
            'piece length': pieceLength,
            pieces: Buffer.concat(pieces),
        },
    };

    // Bencode và lưu file torrent
    const encodedTorrent = bencode.encode(torrent);
    // console.log(encodedTorrent);
    // console.log(bencode.decode(encodedTorrent));
    fs.writeFileSync(outputFileName, encodedTorrent);

    // console.log({encodedTorrent});

    console.log(`File .torrent đã được tạo: ${outputFileName}`);

    // Tính info_hash từ metadata torrent
    const infoHash = crypto.createHash('sha1').update(encodedTorrent).digest('hex');

    // Tạo một peer_id ngẫu nhiên
    const peerId = '--WT0001--' + Math.random().toString(36).substring(2, 12);  // Ví dụ peer_id ngẫu nhiên
    // const port = ;  // Cổng mà seeder lắng nghe

    // Gửi yêu cầu announce tới tracker
    axios.get(trackerURL, {
        params: {
            info_hash: infoHash,  // Giá trị info_hash từ file torrent
            peer_id: peerId,      // Peer ID của seeder
            port: SEEDER_PORT,           // Cổng của seeder
            uploaded: 0,          // Tổng dữ liệu đã upload (seeding)
            downloaded: 0,        // Tổng dữ liệu đã download (chưa có giá trị ở đây)
            left: fileStats.size, // Kích thước file còn lại để tải (seeding)
        }
    })
    .then(response => {
        console.log('Announce thành công. Dữ liệu từ tracker:', response.data);
    })
    .catch(error => {
        console.error('Lỗi khi gửi yêu cầu announce:', error);
    });
    console.log(trackerURL);
    return { torrent, encodedTorrent, pieces, infoHash, peerId };
}

// Lắng nghe và xử lý kết nối từ Leecher
function startSeederServer(filePath, pieces, pieceLength, infoHash, peerId) {
    const fileBuffer = fs.readFileSync(filePath); 
    
    const server = net.createServer((socket) => {
        console.log('Leecher đã kết nối:', socket.remoteAddress, socket.remotePort);
        socket.handshaked = false;
        // Nhận yêu cầu từ Leecher
        socket.on('data', (data) => {
            console.log("kiểm tra handshake: " + socket.handshaked )
            if(!socket.handshaked){
                console.log("data từ leecher trả về: " + data);
                console.log("data-length: "  + data.length)
                if(data.length < 68){
                    console.log("Dữ liệu handshake không hợp lệ")
                    socket.destroy();
                    return;
                }
                console.log("data từ leecher trả về: " + data);
                const pstrlen = data.readUInt8(0); // Độ dài giao thức
                const protocol = data.slice(1, 1 + pstrlen).toString();
                const receivedInfoHash = data.slice(28, 48).toString('hex');

                console.log('Handshake từ Leecher:', protocol, receivedInfoHash);

                if (protocol === 'BitTorrent protocol' && receivedInfoHash === infoHash) {
                    console.log('Handshake hợp lệ. Phản hồi lại.');
                    const handshakeResponse = createHandshake(infoHash, peerId);
                    socket.handshaked = true;
                    console.log("HandShake trả về cho leecher: " + handshakeResponse.toString('hex'));
                    // Phân tích từng phần của buffer handshake
                    const protocolLength = handshakeResponse.readUInt8(0); // Byte 0
                    const protocol = handshakeResponse.slice(1, 1 + protocolLength).toString(); // Byte 1–20
                    const reserved = handshakeResponse.slice(1 + protocolLength, 1 + protocolLength + 8); // Byte 21–28
                    const receivedInfoHash = handshakeResponse.slice(1 + protocolLength + 8, 1 + protocolLength + 28).toString('hex'); // Byte 29–48
                    const receivedPeerId = handshakeResponse.slice(1 + protocolLength + 28).toString(); // Byte 49–68
    
                    console.log(`Protocol Length: ${protocolLength}`);
                    console.log(`Protocol: ${protocol}`);
                    console.log(`Reserved: ${reserved.toString('hex')}`);
                    console.log(`InfoHash: ${receivedInfoHash}`);
                    console.log(`Peer ID: ${receivedPeerId}`);
    
                    socket.write(handshakeResponse); // Gửi lại handshake
                } else {
                    console.error('Handshake không hợp lệ. Đóng kết nối.');
                    socket.destroy();
                }
            }
            // Kiểm tra xem đây có phải là handshake không
            
            else {
                console.log("data message:" + data)
                const messageLength = data.readUInt32BE(0); // Độ dài message
                const messageId = data.readUInt8(4); // Message ID
                console.log("thông tin dâta gửi từ phía leecher xin mảnh mới: " + data.readUInt32BE(5))
                console.log(`Nhận được message ID: ${messageId}, Length: ${messageLength}`);

                if (messageId === 6) { // 6 = "request"
                    const index = data.readUInt32BE(5); // Chỉ số mảnh
                    console.log("index trước khi concat: " + index)
                    const begin = data.readUInt32BE(9); // Offset trong mảnh
                    const length = data.readUInt32BE(13); // Độ dài yêu cầu
    
                    const pieceData = fileBuffer.slice(index * pieceLength + begin, index * pieceLength + begin + length);
    
                    // Tạo phản hồi
                    const response = Buffer.concat([
                        Buffer.alloc(4, pieceData.length + 9), // Tổng độ dài message
                        Buffer.from([7]), // Message ID = 7 ("piece")
                        Buffer.alloc(4, index), // Chỉ số mảnh
                        Buffer.alloc(4, begin), // Offset
                        pieceData // Dữ liệu của mảnh
                    ]);

                    const messageLength = response.readUInt32BE(0); // Đọc độ dài message (4 bytes đầu tiên)
                    const messageId = response.readUInt8(4); // Đọc Message ID (1 byte tiếp theo)
                    const checkindex = response.readUInt32BE(5); // Đọc chỉ số mảnh (4 bytes)
                    const checkbegin = response.readUInt32BE(9); // Đọc Offset (4 bytes)
                    const checkpieceData = response.slice(13); // Dữ liệu của mảnh (phần còn lại)

                    console.log("Message Length:", messageLength);
                    console.log("Message ID:", messageId);
                    console.log("Index:", checkindex);
                    console.log("Begin:", checkbegin);
                    console.log("Piece Data:", checkpieceData.toString('utf-8')); // In dữ liệu mảnh dưới dạng chuỗi
                    socket.write(response);
                    console.log(`Đã gửi mảnh ${index}, offset ${begin}, độ dài ${length}`);
                }
            }
            console.log('/n');
        });

        socket.on('end', () => {
            console.log('Kết nối Leecher đã đóng.');
        });

        socket.on('error', (err) => {
            console.error('Lỗi kết nối:', err.message);
        });

    });

    server.listen(SEEDER_PORT,  () => {
        console.log(`Seeder đang lắng nghe tại :${SEEDER_PORT}`);
    });
}

//Tạo giao thức bắt tay hello
function createHandshake(infoHash, peerId) {
    const protocol = Buffer.from('BitTorrent protocol'); // Tên giao thức BitTorrent
    const reserved = Buffer.alloc(8); // 8 byte reserved, thường là các giá trị 0
    const infoHashBuffer = Buffer.from(infoHash, 'hex'); // infoHash được tính từ phần info của file torrent
    const peerIdBuffer = Buffer.from(peerId); // Peer ID của leecher hoặc seeder

    // Kết hợp các thành phần lại thành một buffer duy nhất
    const handshake = Buffer.concat([
        Buffer.from([protocol.length]), // Độ dài của protocol
        protocol, // Tên giao thức
        reserved, // Reserved (8 byte)
        infoHashBuffer, // info_hash
        peerIdBuffer // peer_id
    ]);
    return handshake; // Trả về buffer chứa gói handshake
}


async function Seeding(){
    const { torrent, encodedTorrent, pieces, infoHash, peerId} = await createTorrent(filePath, trackerURL, outputFileName);
    startSeederServer(filePath, pieces, torrent.info['piece length'], infoHash, peerId);
}

const app = express();

app.listen(TRACKER_PORT, () => {
    console.log(`Tracker đang lắng nghe tại cổng: ${TRACKER_PORT}`);
});


Seeding();




