# Spine Viewer JS

Browser-based Spine viewer that loads Spine skeleton, atlas, and texture files at runtime via user upload, rendered with JavaScript, PixiJS 8, and `@esotericsoftware/spine-pixi-v8`.

## Expected workflow

1. Upload the Spine skeleton and atlas together:

```txt
main_layout_spine.json
main_layout_spine.atlas
```

2. Choose the texture source:

- **Sprites**: upload loose images where image names match atlas region names.
- **Spritesheets**: upload TexturePacker spritesheet `.json` plus its matching image. For multipacks, upload all related JSON + PNG files together.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL.

## Build

```bash
npm run build
```

The production build outputs static bundles under `dist/`.

## Features

- Upload `.json`, `.spine`, or `.skel` skeleton plus matching `.atlas`. `.spine` files are auto-detected as JSON or binary by content, not only by extension.
- Texture source selector: loose sprites or spritesheet JSON + image.
- Slot and attachment inspector.
- Spine bounds, slot transform points, and attachment bounds preview.
- Animation playback with selectable Spine track number.
- Multiple animations can play together on different tracks.
- Higher track numbers naturally override lower tracks when both animate the same bone/slot, matching Spine runtime behavior.
- Active track list showing track number, animation name, loop status, and progress percentage.
- Clear selected track or clear all tracks.
- Skin switching.
- RM slot auto-marking: click an `rm_` slot to toggle its transform marker. No separate Mark button.
- Event log.

## Important

The Spine runtime version must match the Spine editor export version. This project uses `@esotericsoftware/spine-pixi-v8`. If your skeleton was exported from a different Spine major/minor version, update the runtime version accordingly.


## Important run note

- For development, run `npm run dev` and open the root URL shown by Vite, usually `http://localhost:5173/`. Do not open `/dist/index.html` through the dev server.
- For production build testing, run `npm run build` and then `npm run preview`.
- Vite `base` is set to `./` so the built `dist/index.html` uses relative `./static/...` asset paths. This avoids missing `/static/index-*.js` errors when opening the build from a subfolder.
