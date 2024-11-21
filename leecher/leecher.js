const fs = require('fs');
const bencode = require('bencode');
const axios = require('axios');
const crypto = require('crypto');
const net = require('net'); 
const { Worker } = require('worker_threads');
const TorrentSchema = require("../model/torrentSchema");
const connectDatabase = require('../database');

connectDatabase();

// Đọc và giải mã file .torrent
const torrentFilePath = '../file/info.torrent';
const torrentFile = fs.readFileSync(torrentFilePath);

//Giải mã file torrent
const torrentData = bencode.decode(torrentFile);

// console.log({torrentData});
const trackerURL = torrentData.announce;  // URL của tracker
const fileName = torrentData.info.name;  // Tên file
const pieceLength = torrentData.info['piece length'];  // Kích thước của mỗi phần (piece)
const pieces = torrentData.info.pieces;  // Các hash của các phần (pieces)
const totalLength = torrentData.info.length;

const infoHash = crypto.createHash('sha1').update(torrentFile).digest('hex'); // info_hash của file torrent

const totalPieces = Math.ceil(totalLength / pieceLength); // Tổng số mảnh
const fileBuffer = Buffer.alloc(totalLength); // Bộ nhớ tạm cho file tải về

const peerId = '--LT0001--' + Math.random().toString(36).substring(2, 12);

console.log("độ dài của peerId: " + peerId.length);
const leecherPort = 6883;  // Cổng của leecher

async function announceToTracker() {
    try {
        console.log("Tracker URL:", trackerURL);
        const response = await axios.get(trackerURL, {
            params: {
                info_hash: infoHash,  // Giá trị info_hash từ file torrent
                peer_id: peerId,      // Peer ID của leecher
                port: leecherPort,    // Cổng của leecher
                uploaded: 0,          // Dữ liệu đã upload
                downloaded: 0,        // Dữ liệu đã download
                left: torrentData.info.length,  // Dữ liệu còn lại để tải
            }
        });
        
        // Lấy danh sách các peers từ tracker
        let peers = response.data.peers;
        console.log("in ra các torrent có trong database: ");
        // let torrent = await TorrentSchema.findOne({info_hash: infoHash});
        // console.log(torrent);
        // console.log('Peers:', peers);

        peers.forEach(peer => {
            // console.log("infoHash của peer này là: " +  peer.info_hash);
            // if (peer.info_hash && peer.info_hash === infoHash) {
            //     console.log(`Peer hợp lệ: ${peer.ip}:${peer.port}`);
                connectToPeer(peer); // Chỉ kết nối nếu infoHash trùng khớp
            // } else {
            //     console.log(`Peer không hợp lệ: ${peer.ip}:${peer.port}`);
            // }
        });
    } catch (error) {
        console.error('Lỗi khi gửi yêu cầu announce:', error);
    }
}

//-----------------------------------TEST-MULTITHREAD

// function createWorker(port, ip, startPiece, endPiece, pieceLength, fileBuffer, infoHash, peerId) {
//     return new Promise((resolve, reject) => {
//         const worker = new Worker('./worker.js', {
//             workerData: {
//                 port,
//                 ip,
//                 startPiece,
//                 endPiece,
//                 pieceLength,
//                 fileBuffer,
//                 infoHash,
//                 peerId,
//             },
//         });

//         worker.on('message', resolve); // Worker hoàn thành công việc
//         worker.on('error', reject); // Worker báo lỗi
//         worker.on('exit', (code) => {
//             if (code !== 0) reject(new Error(`Worker thoát với mã lỗi ${code}`));
//         });
//     });
// }

// async function downloadFile(peers, totalPieces, pieceLength, infoHash, peerId) {
//     const fileBuffer = Buffer.alloc(totalPieces * pieceLength); // Bộ nhớ lưu file

//     const workers = [];
//     const piecesPerPeer = Math.ceil(totalPieces / peers.length);

//     for (let i = 0; i < peers.length; i++) {
//         const startPiece = i * piecesPerPeer;
//         const endPiece = Math.min((i + 1) * piecesPerPeer - 1, totalPieces - 1);

//         console.log(`Peer ${i + 1} sẽ tải từ mảnh ${startPiece} đến ${endPiece}`);
//         console.log(JSON.stringify(peers[i]), startPiece, endPiece, pieceLength, fileBuffer, infoHash, peerId);
//         workers.push(createWorker(peers[i].port, peers[i].ip, startPiece, endPiece, pieceLength, fileBuffer, infoHash, peerId));
//     }

