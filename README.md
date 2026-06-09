# Spine Viewer JS

Browser-based Spine viewer that loads Spine skeleton, atlas, and image files at runtime via user upload, rendered with JavaScript, PixiJS 8, and the official `@esotericsoftware/spine-pixi-v8` runtime.

## Expected workflow

User uploads Spine runtime files in two steps:

1. Upload skeleton and atlas files together:

```txt
bonus_game_activated.json
bonus_game_activated.atlas
```

2. Upload image files separately:

```txt
bonus_game_activated.png
```

The app requires uploaded atlas and image files and does not fall back to `public/spine` or `public/images`.

The production build now outputs static bundles under:

```txt
dist/static/
```

## Folder structure

```txt
public/
  spine/
    bonus_game_activated.atlas
  images/
    bonus_game_activated.png
    any_other_page_or_region.png
```

## Image loading behavior

The app tries two automatic image strategies:

1. **Packed atlas page mode**: uses image page names from the `.atlas`, for example `bonus_game_activated.png`.
2. **Loose image autopack mode**: if packed page images are missing/invalid, it reads region names from the `.atlas` and loads uploaded files matching those names, then creates a temporary packed canvas atlas in the browser.

This keeps the UI simple: upload the Spine runtime files you want to view.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL.

## Features

- Upload `.json` or `.spine` skeleton plus matching `.atlas` and image files.
- No automatic fallback to public Spine assets.
- Animation list and playback.
- Skin switching.
- Replaceable slot marking.
- Export marked slots as JSON.

## Important

The official Spine runtime version must match the Spine editor export version. This project uses `@esotericsoftware/spine-pixi-v8 ~4.2.0`. If your skeleton was exported from a different Spine major/minor version, update the runtime version accordingly.
