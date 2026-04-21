'use strict';
const { app, BrowserWindow, ipcMain, protocol, dialog, Menu, shell } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const fs   = require('fs');
const { execFile, exec } = require('child_process');
const { promisify } = require('util');

const execFileP = promisify(execFile);
const execP     = promisify(exec);

// Register custom scheme before app is ready
protocol.registerSchemesAsPrivileged([{
    scheme: 'teslacam',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

// ── Window ────────────────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 960, height: 780, minWidth: 720, minHeight: 560,
        title: 'TeslaCam Recovery',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow.loadFile('index.html');
    buildMenu();
}

function buildMenu() {
    const template = [];

    // macOS: prepend the standard app menu (provides Cmd+Q → quit)
    if (process.platform === 'darwin') {
        template.push({
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
            ],
        });
    }

    template.push(
        {
            label: 'File',
            submenu: [
                { role: process.platform === 'darwin' ? 'close' : 'quit' },
            ],
        },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'View on GitHub',
                    click: () => shell.openExternal('https://github.com/ccbrown/teslacam-recovery'),
                },
            ],
        }
    );

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Custom protocol: teslacam://clip?device=...&offset=...&length=... ─────────
// Handles HTTP Range requests so <video> can seek within clips.
app.whenReady().then(() => {
    protocol.handle('teslacam', (request) => {
        const url    = new URL(request.url);
        const device = decodeURIComponent(url.searchParams.get('device') || '');
        const clipOff = parseInt(url.searchParams.get('offset') || '0', 10);
        const clipLen = parseInt(url.searchParams.get('length') || '0', 10);

        if (!device || !clipLen) {
            return new Response('Bad request', { status: 400 });
        }

        let start = 0;
        let end   = clipLen - 1;
        const rangeHdr = request.headers.get('range');
        if (rangeHdr) {
            const m = rangeHdr.match(/bytes=(\d+)-(\d*)/);
            if (m) {
                start = parseInt(m[1], 10);
                end   = m[2] ? parseInt(m[2], 10) : clipLen - 1;
            }
        }

        const readLen = end - start + 1;
        let fd = null;
        try {
            const buf = Buffer.alloc(readLen);
            fd = fs.openSync(device, 'r');
            fs.readSync(fd, buf, 0, readLen, clipOff + start);

            const headers = {
                'Content-Type':   'video/mp4',
                'Content-Length': String(readLen),
                'Accept-Ranges':  'bytes',
            };
            if (rangeHdr) {
                headers['Content-Range'] = `bytes ${start}-${end}/${clipLen}`;
                return new Response(buf, { status: 206, headers });
            }
            return new Response(buf, { status: 200, headers });
        } catch (err) {
            return new Response(`Device read error: ${err.message}`, { status: 500 });
        } finally {
            if (fd !== null) { try { fs.closeSync(fd); } catch {} }
        }
    });

    createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });

