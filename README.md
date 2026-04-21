# Tesla Dashcam Recovery

A cross-platform desktop app (Electron) that recovers deleted dashcam clips directly from a Tesla USB drive by scanning the raw FAT32/exFAT filesystem.

## How it works

1. Detects connected removable drives
2. Unmounts the selected drive to gain raw device access
3. Reads the FAT32/exFAT geometry (sector size, cluster size, etc.)
4. Scans every cluster for MP4 file signatures
5. Extracts and saves recovered clips to a folder you choose

## Download & use

Download the latest installer for your platform from the [Releases](../../releases/latest) page:

- **macOS** — `.dmg`
- **Windows** — `.exe`
- **Linux** — `.AppImage`

**Platform-specific permissions:**
- **macOS** — eject the drive in Finder before scanning (keeps it physically connected)
- **Linux** — run with `sudo` or add your user to the `disk` group
- **Windows** — run as Administrator

## Requirements (development)

- Node.js 22+
- macOS, Windows, or Linux

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

## Release

Releases are published automatically via GitHub Actions when a draft release is created with a valid tag.

1. Go to **GitHub → Releases → Draft a new release**
2. Create a new tag in `vMAJOR.MINOR.PATCH` format (e.g. `v1.2.3`) — must be strictly higher than the latest published release
3. Save as **draft**
4. The pipeline will automatically:
   - Validate the semver tag and version bump
   - Run lint and tests
   - Build `.dmg` (macOS), `.exe` (Windows), and `.AppImage` (Linux)
   - Attach all artifacts and publish the release

## Project structure

```
main.js       Electron main process — drive listing, unmount, IPC, custom teslacam:// protocol
preload.js    Context bridge — exposes safe API to renderer
worker.js     Worker thread — raw device scan (FAT32/exFAT parser + MP4 signature detection)
index.html    Renderer UI — single-file, no framework
```