//     await Promise.all(workers);
//     console.log('Tất cả các mảnh đã được tải thành công.');

//     fs.writeFileSync('output_file.txt', fileBuffer.toString('utf-8'));
//     console.log('File đã được ghép thành công.');
// }


// // ================== HÀM KHỞI CHẠY ========================
// async function startLeecher(infoHash, peerId, totalPieces, pieceLength) {
   
//     console.log("infoHash cần tìm là: " + infoHash.toString());
//     // Lấy thông tin torrent từ database

//     // const torrent = await TorrentSchema.findOne({ info_hash: infoHash.toString() });
//     // if (!torrent) {
//     //     console.log(`Không tìm thấy torrent với info_hash: ${infoHash}`);
//     //     return;
//     // }
//     console.log("trước khi check db\n");
//     const torrent = await TorrentSchema.findOne({ info_hash: infoHash });
//     if (torrent) {
//         console.log('Result:', torrent);
//     } else {
//         console.log('No matching torrent found.');
//     }

//     // console.log("thông tin về torrent: " + torrent);
//     // console.log("sau khi check db\n")

//     const peers = torrent.peers; // Lấy danh sách Peer từ database

//     console.log(peers);

//     if (peers.length === 0) {
//         console.log('Không có Peer nào được lưu trong database.');
//         return;
//     }

//     console.log(`Tìm thấy ${peers.length} Peer trong database.`);
//     console.log(peers);

//     // Tải file từ danh sách Peer
//     await downloadFile(peers, totalPieces, pieceLength, infoHash, peerId);
// }

// startLeecher(infoHash, peerId, totalPieces, pieceLength);



// Hàm tạo handshake
function createHandshake() {
    const protocol = Buffer.from('BitTorrent protocol');
    const reserved = Buffer.alloc(8); // 8 byte reserved
    const infoHashBuffer = Buffer.from(infoHash, 'hex');
    const peerIdBuffer = Buffer.from(peerId);

    // In ra độ dài của từng trường
    console.log("Protocol Length:", protocol.length); // Phải là 19
    console.log("Reserved Length:", reserved.length); // Phải là 8
    console.log("InfoHash Buffer Length:", infoHashBuffer.length); // Phải là 20
    console.log("PeerID Buffer Length:", peerIdBuffer.length); // Phải là 20
    
    return Buffer.concat([
        Buffer.from([protocol.length]), // Độ dài của protocol
        protocol, // Tên giao thức
        reserved, // Reserved (8 byte)
        infoHashBuffer, // Info hash
        peerIdBuffer, // Peer ID
    ]);

}

function parseHandshake(buffer) {
    const pstrlen = buffer.readUInt8(0); // Đọc 1 byte đầu tiên (độ dài protocol)
    const protocol = buffer.slice(1, 1 + pstrlen).toString(); // Lấy protocol name
    const reserved = buffer.slice(1 + pstrlen, 1 + pstrlen + 8); // Lấy 8 byte reserved
    const infoHash = buffer.slice(1 + pstrlen + 8, 1 + pstrlen + 28).toString('hex'); // Lấy 20 byte info_hash
    const peerId = buffer.slice(1 + pstrlen + 28, 1 + pstrlen + 48).toString(); // Lấy 20 byte peer_id

    return {
        pstrlen,
        protocol,
        reserved,
        infoHash,
        peerId
    };
}

function sendRequest(socket, index, begin, length) {
     // Tổng độ dài message (4 bytes, giá trị cố định là 13)
     const messageLength = Buffer.alloc(4);
     messageLength.writeUInt32BE(13, 0);
 
     // Message ID (1 byte)
     const messageId = Buffer.from([6]); // Message ID = 6
 
     // Chỉ số mảnh (index, 4 bytes)
     const indexBuffer = Buffer.alloc(4);
     indexBuffer.writeUInt32BE(index, 0);
 
     // Offset trong mảnh (begin, 4 bytes)
     const beginBuffer = Buffer.alloc(4);
     beginBuffer.writeUInt32BE(begin, 0);
 
     // Độ dài dữ liệu yêu cầu (length, 4 bytes)
     const lengthBuffer = Buffer.alloc(4);
     lengthBuffer.writeUInt32BE(length, 0);
 
     // Kết hợp các phần lại thành một buffer duy nhất
     const request = Buffer.concat([messageLength, messageId, indexBuffer, beginBuffer, lengthBuffer]);
    
    socket.write(request);
    // console.log("MesageLength: " + messageLength.toString('hex'))
    // console.log("MesageId: " + messageId.toString('hex'))
    // console.log("IndexBuffer: " + indexBuffer.toString('hex'))
    // console.log("BeginBuffer: " + beginBuffer.toString('hex'))
    // console.log("lengthBuffer: " + lengthBuffer.toString('hex'))
    // console.log(" ")

    console.log(`Đã gửi yêu cầu mảnh ${index}, offset ${begin}, độ dài ${length}`);
}


