export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function removeExtension(name) {
  return name.replace(/\.[^/.]+$/, '');
}

export function getFileName(path) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

export function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

export function uniqueByName(items) {
  const map = new Map();

  for (const item of items) {
    if (!map.has(item.name)) map.set(item.name, item);
  }

  return Array.from(map.values());
}

export function nextPowerOfTwo(value) {
  return 2 ** Math.ceil(Math.log2(Math.max(1, value)));
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