// ── Drive listing — platform-specific, no native deps ────────────────────────
async function listDrivesMac() {
    const { stdout } = await execFileP('diskutil', ['list']);
    const drives = [];
    for (const line of stdout.split('\n')) {
        const m = line.match(/^(\/dev\/disk(\d+))\s+\(external/);
        if (!m) continue;
        try {
            const { stdout: info } = await execFileP('diskutil', ['info', m[1]]);
            const sizeM = info.match(/Disk Size:\s+[^(]+\((\d+) Bytes/);
            const nameM = info.match(/(?:Volume Name|Media Name):\s+(.+)/);
            drives.push({
                device:        `/dev/rdisk${m[2]}`,
                displayDevice: m[1],
                description:   nameM ? nameM[1].trim() : `Disk ${m[2]}`,
                size:          sizeM ? parseInt(sizeM[1]) : 0,
            });
        } catch {
            drives.push({ device: `/dev/rdisk${m[2]}`, displayDevice: m[1], description: `Disk ${m[2]}`, size: 0 });
        }
    }
    return drives;
}

async function listDrivesLinux() {
    const { stdout } = await execFileP('lsblk', ['--json', '-o', 'NAME,SIZE,LABEL,RM,TYPE,MODEL,MOUNTPOINT']);
    const data   = JSON.parse(stdout);
    const drives = [];
    for (const dev of (data.blockdevices || [])) {
        if (dev.type !== 'disk') continue;
        if (dev.rm !== '1' && dev.rm !== 1 && dev.rm !== true) continue;
        const mountpoints = [];
        if (dev.mountpoint) mountpoints.push(dev.mountpoint);
        for (const child of (dev.children || [])) {
            if (child.mountpoint) mountpoints.push(child.mountpoint);
        }
        drives.push({
            device:        `/dev/${dev.name}`,
            displayDevice: `/dev/${dev.name}`,
            description:   dev.model || dev.label || dev.name,
            size:          parseSizeSuffix(dev.size),
            mountpoints:   mountpoints.filter(Boolean),
        });
    }
    return drives;
}

async function listDrivesWindows() {
    const { stdout } = await execP('wmic diskdrive get DeviceID,Model,Size /format:list');
    const drives = [];
    for (const block of stdout.split(/\r?\n\r?\n/)) {
        const idM   = block.match(/DeviceID=(.+)/);
        const modM  = block.match(/Model=(.+)/);
        const sizeM = block.match(/Size=(\d+)/);
        if (!idM) continue;
        drives.push({
            device:        idM[1].trim(),
            displayDevice: idM[1].trim(),
            description:   modM ? modM[1].trim() : idM[1].trim(),
            size:          sizeM ? parseInt(sizeM[1]) : 0,
        });
    }
    return drives;
}

function parseSizeSuffix(s) {
    if (!s) return 0;
    const m = String(s).trim().toUpperCase().match(/^([\d.]+)\s*([KMGT]?)B?$/);
    if (!m) return 0;
    const units = { '': 1, K: 1024, M: 1048576, G: 1073741824, T: 1099511627776 };
    return Math.floor(parseFloat(m[1]) * (units[m[2]] || 1));
}

ipcMain.handle('list-drives', async () => {
    try {
        if (process.platform === 'darwin') return await listDrivesMac();
        if (process.platform === 'linux')  return await listDrivesLinux();
        if (process.platform === 'win32')  return await listDrivesWindows();
    } catch (err) {
        console.error('list-drives error:', err);
    }
    return [];
});

// ── Unmount drive before scanning ────────────────────────────────────────────
ipcMain.handle('unmount-drive', async (event, drive) => {
    const plat = process.platform;

    if (plat === 'darwin') {
        // diskutil unmountDisk handles all partitions at once
        try {
            const { stdout } = await execFileP('diskutil', ['unmountDisk', drive.displayDevice]);
            // diskutil exits 0 even if already unmounted; check output for failure phrases
            if (/failed/i.test(stdout)) return { success: false, error: stdout.trim() };
            return { success: true };
        } catch (err) {
            return { success: false, error: (err.stderr || err.message).trim() };
        }
    }

    if (plat === 'linux') {
        const mps = (drive.mountpoints || []).filter(Boolean);
        if (mps.length === 0) return { success: true }; // nothing mounted
        const errors = [];
        for (const mp of mps) {
            try { await execFileP('umount', [mp]); }
            catch (err) { errors.push((err.stderr || err.message).trim()); }
        }
        return errors.length === 0
            ? { success: true }
            : { success: false, error: errors.join('\n') };
    }

    // Windows: raw device reads work as Administrator without explicit unmount
    return { success: true };
});

// ── Open file location in system file manager ────────────────────────────────
ipcMain.handle('show-in-folder', (event, filePath) => {
    shell.showItemInFolder(filePath);
});

// ── Output folder picker ──────────────────────────────────────────────────────
ipcMain.handle('choose-output-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Save Recovered Files Here',
        title: 'Choose folder to save recovered files',
    });
    return result.canceled ? null : result.filePaths[0];
});

// ── Scan lifecycle ────────────────────────────────────────────────────────────
let scanWorker = null;

