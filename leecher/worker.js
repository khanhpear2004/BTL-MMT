const { parentPort, workerData } = require('worker_threads');
const net = require('net');
const fs = require('fs');

// Dữ liệu từ workerData
const { port, ip , startPiece, endPiece, pieceLength, fileBuffer, infoHash, peerId } = workerData;

const client = new net.Socket();

client.connect(port, ip, () => {
    console.log(`Worker kết nối với peer ${ip}:${port}`);
   
    const handshake = createHandshake(infoHash, peerId);
    client.write(handshake);
});

client.on('data', (data) => {
    if (!client.handshaked) {
        // Xử lý handshake
        const receivedInfoHash = data.slice(28, 48).toString('hex');
        if (receivedInfoHash === infoHash) {
            console.log(`Handshake thành công với peer ${ip}`);
            client.handshaked = true;
            sendRequest(client, startPiece, 0, pieceLength); // Bắt đầu tải mảnh đầu tiên
        } else {
            console.error('Handshake thất bại.');
            client.destroy();
        }
        return;
    }

    // Xử lý mảnh nhận được
    const messageId = data.readUInt8(4);
    if (messageId === 7) {
        const index = data.readUInt32BE(5);
        const begin = data.readUInt32BE(9);
        const block = data.slice(13);

        block.copy(fileBuffer, index * pieceLength + begin);
        console.log(`Worker nhận được mảnh ${index} từ peer ${ip}`);

        if (index < endPiece) {
            sendRequest(client, index + 1, 0, pieceLength);
        } else {
            console.log(`Worker hoàn thành tải từ mảnh ${startPiece} đến ${endPiece}`);
            client.end();
            parentPort.postMessage('done');
        }
    }
});

client.on('error', (err) => {
    console.error(`Lỗi từ peer ${ip}:${port}:`, err.message);
    parentPort.postMessage('error');
});

function createHandshake(infoHash, peerId) {
    const protocol = Buffer.from('BitTorrent protocol');
    const reserved = Buffer.alloc(8);
    const infoHashBuffer = Buffer.from(infoHash, 'hex');
    const peerIdBuffer = Buffer.from(peerId);

    return Buffer.concat([
        Buffer.from([protocol.length]),
        protocol,
        reserved,
        infoHashBuffer,
        peerIdBuffer,
    ]);
}

function sendRequest(socket, index, begin, length) {
    const messageLength = Buffer.alloc(4);
    messageLength.writeUInt32BE(13, 0);

    const messageId = Buffer.from([6]);
    const indexBuffer = Buffer.alloc(4);
    indexBuffer.writeUInt32BE(index, 0);

    const beginBuffer = Buffer.alloc(4);
    beginBuffer.writeUInt32BE(begin, 0);

    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(length, 0);

    const request = Buffer.concat([messageLength, messageId, indexBuffer, beginBuffer, lengthBuffer]);
    socket.write(request);
}
