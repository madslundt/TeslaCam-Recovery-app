# App Icon Design — TeslaCam Recovery

## Summary

Design and implement the dock/taskbar application icon for TeslaCam Recovery (Electron app).

## Design

**Concept:** Recovery arrow + solid play triangle — communicates "restore video" at a glance.

**Visual spec:**
- Background: rounded square, `#313244` (dark slate)
- Foreground: `#cdd6f4` (soft white-blue)
- A circular recovery arrow (≈ 300° arc) with a filled arrowhead at the tail
- A solid play triangle (▶) centered inside the arc
- No brand colours — neutral, platform-native feeling

**SVG reference (96×96 viewport):**
```svg
<rect width="96" height="96" rx="22" fill="#313244"/>
<path d="M48 18 A30 30 0 1 1 22 62" stroke="#cdd6f4" stroke-width="5" stroke-linecap="round" fill="none"/>
<polygon points="14,52 21,68 31,56" fill="#cdd6f4"/>
<polygon points="40,36 40,60 62,48" fill="#cdd6f4"/>
```

## Implementation

Electron-builder reads icons from the `build/` directory. A single high-resolution PNG at `build/icon.png` (1024×1024) is sufficient — electron-builder auto-converts it to `.icns` (macOS) and `.ico` (Windows) during the build.

**Files to create:**
- `build/icon.svg` — source SVG at 1024×1024
- `build/icon.png` — rasterised at 1024×1024 (generated from SVG via `sips` or `rsvg-convert`)

**Steps:**
1. Write `build/icon.svg` (scaled-up version of the approved design)
2. Convert SVG → PNG at 1024×1024 using available macOS tooling (`qlmanage`, `rsvg-convert`, or a Node script with `sharp`)
3. Verify electron-builder picks it up (no config changes needed — default path)
4. Run `npm run build:mac` to confirm `.icns` is generated and the app icon appears in the Dock

## Out of scope

- Changing the in-app header SVG icon (separate concern)
- Custom icons per platform (one unified design)
