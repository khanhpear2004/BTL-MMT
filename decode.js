const buffer = "��QM��,�t�?|0�H�a-LT0001-5gvkmouq09"

function parseHandshake(buffer) {
    const pstrlen = buffer.readUInt8(0); // Đọc độ dài của protocol
    const pstr = buffer.slice(1, 1 + pstrlen).toString(); // Protocol string
    const reserved = buffer.slice(1 + pstrlen, 1 + pstrlen + 8); // 8 byte reserved
    const infoHash = buffer.slice(1 + pstrlen + 8, 1 + pstrlen + 8 + 20).toString('hex'); // SHA-1 hash
    const peerId = buffer.slice(1 + pstrlen + 8 + 20, 1 + pstrlen + 8 + 20 + 20).toString('utf8'); // Peer ID

    return {
        pstrlen,
        pstr,
        reserved,
        infoHash,
        peerId
    };
}

