'use strict';

const { MAGIC, matchesMagic, parseBootSector, clust2byte } = require('../lib/workerUtils');

// ── matchesMagic ─────────────────────────────────────────────────────────────

describe('matchesMagic', () => {
    test('returns false when buffer is too short', () => {
        const buf = new Uint8Array([0x00, 0x00]);
        expect(matchesMagic(buf, 0)).toBe(false);
    });

    test('returns false when bytes do not match', () => {
        const buf = new Uint8Array(12).fill(0xFF);
        expect(matchesMagic(buf, 0)).toBe(false);
    });

    test('returns false when only a partial match (last byte differs)', () => {
        const buf = new Uint8Array(MAGIC);
        buf[buf.length - 1] = 0x00;
        expect(matchesMagic(buf, 0)).toBe(false);
    });

    test('returns true for exact MAGIC bytes at offset 0', () => {
        const buf = new Uint8Array(MAGIC);
        expect(matchesMagic(buf, 0)).toBe(true);
    });

    test('returns true when MAGIC is at a non-zero offset', () => {
        const buf = new Uint8Array(8 + MAGIC.length);
        buf.set(MAGIC, 8);
        expect(matchesMagic(buf, 8)).toBe(true);
        expect(matchesMagic(buf, 0)).toBe(false);
    });

    test('returns false when offset + MAGIC.length exceeds buffer length', () => {
        const buf = new Uint8Array(MAGIC);
        expect(matchesMagic(buf, 1)).toBe(false);
    });
});

// ── parseBootSector ───────────────────────────────────────────────────────────

describe('parseBootSector — FAT32 (totalSectors in 32-bit field)', () => {
    let buf;

    beforeEach(() => {
        buf = Buffer.alloc(512);
        buf.writeUInt16LE(512, 0x0B);      // bytesPerSector = 512
        buf.writeUInt8(64, 0x0D);           // sectorsPerCluster = 64
        buf.writeUInt16LE(32, 0x0E);        // reservedSectors = 32
        buf.writeUInt8(2, 0x10);            // numberOfFATs = 2
        buf.writeUInt16LE(512, 0x11);       // maxRootDirEntries = 512
        buf.writeUInt16LE(0, 0x13);         // totalSectors16 = 0 (force 32-bit path)
        buf.writeUInt32LE(1000000, 0x20);   // totalSectors32 = 1,000,000
        buf.writeUInt32LE(1953, 0x24);      // sectorsPerFAT = 1953
        buf.writeUInt32LE(2, 0x2C);         // rootDirectoryCluster = 2
    });

    test('isExFat is false', () => {
        expect(parseBootSector(buf).isExFat).toBe(false);
    });

    test('bytesPerSector is 512', () => {
        expect(parseBootSector(buf).bytesPerSector).toBe(512);
    });

    test('sectorsPerCluster is 64', () => {
        expect(parseBootSector(buf).sectorsPerCluster).toBe(64);
    });

    test('bytesPerCluster is 32768', () => {
        expect(parseBootSector(buf).bytesPerCluster).toBe(32768);
    });

    test('reads totalSectors from 32-bit field when 16-bit field is 0', () => {
        expect(parseBootSector(buf).totalSectors).toBe(1000000);
    });

    test('totalClusters is floor(1000000 / 64)', () => {
        expect(parseBootSector(buf).totalClusters).toBe(15625);
    });

    test('reservedSectors is 32', () => {
        expect(parseBootSector(buf).reservedSectors).toBe(32);
    });

    test('sectorsPerFAT is 1953', () => {
        expect(parseBootSector(buf).sectorsPerFAT).toBe(1953);
    });

    test('rootDirectoryCluster is 2', () => {
        expect(parseBootSector(buf).rootDirectoryCluster).toBe(2);
    });
});

