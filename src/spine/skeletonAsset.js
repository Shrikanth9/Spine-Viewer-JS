const JSON_START_TOKENS = new Set([123, 91]); // { or [
const UTF8_BOM_AND_SPACE = new Set([0xef, 0xbb, 0xbf, 9, 10, 13, 32]);

export async function readSkeletonAssetFromFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (!looksLikeBinarySkeleton(file, bytes)) {
    const text = new TextDecoder('utf-8').decode(bytes);
    let json;

    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new Error(`${file.name} looks like JSON text but could not be parsed: ${error.message}`);
    }

    validateSpineSkeletonJson(file, json);
    return json;
  }

  return bytes;
}

function looksLikeBinarySkeleton(file, bytes) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'json') return false;
  if (extension === 'skel') return true;

  for (const byte of bytes) {
    if (UTF8_BOM_AND_SPACE.has(byte)) continue;
    return !JSON_START_TOKENS.has(byte);
  }

  return false;
}

function validateSpineSkeletonJson(file, json) {
  if (json.frames && json.meta && !json.bones && !json.skeleton) {
    throw new Error(`${file.name} looks like a TexturePacker spritesheet JSON. Upload it in the Spritesheets section.`);
  }

  if (!json.skeleton && !json.bones) {
    throw new Error(`${file.name} does not look like a Spine skeleton JSON. Expected skeleton/bones data.`);
  }
}
