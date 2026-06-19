import { Texture } from 'pixi.js';
import { getFileName, nextPowerOfTwo, removeExtension, unique } from '../utils/index.js';

let state;
let renderImageReport;

export function configureTextureAtlasBuilder(context) {
  state = context.state;
  renderImageReport = context.renderImageReport;
}

function getHighQualityCanvasContext(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create 2D canvas context for texture generation.');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

export async function buildTextureAtlasForSelectedSource(atlasText, atlasInfo) {
  const mode = state.textureSourceMode || 'sprites';

  if (mode === 'spritesheets') {
    return buildTextureAtlasFromSpritesheets(atlasText, atlasInfo);
  }

  const result = await buildLooseImageAtlasFromUploads(atlasInfo.regions);
  return {
    atlasUrl: result.atlasUrl,
    atlasText: result.atlasText,
    atlasData: { images: { [result.pageName]: result.imageSource || result.imageUrl } },
    imageMode: 'sprite images'
  };
}

async function buildTextureAtlasFromSpritesheets(atlasText, atlasInfo) {
  const library = await loadUploadedSpritesheetLibrary();
  if (!library.length) {
    throw new Error('No valid spritesheet JSON found. Upload the TexturePacker spritesheet .json and its matching image.');
  }

  if (!atlasInfo.regions.length) {
    throw new Error('Spritesheet mode needs atlas regions to map frames. Check the uploaded Spine .atlas file.');
  }

  // TexturePacker frames are normalized into one runtime atlas page so Spine can
  // resolve attachments through the same path used by loose sprite uploads.
  const result = await buildLooseImageAtlasFromSpritesheetRegions(atlasInfo.regions, library);
  return {
    atlasUrl: result.atlasUrl,
    atlasText: result.atlasText,
    atlasData: { images: { [result.pageName]: result.imageSource || result.imageUrl } },
    imageMode: 'spritesheet frames extracted to generated atlas'
  };
}

function getSpritesheetMultipackHint(library) {
  const related = unique(library.flatMap((sheet) => sheet.relatedMultiPacks || []));
  if (!related.length) return '';

  const uploadedNames = new Set(state.uploadedSpritesheetFiles.map((file) => file.name.toLowerCase()));
  const notUploaded = related.filter((name) => !uploadedNames.has(getFileName(name).toLowerCase()));

  if (!notUploaded.length) return '';
  return ` Upload related multipack JSON/images also: ${notUploaded.join(', ')}.`;
}

async function buildLooseImageAtlasFromSpritesheetRegions(regions, library) {
  const loadedRegions = [];
  const report = [];

  for (const region of regions) {
    const match = findSpritesheetFrame(region.name, library);
    if (!match) {
      report.push({ name: region.name, url: 'spritesheet json', status: 'error', note: 'missing region frame' });
      continue;
    }

    const image = extractSpritesheetFrameToCanvas(match.sheet.image, match.frame);
    loadedRegions.push({ ...region, image });
    report.push({ name: region.name, url: `${match.sheet.imageName} :: ${match.frame.name}`, status: 'ok', note: 'spritesheet region frame' });
  }

  if (loadedRegions.length !== regions.length) {
    state.lastImageReport = report;
    renderImageReport();
    const missing = report
      .filter((item) => item.status !== 'ok')
      .slice(0, 8)
      .map((item) => item.name)
      .join(', ');
    throw new Error(`Spritesheet JSON did not match atlas page names or atlas region names. Missing examples: ${missing || 'unknown'}.`);
  }

  return buildGeneratedAtlasFromLoadedRegions(loadedRegions, report, '__generated_spritesheet_regions.png');
}

async function loadUploadedSpritesheetLibrary() {
  const jsonFiles = state.uploadedSpritesheetFiles.filter((file) => file.name.toLowerCase().endsWith('.json'));
  const library = [];

  for (const jsonFile of jsonFiles) {
    let json;
    try {
      json = JSON.parse(await jsonFile.text());
    } catch (error) {
      console.warn(`Invalid spritesheet JSON: ${jsonFile.name}`, error);
      continue;
    }

    const imageName = getSpritesheetImageName(jsonFile.name, json);
    const imageFile = findUploadedFileByName(imageName) || findUploadedSpritesheetImageByBaseName(removeExtension(jsonFile.name));
    if (!imageFile) {
      console.warn(`Spritesheet image not found for ${jsonFile.name}. Expected ${imageName}`);
      continue;
    }

    const imageUrl = URL.createObjectURL(imageFile);
    state.objectUrls.push(imageUrl);
    const image = await loadImage(imageUrl);
    const frames = normaliseSpritesheetFrames(json.frames || []);
    const metaSize = json?.meta?.size || {};
    const relatedMultiPacks = Array.isArray(json?.meta?.related_multi_packs) ? json.meta.related_multi_packs : [];
    library.push({
      jsonFile,
      image,
      imageName: imageFile.name,
      imageUrl,
      imageSource: Texture.from(image).source,
      frames,
      width: Number(metaSize.w ?? metaSize.width ?? image.naturalWidth ?? image.width),
      height: Number(metaSize.h ?? metaSize.height ?? image.naturalHeight ?? image.height),
      relatedMultiPacks
    });
  }

  return library;
}

function getSpritesheetImageName(jsonFileName, json) {
  const image = json?.meta?.image;
  if (image) return getFileName(image);
  return `${removeExtension(jsonFileName)}.png`;
}

function findUploadedSpritesheetImageByBaseName(baseName) {
  const extensions = ['png', 'webp', 'jpg', 'jpeg'];
  return state.uploadedSpritesheetFiles.find((file) => {
    const lower = file.name.toLowerCase();
    return extensions.some((ext) => lower === `${baseName.toLowerCase()}.${ext}`);
  });
}

function normaliseSpritesheetFrames(frames) {
  if (Array.isArray(frames)) {
    return frames.map((item) => ({ name: item.filename || item.name, ...item })).filter((item) => item.name);
  }

  return Object.entries(frames).map(([name, value]) => ({ name, ...value }));
}

function findSpritesheetFrame(regionName, library) {
  const candidates = buildFrameNameCandidates(regionName);

  for (const sheet of library) {
    const frame = sheet.frames.find((item) => {
      const frameCandidates = buildFrameNameCandidates(String(item.name));
      return Array.from(frameCandidates).some((candidate) => candidates.has(candidate));
    });
    if (frame) return { sheet, frame };
  }

  return null;
}

function buildFrameNameCandidates(name) {
  const withoutQuery = String(name).split('?')[0];
  const fileName = getFileName(withoutQuery);
  const noExt = removeExtension(withoutQuery);
  const fileNoExt = removeExtension(fileName);
  const values = [
    withoutQuery,
    fileName,
    noExt,
    fileNoExt,
    `${withoutQuery}.png`,
    `${fileName}.png`,
    `${noExt}.png`,
    `${fileNoExt}.png`,
    `${withoutQuery}.webp`,
    `${fileName}.webp`,
    `${noExt}.webp`,
    `${fileNoExt}.webp`,
    `${withoutQuery}.jpg`,
    `${fileName}.jpg`,
    `${noExt}.jpg`,
    `${fileNoExt}.jpg`,
    `${withoutQuery}.jpeg`,
    `${fileName}.jpeg`,
    `${noExt}.jpeg`,
    `${fileNoExt}.jpeg`
  ];

  return new Set(values.map(normaliseFrameName).filter(Boolean));
}

function normaliseFrameName(name) {
  return String(name)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim()
    .toLowerCase();
}

function extractSpritesheetFrameToCanvas(sheetImage, frameData) {
  const f = frameData.frame || frameData;
  const sx = Number(f.x ?? 0);
  const sy = Number(f.y ?? 0);
  const sw = Number(f.w ?? f.width ?? 0);
  const sh = Number(f.h ?? f.height ?? 0);
  const rotated = Boolean(frameData.rotated || frameData.rotate);

  if (!sw || !sh) {
    throw new Error(`Invalid spritesheet frame size for ${frameData.name || 'unknown frame'}.`);
  }

  const sourceSize = frameData.sourceSize || {};
  const spriteSourceSize = frameData.spriteSourceSize || {};
  const drawnWidth = Number(spriteSourceSize.w ?? spriteSourceSize.width ?? (rotated ? sh : sw));
  const drawnHeight = Number(spriteSourceSize.h ?? spriteSourceSize.height ?? (rotated ? sw : sh));

  const canvas = document.createElement('canvas');
  canvas.width = Number(sourceSize.w ?? sourceSize.width ?? drawnWidth);
  canvas.height = Number(sourceSize.h ?? sourceSize.height ?? drawnHeight);

  const dx = Number(spriteSourceSize.x ?? 0);
  const dy = Number(spriteSourceSize.y ?? 0);
  const ctx = getHighQualityCanvasContext(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!rotated) {
    ctx.drawImage(sheetImage, sx, sy, sw, sh, dx, dy, drawnWidth, drawnHeight);
    return canvas;
  }

  // TexturePacker stores rotated frames clockwise in the packed sheet.
  // When extracting into an upright canvas, undo that by rotating the cropped
  // sheet rectangle counter-clockwise. Using the opposite direction makes many
  // frames look flipped/upside-down in Spine animations.
  const packedWidth = sh;
  const packedHeight = sw;
  ctx.save();
  ctx.translate(dx, dy + drawnHeight);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(sheetImage, sx, sy, packedWidth, packedHeight, 0, 0, drawnHeight, drawnWidth);
  ctx.restore();

  return canvas;
}

async function buildGeneratedAtlasFromLoadedRegions(loadedRegions, report, pageName = '__generated_regions.png') {
  const padding = 2;
  const maxWidth = 2048;
  let x = padding;
  let y = padding;
  let rowHeight = 0;
  let canvasWidth = 0;

  for (const region of loadedRegions) {
    const width = region.image.naturalWidth || region.image.width;
    const height = region.image.naturalHeight || region.image.height;

    if (x + width + padding > maxWidth) {
      x = padding;
      y += rowHeight + padding;
      rowHeight = 0;
    }

    region.packed = { x, y, width, height };
    x += width + padding;
    rowHeight = Math.max(rowHeight, height);
    canvasWidth = Math.max(canvasWidth, x + padding);
  }

  const canvasHeight = nextPowerOfTwo(y + rowHeight + padding);
  const finalCanvasWidth = nextPowerOfTwo(Math.max(64, Math.min(maxWidth, canvasWidth)));
  const canvas = document.createElement('canvas');
  canvas.width = finalCanvasWidth;
  canvas.height = canvasHeight;
  const ctx = getHighQualityCanvasContext(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const region of loadedRegions) {
    ctx.drawImage(region.image, region.packed.x, region.packed.y);
  }

  const imageUrl = canvas.toDataURL('image/png');
  const imageSource = Texture.from(canvas).source;
  const atlasText = makeGeneratedAtlasText(pageName, canvas.width, canvas.height, loadedRegions);
  const atlasUrl = createObjectUrl(atlasText, 'text/plain');
  state.lastImageReport = report;

  return { atlasUrl, atlasText, imageUrl, imageSource, pageName, report };
}

async function buildLooseImageAtlasFromUploads(regions) {
  if (!regions.length) {
    throw new Error('Loose-image fallback requires regions to be present in uploaded files.');
  }

  const loadedRegions = [];
  const report = [];

  for (const region of regions) {
    const uploaded = await loadUploadedRegionImage(region.name);
    if (!uploaded) {
      report.push({ name: region.name, url: `${region.name}.[png|webp|jpg|jpeg]`, status: 'error', note: 'missing uploaded image' });
      continue;
    }
    loadedRegions.push({ ...region, image: uploaded.image, sourceUrl: uploaded.url });
    report.push({ name: region.name, url: uploaded.url, status: 'ok', note: '' });
  }

  if (loadedRegions.length !== regions.length) {
    state.lastImageReport = report;
    renderImageReport();
    throw new Error('Not all atlas regions have matching uploaded images. Upload all referenced images before loading.');
  }

  const padding = 2;
  const maxWidth = 2048;
  let x = padding;
  let y = padding;
  let rowHeight = 0;
  let canvasWidth = 0;

  for (const region of loadedRegions) {
    const width = region.image.naturalWidth || region.image.width;
    const height = region.image.naturalHeight || region.image.height;

    if (x + width + padding > maxWidth) {
      x = padding;
      y += rowHeight + padding;
      rowHeight = 0;
    }

    region.packed = { x, y, width, height };
    x += width + padding;
    rowHeight = Math.max(rowHeight, height);
    canvasWidth = Math.max(canvasWidth, x + padding);
  }

  const canvasHeight = nextPowerOfTwo(y + rowHeight + padding);
  const finalCanvasWidth = nextPowerOfTwo(Math.max(64, Math.min(maxWidth, canvasWidth)));
  const canvas = document.createElement('canvas');
  canvas.width = finalCanvasWidth;
  canvas.height = canvasHeight;
  const ctx = getHighQualityCanvasContext(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const region of loadedRegions) {
    ctx.drawImage(region.image, region.packed.x, region.packed.y);
  }

  const pageName = '__generated_loose_images.png';
  const imageUrl = canvas.toDataURL('image/png');
  const imageSource = Texture.from(canvas).source;
  const atlasText = makeGeneratedAtlasText(pageName, canvas.width, canvas.height, loadedRegions);
  const atlasUrl = createObjectUrl(atlasText, 'text/plain');
  state.lastImageReport = report;

  return { atlasUrl, atlasText, imageUrl, imageSource, pageName, report };
}

function findUploadedFileByName(fileName) {
  return state.uploadedFiles.find((file) => file.name === fileName);
}

async function loadUploadedRegionImage(baseName) {
  const extensions = ['png', 'webp', 'jpg', 'jpeg'];
  for (const ext of extensions) {
    const file = state.uploadedFiles.find((item) => item.name.toLowerCase() === `${baseName.toLowerCase()}.${ext}`);
    if (file) {
      const url = URL.createObjectURL(file);
      state.objectUrls.push(url);
      const image = await loadImage(url);
      return { image, url };
    }
  }
  return null;
}

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image could not be loaded: ${url}`));
    image.src = url.startsWith('blob:') || url.startsWith('data:')
      ? url
      : `${url}?v=${Date.now()}`;
  });
}

function createObjectUrl(content, mimeType) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  state.objectUrls.push(url);
  return url;
}

function makeGeneratedAtlasText(pageName, width, height, regions) {
  const lines = [
    pageName,
    `size: ${width},${height}`,
    'format: RGBA8888',
    'filter: Linear,Linear',
    'repeat: none'
  ];

  for (const region of regions) {
    const p = region.packed;
    lines.push(
      region.name,
      '  rotate: false',
      `  xy: ${p.x}, ${p.y}`,
      `  size: ${p.width}, ${p.height}`,
      `  orig: ${p.width}, ${p.height}`,
      '  offset: 0, 0',
      `  index: ${Number.isFinite(region.index) ? region.index : -1}`
    );
  }

  return `${lines.join('\n')}\n`;
}