ipcMain.handle('start-scan', (event, devicePath, outputDir) => {
    if (scanWorker) { scanWorker.terminate(); scanWorker = null; }

    scanWorker = new Worker(path.join(__dirname, 'worker.js'));

    scanWorker.on('message', (msg) => {
        // Auto-save each found clip to outputDir before notifying renderer
        if (msg.type === 'found' && outputDir) {
            const filename = msg.cluster + '.mp4';
            const outPath  = path.join(outputDir, filename);
            let savedPath  = null;
            let fd = null, outFd = null;
            try {
                const CHUNK = 1024 * 1024;
                const buf   = Buffer.alloc(CHUNK);
                fd    = fs.openSync(devicePath, 'r');
                outFd = fs.openSync(outPath, 'w');
                let pos = msg.offset, left = msg.size;
                while (left > 0) {
                    const n         = Math.min(CHUNK, left);
                    const bytesRead = fs.readSync(fd, buf, 0, n, pos);
                    fs.writeSync(outFd, buf, 0, bytesRead);
                    pos += bytesRead; left -= bytesRead;
                }
                savedPath = outPath;
            } catch (err) {
                console.warn('Failed to save clip:', err.message);
            } finally {
                if (outFd !== null) { try { fs.closeSync(outFd); } catch {} }
                if (fd !== null)    { try { fs.closeSync(fd);    } catch {} }
            }
            event.sender.send('scan-found', { ...msg, savedPath });
        } else {
            event.sender.send('scan-' + msg.type, msg);
        }
    });

    scanWorker.on('error', (err) => event.sender.send('scan-error', { message: err.message }));
    scanWorker.on('exit',  ()    => { scanWorker = null; });
    scanWorker.postMessage({ type: 'start', devicePath, maxSize: 40_000_000 });
});

ipcMain.handle('cancel-scan', () => {
    if (scanWorker) { scanWorker.terminate(); scanWorker = null; }
});

// ── Download single clip via native save dialog ───────────────────────────────
ipcMain.handle('download-clip', async (event, devicePath, offset, length, suggestedName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: suggestedName,
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });
    if (result.canceled) return { success: false, canceled: true };

    let fd = null, outFd = null;
    try {
        const CHUNK = 1024 * 1024;
        const buf   = Buffer.alloc(CHUNK);
        fd    = fs.openSync(devicePath, 'r');
        outFd = fs.openSync(result.filePath, 'w');
        let pos  = offset;
        let left = length;
        while (left > 0) {
            const n         = Math.min(CHUNK, left);
            const bytesRead = fs.readSync(fd, buf, 0, n, pos);
            fs.writeSync(outFd, buf, 0, bytesRead);
            pos += bytesRead; left -= bytesRead;
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    } finally {
        if (outFd !== null) { try { fs.closeSync(outFd); } catch {} }
        if (fd !== null)    { try { fs.closeSync(fd);    } catch {} }
    }
});

// ── Save all clips via native folder picker ───────────────────────────────────
ipcMain.handle('save-all-clips', async (event, devicePath, clips) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Save Here',
        title: 'Choose folder to save recovered clips',
    });
    if (result.canceled) return { success: false, canceled: true };

    const dir    = result.filePaths[0];
    const CHUNK  = 1024 * 1024;
    let saved = 0;
    let fd    = null;

    try {
        fd = fs.openSync(devicePath, 'r');
        const buf = Buffer.alloc(CHUNK);
        for (const clip of clips) {
            let outFd = null;
            try {
                outFd = fs.openSync(path.join(dir, clip.filename), 'w');
                let pos = clip.offset, left = clip.length;
                while (left > 0) {
                    const n         = Math.min(CHUNK, left);
                    const bytesRead = fs.readSync(fd, buf, 0, n, pos);
                    fs.writeSync(outFd, buf, 0, bytesRead);
                    pos += bytesRead; left -= bytesRead;
                }
                saved++;
                event.sender.send('save-progress', { saved, total: clips.length });
            } catch (e) {
                console.warn(`Skipped ${clip.filename}:`, e.message);
            } finally {
                if (outFd !== null) { try { fs.closeSync(outFd); } catch {} }
            }
        }
    } finally {
        if (fd !== null) { try { fs.closeSync(fd); } catch {} }
    }

    return { success: true, saved };
});
