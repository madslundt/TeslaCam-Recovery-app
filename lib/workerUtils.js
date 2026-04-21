'use strict';

const MAGIC = new Uint8Array([0x00,0x00,0x00,0x20,0x66,0x74,0x79,0x70,0x6D,0x70,0x34,0x32]);

function matchesMagic(bytes, off) {
    if (off + MAGIC.length > bytes.length) return false;
    for (let i = 0; i < MAGIC.length; i++) {
        if (bytes[off + i] !== MAGIC[i]) return false;
    }
    return true;
}

// Mirrors parseBootSector from the original browser worker
function parseBootSector(buf) {
    const view  = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const bytes = buf;

    const isExFat = bytes[3]===0x45 && bytes[4]===0x58 &&
                    bytes[5]===0x46 && bytes[6]===0x41 && bytes[7]===0x54;

    let bytesPerSector, sectorsPerCluster, reservedSectors, numberOfFATs;
    let maxRootDirEntries, totalSectors, sectorsPerFAT, rootDirectoryCluster;

    if (isExFat) {
        bytesPerSector       = 1 << view.getUint8(0x6C);
        sectorsPerCluster    = 1 << view.getUint8(0x6D);
        reservedSectors      = view.getUint32(0x50, true);
        numberOfFATs         = view.getUint8(0x6E);
        maxRootDirEntries    = 0;
        const lo             = view.getUint32(0x48, true);
        const hi             = view.getUint32(0x4C, true);
        totalSectors         = hi * 0x100000000 + lo;
        sectorsPerFAT        = view.getUint32(0x54, true);
        rootDirectoryCluster = view.getUint32(0x60, true);
    } else {
        bytesPerSector       = view.getUint16(0x0B, true);
        sectorsPerCluster    = view.getUint8(0x0D);
        reservedSectors      = view.getUint16(0x0E, true);
        numberOfFATs         = view.getUint8(0x10);
        maxRootDirEntries    = view.getUint16(0x11, true);
        totalSectors         = view.getUint16(0x13, true);
        sectorsPerFAT        = view.getUint32(0x24, true);
        rootDirectoryCluster = view.getUint32(0x2C, true);
        if (totalSectors === 0) totalSectors = view.getUint32(0x20, true);
    }

    const totalClusters   = Math.floor(totalSectors / sectorsPerCluster);
    const bytesPerCluster = bytesPerSector * sectorsPerCluster;

    return { isExFat, bytesPerSector, sectorsPerCluster, reservedSectors,
             numberOfFATs, maxRootDirEntries, totalSectors, totalClusters,
             sectorsPerFAT, rootDirectoryCluster, bytesPerCluster };
}

function clust2byte(clust, geo) {
    const sect = geo.reservedSectors
               + geo.numberOfFATs * geo.sectorsPerFAT
               + Math.floor(geo.maxRootDirEntries * 32 / geo.bytesPerSector)
               + (clust - 2) * geo.sectorsPerCluster;
    return sect * geo.bytesPerSector;
}

module.exports = { MAGIC, matchesMagic, parseBootSector, clust2byte };