// Hàm kiểm tra hash của mảnh
function verifyPiece(index, data) {
    const expectedHash = pieces.slice(index * 20, (index + 1) * 20); // Hash từ file .torrent
    const actualHash = crypto.createHash('sha1').update(data).digest(); // Hash của dữ liệu nhận được
    return Buffer.compare(expectedHash, actualHash) === 0; // So sánh
}


// Hàm kết nối đến một peer (seeder)
function connectToPeer(peer) {
    const { ip, port } = peer;
    const client = new net.Socket();
    let currentPieceIndex = 0;

    // Kết nối đến peer
    client.connect(port, ip, () => {
        console.log(`Đã kết nối đến peer ${ip}:${port}`);
        // Gửi handshake theo giao thức BitTorrent
        const handshake = createHandshake();
        console.log("thông tin của handshake: " + handshake);
        console.log("độ dài của handshake: " + handshake.length);
        // console.log("bắt tay: " + handshake);
        // console.log("giải mã bắt tay:" + handshake.toString("hex"));
        client.write(handshake);
    });

    // Nhận dữ liệu từ peer
    client.on('data', (data) => {
        if(!client.handshaked){
            // console.log('Dữ liệu nhận được:', data);
            const handshakeResponse = parseHandshake(data);

            console.log("dữ liệu handshake: " + handshakeResponse);

            if (handshakeResponse.infoHash === infoHash) {
                console.log('Handshake thành công.');
                client.handshaked = true;
                
                sendRequest(client, currentPieceIndex, 0, pieceLength); // Yêu cầu tải mảnh đầu tiên
            } 
            else {
                console.error('Handshake thất bại.');
                client.destroy();
            }
            return;
        }
        
        const outputFilePath = `./${fileName}`; // Ví dụ
        
        // Xử lý phản hồi mảnh
        if(data.length >= 4){
            const messageLength = data.readUInt32BE(0); // Độ dài message
            const messageId = data.readUInt8(4); // Message ID

            console.log(`Nhận được message ID: ${messageId}, Length: ${messageLength}`);

            if (messageId === 7) { // 7 = "piece"
                console.log("data: " + data);
                const index = data.readUInt32BE(5); console.log("index: " + index); // Chỉ số mảnh
                const begin = data.readUInt32BE(9); console.log("begin: " + begin);// Offset
                const block = data.slice(13); console.log("block: " + block.length);// Dữ liệu của mảnh
    
                // Ghi dữ liệu vào buffer
                block.copy(fileBuffer, index * pieceLength + begin);
                console.log("thông tin của file buffer hiện tại: " + fileBuffer)
                console.log(`Đã nhận mảnh ${index}, offset ${begin}, độ dài ${block.length}`);
    
                // Kiểm tra hash của mảnh
                if (verifyPiece(index, fileBuffer.slice(index * pieceLength, (index + 1) * pieceLength))) {
                    console.log(`Mảnh ${index} hợp lệ.`);
                    currentPieceIndex++;
                    if (currentPieceIndex < totalPieces) {
                        console.log(`gửi yêu cầu cho seeder đến mảnh ${index + 1}`)
                        sendRequest(client, currentPieceIndex, 0, pieceLength); // Gửi yêu cầu mảnh tiếp theo
                    } else {
                        // Hoàn tất tải file
                        fs.writeFileSync(outputFilePath, fileBuffer);
                        console.log('Tải file hoàn tất!');
                        client.end();
                    }
                } else {
                    console.error(`Mảnh ${index} không hợp lệ!`);
                }
            }
        }
       
    });

    // Xử lý khi kết nối đóng
    client.on('close', () => {
        console.log('Kết nối đóng');
    });

    // Xử lý lỗi
    client.on('error', (err) => {
        console.error('Lỗi khi kết nối:', err);
    });
}


function createHandshake() {
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

announceToTracker();

console.log(torrentData)

