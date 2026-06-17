import { unique, uniqueByName } from '../utils/index.js';

export function parseAtlas(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const pages = [];
  const regions = [];
  let currentRegion = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const next = lines[i + 1]?.trim() || '';

    if (!line) continue;

    if (isAtlasPageLine(line, next)) {
      pages.push(line);
      currentRegion = null;
      continue;
    }

    if (!line.includes(':')) {
      currentRegion = { name: line, index: -1 };
      regions.push(currentRegion);
      continue;
    }

    if (currentRegion && line.startsWith('index:')) {
      const value = Number(line.split(':')[1].trim());
      currentRegion.index = Number.isFinite(value) ? value : -1;
    }
  }

  return { pages: unique(pages), regions: uniqueByName(regions) };
}

function isAtlasPageLine(line, nextLine) {
  return Boolean(
    line &&
    !line.includes(':') &&
    /\.(png|jpg|jpeg|webp)$/i.test(line) &&
    /^(size|format|filter|repeat|pma):/i.test(nextLine)
  );
}
