'use strict';
const { parentPort } = require('worker_threads');
const fs = require('fs');

const { matchesMagic, parseBootSector, clust2byte } = require('./lib/workerUtils');

let deviceFd = null;

// Synchronous read — safe in a worker_thread (separate OS thread, won't block UI)
function readBytes(offset, length) {
    const buf = Buffer.alloc(length);
    try {
        const bytesRead = fs.readSync(deviceFd, buf, 0, length, offset);
        return new Uint8Array(buf.buffer, buf.byteOffset, bytesRead);
    } catch {
        return null;
    }
}

function readClusters(geo, fromCluster, toCluster) {
    return readBytes(clust2byte(fromCluster, geo), (toCluster - fromCluster) * geo.bytesPerCluster);
}

function findMP4End(geo, absStart, maxSize) {
    const { totalClusters, bytesPerCluster } = geo;
    const BATCH = 256;
    let accumBytes = bytesPerCluster;
    let endCluster = absStart + 1;

    while (endCluster < totalClusters && accumBytes < maxSize) {
        const batchStart = endCluster;
        const batchEnd   = Math.min(batchStart + BATCH, totalClusters);
        const data       = readClusters(geo, batchStart, batchEnd);
        if (!data) { endCluster = batchEnd; break; }

        let done = false;
        for (let k = 0; k < (batchEnd - batchStart); k++) {
            if (matchesMagic(data, k * bytesPerCluster)) {
                endCluster = batchStart + k;
                done = true;
                break;
            }
            accumBytes += bytesPerCluster;
            if (accumBytes >= maxSize) {
                endCluster = batchStart + k + 1;
                done = true;
                break;
            }
        }
        if (done) break;
        endCluster = batchEnd;
    }
    return endCluster;
}

function scanForMP4s(geo, maxSize) {
    const { totalClusters, bytesPerCluster } = geo;
    const BATCH = 256;
    let foundCount = 0;
    let cluster = 0;

    while (cluster < totalClusters) {
        const batchEnd = Math.min(cluster + BATCH, totalClusters);
        const data = readClusters(geo, cluster, batchEnd);

        if (!data) {
            cluster = batchEnd;
            parentPort.postMessage({ type: 'progress', cluster, total: totalClusters, found: foundCount });
            continue;
        }

        let foundInBatch = false;
        for (let i = 0; i < (batchEnd - cluster); i++) {
            if (matchesMagic(data, i * bytesPerCluster)) {
                const absStart     = cluster + i;
                const endCluster   = findMP4End(geo, absStart, maxSize);
                const clusterCount = endCluster - absStart;
                const size         = clusterCount * bytesPerCluster;
                const offset       = clust2byte(absStart, geo);

                foundCount++;
                parentPort.postMessage({ type: 'found', cluster: absStart, clusterCount, size, offset });
                cluster = endCluster;
                foundInBatch = true;
                break;
            }
        }

        if (!foundInBatch) cluster = batchEnd;
        parentPort.postMessage({ type: 'progress', cluster: Math.min(cluster, totalClusters), total: totalClusters, found: foundCount });
    }

    parentPort.postMessage({ type: 'done', count: foundCount });
}

parentPort.on('message', ({ type, devicePath, maxSize }) => {
    if (type !== 'start') return;
    try {
        deviceFd = fs.openSync(devicePath, 'r');

        parentPort.postMessage({ type: 'status', text: 'Parsing boot sector…' });
        const bootBuf = Buffer.alloc(512);
        fs.readSync(deviceFd, bootBuf, 0, 512, 0);

        const geo = parseBootSector(bootBuf);
        if (!geo.bytesPerSector || !geo.sectorsPerCluster)
            throw new Error('Could not parse filesystem — is this a FAT32 or exFAT drive?');

        parentPort.postMessage({ type: 'geometry', geo });
        parentPort.postMessage({ type: 'status', text: 'Scanning clusters for MP4 headers…' });
        scanForMP4s(geo, maxSize);
    } catch (err) {
        parentPort.postMessage({ type: 'error', message: err.message });
    } finally {
        if (deviceFd !== null) { try { fs.closeSync(deviceFd); } catch {} deviceFd = null; }
    }
});
