// utils/splitFile.js
const crypto = require('crypto');

function splitFile(fileData, pieceLength) {
    const pieces = [];
    for (let i = 0; i < fileData.length; i += pieceLength) {
        const piece = fileData.slice(i, i + pieceLength);
        const hash = crypto.createHash('sha1').update(piece).digest();
        pieces.push(hash);
    }
    return pieces;
}

module.exports = { splitFile };