describe('parseBootSector — FAT32 (totalSectors in 16-bit field)', () => {
    test('reads totalSectors from 16-bit field when non-zero', () => {
        const buf = Buffer.alloc(512);
        buf.writeUInt16LE(512, 0x0B);
        buf.writeUInt8(8, 0x0D);            // sectorsPerCluster = 8
        buf.writeUInt16LE(65535, 0x13);     // totalSectors16 = 65535 (non-zero)
        buf.writeUInt32LE(9999999, 0x20);   // totalSectors32 — should be ignored
        buf.writeUInt32LE(1, 0x24);
        buf.writeUInt32LE(2, 0x2C);

        const geo = parseBootSector(buf);
        expect(geo.totalSectors).toBe(65535);
        expect(geo.isExFat).toBe(false);
    });
});

describe('parseBootSector — exFAT', () => {
    let buf;

    beforeEach(() => {
        buf = Buffer.alloc(512);
        // exFAT signature at bytes 3–7: "EXFAT"
        buf[3] = 0x45; buf[4] = 0x58; buf[5] = 0x46; buf[6] = 0x41; buf[7] = 0x54;
        buf.writeUInt8(9, 0x6C);            // log2(bytesPerSector) = 9  → 512
        buf.writeUInt8(6, 0x6D);            // log2(sectorsPerCluster) = 6 → 64
        buf.writeUInt32LE(24576, 0x50);     // reservedSectors = 24576
        buf.writeUInt8(1, 0x6E);            // numberOfFATs = 1
        buf.writeUInt32LE(2000000, 0x48);   // totalSectors lo
        buf.writeUInt32LE(0, 0x4C);         // totalSectors hi
        buf.writeUInt32LE(4096, 0x54);      // sectorsPerFAT = 4096
        buf.writeUInt32LE(5, 0x60);         // rootDirectoryCluster = 5
    });

    test('isExFat is true', () => {
        expect(parseBootSector(buf).isExFat).toBe(true);
    });

    test('maxRootDirEntries is 0 for exFAT', () => {
        expect(parseBootSector(buf).maxRootDirEntries).toBe(0);
    });

    test('bytesPerSector derived from log2 field', () => {
        expect(parseBootSector(buf).bytesPerSector).toBe(512);
    });

    test('sectorsPerCluster derived from log2 field', () => {
        expect(parseBootSector(buf).sectorsPerCluster).toBe(64);
    });

    test('bytesPerCluster is 32768', () => {
        expect(parseBootSector(buf).bytesPerCluster).toBe(32768);
    });

    test('totalSectors from 64-bit lo/hi fields', () => {
        expect(parseBootSector(buf).totalSectors).toBe(2000000);
    });

    test('sectorsPerFAT is 4096', () => {
        expect(parseBootSector(buf).sectorsPerFAT).toBe(4096);
    });

    test('rootDirectoryCluster is 5', () => {
        expect(parseBootSector(buf).rootDirectoryCluster).toBe(5);
    });
});

// ── clust2byte ────────────────────────────────────────────────────────────────

describe('clust2byte', () => {
    const geo = {
        reservedSectors:   32,
        numberOfFATs:      2,
        sectorsPerFAT:     1953,
        maxRootDirEntries: 512,
        bytesPerSector:    512,
        sectorsPerCluster: 64,
    };

    // sect = 32 + 2*1953 + floor(512*32/512) + (clust-2)*64
    //      = 32 + 3906  + 64                + (clust-2)*64
    //      = 4002 + (clust-2)*64

    test('cluster 2 (first data cluster) maps to correct byte offset', () => {
        // sect = 32 + 2*1953 + floor(512*32/512) + (2-2)*64
        //      = 32 + 3906 + 32 + 0 = 3970; byte = 3970 * 512 = 2032640
        expect(clust2byte(2, geo)).toBe(2032640);
    });

    test('cluster 3 maps to correct byte offset', () => {
        // sect = 3970 + 64 = 4034; byte = 4034 * 512 = 2065408
        expect(clust2byte(3, geo)).toBe(2065408);
    });

    test('consecutive clusters are exactly one cluster apart', () => {
        const clusterSize = geo.sectorsPerCluster * geo.bytesPerSector; // 32768
        expect(clust2byte(3, geo) - clust2byte(2, geo)).toBe(clusterSize);
        expect(clust2byte(10, geo) - clust2byte(9, geo)).toBe(clusterSize);
    });
});
