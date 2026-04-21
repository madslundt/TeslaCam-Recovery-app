'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,

    listDrives: () =>
        ipcRenderer.invoke('list-drives'),

    unmountDrive: (drive) =>
        ipcRenderer.invoke('unmount-drive', drive),

    chooseOutputFolder: () =>
        ipcRenderer.invoke('choose-output-folder'),

    startScan: (devicePath, outputDir) =>
        ipcRenderer.invoke('start-scan', devicePath, outputDir),

    cancelScan: () =>
        ipcRenderer.invoke('cancel-scan'),

    showInFolder: (filePath) =>
        ipcRenderer.invoke('show-in-folder', filePath),

    downloadClip: (devicePath, offset, length, suggestedName) =>
        ipcRenderer.invoke('download-clip', devicePath, offset, length, suggestedName),

    // Build a teslacam:// URL for in-app video preview (handled by protocol in main.js)
    getClipUrl: (devicePath, offset, length) =>
        `teslacam://clip?device=${encodeURIComponent(devicePath)}&offset=${offset}&length=${length}`,

    // Scan event listeners — call before startScan
    onScanStatus:    (cb) => ipcRenderer.on('scan-status',    (_, d) => cb(d)),
    onScanGeometry:  (cb) => ipcRenderer.on('scan-geometry',  (_, d) => cb(d)),
    onScanProgress:  (cb) => ipcRenderer.on('scan-progress',  (_, d) => cb(d)),
    onScanFound:     (cb) => ipcRenderer.on('scan-found',     (_, d) => cb(d)),
    onScanDone:      (cb) => ipcRenderer.on('scan-done',      (_, d) => cb(d)),
    onScanError:     (cb) => ipcRenderer.on('scan-error',     (_, d) => cb(d)),
    onSaveProgress:  (cb) => ipcRenderer.on('save-progress',  (_, d) => cb(d)),

    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
