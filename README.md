# Tesla Dashcam Recovery

A cross-platform desktop app (Electron) that recovers deleted dashcam clips directly from a Tesla USB drive by scanning the raw FAT32/exFAT filesystem.

## How it works

1. Detects connected removable drives
2. Unmounts the selected drive to gain raw device access
3. Reads the FAT32/exFAT geometry (sector size, cluster size, etc.)
4. Scans every cluster for MP4 file signatures
5. Extracts and saves recovered clips to a folder you choose

## Requirements

- Node.js 18+
- macOS, Windows, or Linux

**Platform-specific permissions:**
- **macOS** — eject the drive in Finder before scanning (keeps it physically connected)
- **Linux** — run with `sudo` or add your user to the `disk` group
- **Windows** — run as Administrator

## Install & run

```bash
npm install
npm start
```

## Build

```bash
# Current platform
npm run build

# Specific platforms
npm run build:mac    # universal DMG
npm run build:win    # NSIS installer (requires Administrator)
npm run build:linux  # AppImage
```

## Project structure

```
main.js       Electron main process — drive listing, unmount, IPC, custom teslacam:// protocol
preload.js    Context bridge — exposes safe API to renderer
worker.js     Worker thread — raw device scan (FAT32/exFAT parser + MP4 signature detection)
index.html    Renderer UI — single-file, no framework
```
