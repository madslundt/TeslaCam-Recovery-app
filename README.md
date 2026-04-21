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

## Test & lint

```bash
npm test       # run unit tests
npm run lint   # run ESLint
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

Releases are automated via GitHub Actions and triggered by creating a **draft** release with a version tag.

1. Decide the new version number following [semver](https://semver.org/) — `MAJOR.MINOR.PATCH`. It must be strictly higher than the latest published release.

2. Go to **GitHub → Releases → Draft a new release**.

3. Enter the tag in the **Choose a tag** field (e.g. `1.2.0` or `v1.2.0`). Create it pointing at the commit you want to release.

4. Fill in the release title and description/changelog.

5. Check **Set as a draft release** and click **Save draft**. Do **not** click "Publish release".

6. The release workflow starts automatically and will:
   - Validate the tag matches `major.minor.patch` format
   - Verify the version is higher than the latest published release
   - Run linting and all tests
   - Build executables in parallel for macOS (`.dmg`), Windows (`.exe`), and Linux (`.AppImage`)
   - Attach the built files to the release
   - Publish the release (remove draft status)

7. Monitor progress under **Actions** in the repository. If any step fails, the release stays as a draft so you can fix the issue and retry.

### Version validation rules

- Tag must match the pattern `X.Y.Z` (the leading `v` is optional, e.g. both `1.2.0` and `v1.2.0` are accepted)
- The version must be strictly greater than the latest published release — patch, minor, or major bump all work; re-releasing the same or lower version will fail

## Project structure

```
main.js       Electron main process — drive listing, unmount, IPC, custom teslacam:// protocol
preload.js    Context bridge — exposes safe API to renderer
worker.js     Worker thread — raw device scan (FAT32/exFAT parser + MP4 signature detection)
index.html    Renderer UI — single-file, no framework
```
