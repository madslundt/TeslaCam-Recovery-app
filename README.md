# Tesla Dashcam Recovery

A cross-platform desktop app (Electron) that recovers deleted dashcam clips directly from a Tesla USB drive by scanning the raw FAT32/exFAT filesystem.

## How it works

1. Detects connected removable drives
2. Unmounts the selected drive to gain raw device access
3. Reads the FAT32/exFAT geometry (sector size, cluster size, etc.)
4. Scans every cluster for MP4 file signatures
5. Extracts and saves recovered clips to a folder you choose

## Download & use

1. Go to the [Releases](../../releases/latest) page and download the installer for your platform:
   - **macOS** — `.dmg` — open and drag the app to Applications, then launch it
   - **Windows** — `.exe` — run the installer, then launch from the Start menu
   - **Linux** — `.AppImage` — make it executable (`chmod +x *.AppImage`) and run it

2. Plug in your Tesla USB drive.

3. Open the app, select the drive, choose an output folder, and start the scan.

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

## Release process

Releases are published automatically via GitHub Actions.

1. Bump the version in `package.json` and commit to `master`
2. Go to **GitHub → Releases → Draft a new release**
3. Click **Choose a tag**, type a new tag in `vMAJOR.MINOR.PATCH` format (e.g. `v1.2.3`), and select **Create new tag on publish** — the version must be strictly higher than the latest published release
4. Fill in the release title and notes, then click **Save draft** (do **not** publish yet)
5. The pipeline triggers automatically and will:
   - Validate the semver tag format and ensure the version is higher than the last release
   - Run lint and unit tests
   - Build `.dmg` (macOS), `.exe` (Windows), and `.AppImage` (Linux) in parallel
   - Attach all artifacts and publish the release

## Project structure

```
main.js       Electron main process — drive listing, unmount, IPC, custom teslacam:// protocol
preload.js    Context bridge — exposes safe API to renderer
worker.js     Worker thread — raw device scan (FAT32/exFAT parser + MP4 signature detection)
index.html    Renderer UI — single-file, no framework
```
