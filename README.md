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

Releases are automated via GitHub Actions and triggered by pushing a version tag.

1. Decide the new version number following [semver](https://semver.org/) — `MAJOR.MINOR.PATCH`. It must be strictly higher than the latest published release.

2. Make sure all changes are committed and pushed to `master`.

3. Tag the commit and push the tag:

   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

4. The release workflow starts automatically and will:
   - Validate the tag matches `vMAJOR.MINOR.PATCH` format
   - Verify the version is higher than the latest published release
   - Run linting and all tests
   - Build executables in parallel for macOS (`.dmg`), Windows (`.exe`), and Linux (`.AppImage`)
   - Create and publish the GitHub release with all artifacts attached

5. Monitor progress under **Actions** in the repository.

### If the release fails

Delete the tag, fix the issue, commit, then re-tag:

```bash
git tag -d v1.2.3
git push origin --delete v1.2.3
# fix, commit, push...
git tag v1.2.3
git push origin v1.2.3
```

### Version validation rules

- Tag must match the pattern `vX.Y.Z` (e.g. `v1.2.0`)
- The version must be strictly greater than the latest published release — patch, minor, or major bump all work; re-releasing the same or lower version will fail

## Project structure

```
main.js       Electron main process — drive listing, unmount, IPC, custom teslacam:// protocol
preload.js    Context bridge — exposes safe API to renderer
worker.js     Worker thread — raw device scan (FAT32/exFAT parser + MP4 signature detection)
index.html    Renderer UI — single-file, no framework
```
