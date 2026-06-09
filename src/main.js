import './style.css';
import { Application, Assets, Container, Graphics } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';

const state = {
  app: null,
  spine: null,
  spineLayer: new Container(),
  markerObjects: new Map(),
  markedSlots: new Set(),
  objectUrls: [],
  lastImageReport: [],
  uploadedSkeletonFiles: [],
  uploadedImageFiles: [],
  uploadedFiles: [],
  playbackSpeed: 1,
  isPaused: false,
  isScrubbing: false,
  wasPausedBeforeScrub: false,
  requestedLoopCount: 0,
  currentLoopCount: 0,
  eventLog: [],
  rootMotionPreview: false,
  zoom: 1,
  zoomBase: 1,
  isPanning: false,
  panStart: { x: 0, y: 0 },
  panOrigin: { x: 0, y: 0 }
};

const appRoot = document.querySelector('#app');
appRoot.innerHTML = `
  <aside class="panel">
    <h1>Spine Viewer JS</h1>
    <label>Spine files (skeleton .json/.spine, .atlas)</label>
    <input id="skeletonInput" type="file" accept=".json,.spine,.atlas" multiple />

    <label>Image files (.png, .jpg, .jpeg, .webp)</label>
    <input id="imageInput" type="file" accept=".png,.jpg,.jpeg,.webp" multiple />

    <label for="uploadedSkeletonSelect">Select uploaded spine skeleton</label>
    <select id="uploadedSkeletonSelect"></select>

    <h2>Animation</h2>
    <select id="animationSelect"></select>
    <div class="button-grid">
      <button type="button" id="playBtn">Play</button>
      <button type="button" id="pauseBtn" class="secondary">Pause</button>
    </div>
    <div class="button-grid">
      <button type="button" id="prevFrameBtn" class="secondary">Prev Frame</button>
      <button type="button" id="nextFrameBtn" class="secondary">Next Frame</button>
    </div>
    <label>Playback speed: <span id="speedValue">1.00x</span></label>
    <input id="speedRange" type="range" min="0.1" max="3" value="1" step="0.1" />
    <label>Timeline <span id="timelineTime">0.00 / 0.00</span></label>
    <input id="timelineRange" type="range" min="0" max="1" value="0" step="0.001" />
    <label>Loop count (0 = infinite)</label>
    <input id="loopCount" type="number" min="0" value="0" />
    <div class="checkbox-row">
      <label><input id="loopCheckbox" type="checkbox"/> Loop</label>
      <label><input id="showRootMotion" type="checkbox"/> Root motion preview (root bone world transform)</label>
    </div>
    <div id="rootMotionInfo" class="small"></div>
    <button type="button" id="setupPoseBtn" class="secondary">Setup Pose</button>

    <h2>Skin</h2>
    <select id="skinSelect"></select>

    <h2>View</h2>
    <label for="zoomRange">Zoom (wheel or slider): <span id="zoomValue">100%</span></label>
    <input id="zoomRange" type="range" min="10" max="180" value="100" step="1" />

    <h2>Replaceable Slots</h2>
    <p class="small">Mark slots that can be replaced/reskinned. Markers follow the slot transform.</p>
    <div id="slotList" class="list"></div>
    <button type="button" id="clearMarksBtn" class="danger">Clear Marks</button>

    <h2>Image Detection</h2>
    <div id="imageList" class="small"></div>

    <h2>Events</h2>
    <div id="eventLog" class="small list"></div>

    <div id="status" class="status">Ready.</div>
  </aside>
  <main id="viewer" class="viewer"></main>
`;

const els = {
  viewer: document.querySelector('#viewer'),
  skeletonInput: document.querySelector('#skeletonInput'),
  imageInput: document.querySelector('#imageInput'),
  uploadedSkeletonSelect: document.querySelector('#uploadedSkeletonSelect'),
  animationSelect: document.querySelector('#animationSelect'),
  playBtn: document.querySelector('#playBtn'),
  pauseBtn: document.querySelector('#pauseBtn'),
  prevFrameBtn: document.querySelector('#prevFrameBtn'),
  nextFrameBtn: document.querySelector('#nextFrameBtn'),
  speedRange: document.querySelector('#speedRange'),
  speedValue: document.querySelector('#speedValue'),
  timelineRange: document.querySelector('#timelineRange'),
  timelineTime: document.querySelector('#timelineTime'),
  loopCount: document.querySelector('#loopCount'),
  showRootMotion: document.querySelector('#showRootMotion'),
  rootMotionInfo: document.querySelector('#rootMotionInfo'),
  setupPoseBtn: document.querySelector('#setupPoseBtn'),
  skinSelect: document.querySelector('#skinSelect'),
  loopCheckbox: document.querySelector('#loopCheckbox'),
  zoomRange: document.querySelector('#zoomRange'),
  zoomValue: document.querySelector('#zoomValue'),
  slotList: document.querySelector('#slotList'),
  clearMarksBtn: document.querySelector('#clearMarksBtn'),
  imageList: document.querySelector('#imageList'),
  eventLog: document.querySelector('#eventLog'),
  status: document.querySelector('#status')
};

boot();

async function boot() {
  state.app = new Application();
  await state.app.init({ resizeTo: els.viewer, background: '#10131a', antialias: true });
  els.viewer.appendChild(state.app.canvas);
  state.app.stage.addChild(state.spineLayer);

  renderUploadedSkeletonOptions();
  els.skeletonInput.addEventListener('change', handleUploadedSkeletonFilesChange);
  els.imageInput.addEventListener('change', handleUploadedImageFilesChange);
  els.uploadedSkeletonSelect.addEventListener('change', loadSelectedSkeletonFromUploads);
  els.animationSelect?.addEventListener('change', playSelectedAnimation);
  els.playBtn?.addEventListener('click', playSelectedAnimation);
  els.pauseBtn?.addEventListener('click', togglePause);
  els.prevFrameBtn?.addEventListener('click', () => stepAnimationFrame(-1));
  els.nextFrameBtn?.addEventListener('click', () => stepAnimationFrame(1));
  els.speedRange?.addEventListener('input', onSpeedChange);
  els.timelineRange?.addEventListener('input', onTimelineChange);
  els.timelineRange?.addEventListener('pointerdown', onTimelineScrubStart);
  els.timelineRange?.addEventListener('pointerup', onTimelineScrubEnd);
  els.timelineRange?.addEventListener('change', onTimelineScrubEnd);
  els.loopCount?.addEventListener('input', onLoopCountChange);
  els.showRootMotion?.addEventListener('change', onRootMotionToggle);
  els.setupPoseBtn.addEventListener('click', setupPose);
  els.skinSelect.addEventListener('change', applySelectedSkin);
  els.loopCheckbox?.addEventListener('change', updateCurrentTrackLoop);
  els.zoomRange.addEventListener('input', onZoomChange);
  els.viewer.addEventListener('wheel', onViewerWheel, { passive: false });
  els.viewer.addEventListener('pointerdown', onViewerPointerDown);
  window.addEventListener('pointermove', onViewerPointerMove);
  window.addEventListener('pointerup', onViewerPointerUp);
  window.addEventListener('pointercancel', onViewerPointerUp);
  state.app.ticker.add(onAppTick);
  els.clearMarksBtn.addEventListener('click', () => {
    state.markedSlots.clear();
    syncMarkers();
    renderSlotList();
  });
  updatePauseButtonState();
}

function updateCombinedUploads() {
  state.uploadedFiles = [...state.uploadedSkeletonFiles, ...state.uploadedImageFiles];
}

function handleUploadedSkeletonFilesChange() {
  state.uploadedSkeletonFiles = Array.from(els.skeletonInput.files || []);
  updateCombinedUploads();
  renderUploadedSkeletonOptions();
  if (state.uploadedSkeletonFiles.length === 0) {
    setStatus('Upload at least one Spine skeleton (.json/.spine) file.');
    return;
  }

  const skeletonFiles = getUploadedSkeletonFiles();
  if (!skeletonFiles.length) {
    setStatus('No skeleton file found in upload. Please upload a .json or .spine file.');
    return;
  }

  if (skeletonFiles.length === 1) {
    els.uploadedSkeletonSelect.value = skeletonFiles[0].name;
    loadSelectedSkeletonFromUploads();
  } else if (els.uploadedSkeletonSelect.value) {
    loadSelectedSkeletonFromUploads();
  } else {
    setStatus('Multiple skeleton files uploaded. Select one from the dropdown to load.');
  }
}

function handleUploadedImageFilesChange() {
  state.uploadedImageFiles = Array.from(els.imageInput.files || []);
  updateCombinedUploads();
  if (els.uploadedSkeletonSelect.value) {
    setStatus('Image files uploaded. Reloading selected skeleton with new textures...');
    loadSelectedSkeletonFromUploads();
  } else {
    setStatus('Image files uploaded. Select a skeleton file to load.');
  }
}

function renderUploadedSkeletonOptions() {
  const skeletonFiles = getUploadedSkeletonFiles();
  if (!els.uploadedSkeletonSelect) return;

  els.uploadedSkeletonSelect.innerHTML = skeletonFiles.length
    ? skeletonFiles.map((file) => `<option value="${escapeHtml(file.name)}">${escapeHtml(file.name)}</option>`).join('')
    : '<option value="">No skeleton files uploaded</option>';
}

function getUploadedSkeletonFiles() {
  return state.uploadedSkeletonFiles.filter((file) => /\.(json|spine)$/i.test(file.name));
}

async function loadSelectedSkeletonFromUploads() {
  const name = els.uploadedSkeletonSelect.value;
  if (!name) return;
  const file = state.uploadedFiles.find((item) => item.name === name);
  if (!file) return;
  await loadSpineFromUploadedFiles(file);
}

async function loadSpineFromUploadedFiles(skeletonFile) {
  if (!skeletonFile) return;
  cleanupCurrentSpine();
  setStatus('Loading skeleton from uploaded files...');

  try {
    const baseName = removeExtension(skeletonFile.name);
    const atlasFile = state.uploadedFiles.find((item) => removeExtension(item.name) === baseName && item.name.toLowerCase().endsWith('.atlas'));
    let atlasText;
    let atlasUrl = `/spine/${baseName}.atlas`;
    let atlasData = null;
    let imageMode = 'packed atlas page images';

    if (atlasFile) {
      atlasText = await atlasFile.text();
      atlasUrl = createObjectUrl(atlasText, 'text/plain');
      state.objectUrls.push(atlasUrl);
      const atlasInfo = parseAtlas(atlasText);
      if (!atlasInfo.pages.length) {
        throw new Error('Uploaded atlas file is invalid or empty.');
      }

      const packedResult = await buildPackedPageImageMapFromUploads(atlasInfo.pages);
      if (packedResult.hasInvalid) {
        const autopacked = await buildLooseImageAtlasFromUploads(atlasInfo.regions);
        atlasUrl = autopacked.atlasUrl;
        atlasData = { images: { [autopacked.pageName]: autopacked.imageUrl } };
        imageMode = 'images autopacked from upload';
        state.lastImageReport = autopacked.report;
      } else {
        atlasData = { images: packedResult.images };
        state.lastImageReport = packedResult.report;
      }
    } else {
      throw new Error(`No uploaded atlas file found for ${skeletonFile.name}. Upload ${baseName}.atlas alongside the skeleton.`);
    }

    renderImageReport();

    const skeletonUrl = URL.createObjectURL(skeletonFile);
    state.objectUrls.push(skeletonUrl);

    const uniqueId = `${baseName}-${Date.now()}`;
    const skeletonAlias = `skeleton-${uniqueId}`;
    const atlasAlias = `atlas-${uniqueId}`;

    const skeletonExtension = skeletonFile.name.split('.').pop()?.toLowerCase();
    const skeletonSrc = skeletonExtension === 'json'
      ? { src: skeletonUrl, format: 'json', parser: 'json' }
      : { src: skeletonUrl, format: skeletonExtension, parser: 'spineSkeletonLoader' };

    Assets.add({ alias: skeletonAlias, src: skeletonSrc });
    Assets.add({ alias: atlasAlias, src: atlasUrl, parser: 'spineTextureAtlasLoader', data: atlasData });

    setStatus('Creating Spine data...');
    await Assets.load([skeletonAlias, atlasAlias]);

    const spine = createSpineInstance(skeletonAlias, atlasAlias);
    state.spine = spine;
    state.spineLayer.addChild(spine);

    fitSpineToView();
    populateControls();
    renderSlotList();
    playFirstAnimationIfAny();

    setStatus([
      `Loaded: ${skeletonFile.name}`,
      `Atlas source: ${atlasFile ? 'uploaded file' : atlasUrl}`,
      `Image mode: ${imageMode}`,
      '',
      'If animation still does not appear, check Spine editor/runtime version match.'
    ].join('\n'));
  } catch (error) {
    console.error(error);
    setStatus(`Load failed: ${error.message}`);
  }
}

async function buildPackedPageImageMapFromUploads(pageNames) {
  const map = {};
  const report = [];

  for (const pageName of pageNames) {
    const fileName = getFileName(pageName);
    const uploaded = findUploadedFileByName(fileName);
    const url = uploaded ? URL.createObjectURL(uploaded) : fileName;
    if (uploaded) state.objectUrls.push(url);
    const ok = Boolean(uploaded);
    map[pageName] = { pageName, url, ok };
    map[fileName] = map[pageName];
    report.push({ name: fileName, url, status: ok ? 'ok' : 'error', note: uploaded ? 'uploaded image' : 'missing uploaded image' });
  }

  const images = Object.fromEntries(Object.entries(map).map(([key, value]) => [key, value.url]));
  return { images, report, hasInvalid: report.some((item) => item.status !== 'ok') };
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
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const region of loadedRegions) {
    ctx.drawImage(region.image, region.packed.x, region.packed.y);
  }

  const pageName = '__generated_loose_images.png';
  const imageUrl = canvas.toDataURL('image/png');
  const atlasText = makeGeneratedAtlasText(pageName, canvas.width, canvas.height, loadedRegions);
  const atlasUrl = createObjectUrl(atlasText, 'text/plain');

  return { atlasUrl, imageUrl, pageName, report };
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

async function loadSpineFromSkeletonUpload() {
  const file = els.skeletonInput.files?.[0];
  if (!file) {
    setStatus('Please upload a skeleton .json or .spine file.');
    return;
  }

  cleanupCurrentSpine();
  setStatus('Loading skeleton...');

  try {
    const baseName = removeExtension(file.name);
    const atlasUrl = `/spine/${baseName}.atlas`;
    const atlasText = await fetchText(atlasUrl, `Atlas not found. Expected: ${atlasUrl}`);
    const atlasInfo = parseAtlas(atlasText);

    if (!atlasInfo.pages.length) {
      throw new Error('Atlas file was found, but no atlas page image names were detected. Check atlas format.');
    }

    setStatus('Checking atlas page images from /images...');
    const packedResult = await buildPackedPageImageMap(atlasInfo.pages);

    let atlasAssetUrl = atlasUrl;
    let atlasData = { images: packedResult.images };
    let imageMode = 'packed atlas page images';

    if (packedResult.hasInvalid) {
      setStatus('Packed page image missing/invalid. Trying image autopack from atlas region names...');
      const autopacked = await buildLooseImageAtlas(atlasInfo.regions);
      atlasAssetUrl = autopacked.atlasUrl;
      atlasData = { images: { [autopacked.pageName]: autopacked.imageUrl } };
      imageMode = 'images autopacked in browser';
      state.lastImageReport = autopacked.report;
    } else {
      state.lastImageReport = packedResult.report;
    }

    renderImageReport();

    const skeletonUrl = URL.createObjectURL(file);
    state.objectUrls.push(skeletonUrl);

    const uniqueId = `${baseName}-${Date.now()}`;
    const skeletonAlias = `skeleton-${uniqueId}`;
    const atlasAlias = `atlas-${uniqueId}`;

    const skeletonExtension = file.name.split('.').pop()?.toLowerCase();
    const skeletonSrc = skeletonExtension === 'json'
      ? { src: skeletonUrl, format: 'json', parser: 'json' }
      : { src: skeletonUrl, format: skeletonExtension, parser: 'spineSkeletonLoader' };

    Assets.add({ alias: skeletonAlias, src: skeletonSrc });
    Assets.add({ alias: atlasAlias, src: atlasAssetUrl, parser: 'spineTextureAtlasLoader', data: atlasData });

    setStatus('Creating Spine data...');
    await Assets.load([skeletonAlias, atlasAlias]);

    const spine = createSpineInstance(skeletonAlias, atlasAlias);
    state.spine = spine;
    state.spineLayer.addChild(spine);

    fitSpineToView();
    populateControls();
    renderSlotList();
    playFirstAnimationIfAny();

    setStatus([
      `Loaded: ${file.name}`,
      `Atlas: ${atlasUrl}`,
      `Image mode: ${imageMode}`,
      '',
      'If animation still does not appear, check Spine editor/runtime version match.'
    ].join('\n'));
  } catch (error) {
    console.error(error);
    setStatus(`Load failed: ${error.message}`);
  }
}

function createSpineInstance(skeletonAlias, atlasAlias) {
  const options = { skeleton: skeletonAlias, atlas: atlasAlias, allowMissingRegions: false };

  if (typeof Spine.from === 'function') {
    return Spine.from(options);
  }

  return new Spine(options);
}

function cleanupCurrentSpine() {
  if (!state.spineLayer) {
    state.spineLayer = new Container();
    if (state.app?.stage) state.app.stage.addChild(state.spineLayer);
  }

  for (const marker of state.markerObjects.values()) marker.destroy({ children: true });
  state.markerObjects.clear();
  state.markedSlots.clear();
  state.spineLayer.removeChildren();
  if (state.spine) state.spine.destroy({ children: true });
  state.spine = null;
  for (const url of state.objectUrls) URL.revokeObjectURL(url);
  state.objectUrls = [];
  state.lastImageReport = [];
  state.playbackSpeed = 1;
  state.isPaused = false;
  state.requestedLoopCount = 0;
  state.currentLoopCount = 0;
  state.eventLog = [];
  state.rootMotionPreview = false;
  state.currentAnimationName = '';
  state.zoom = 1;
  state.zoomBase = 1;
  if (els.loopCount) els.loopCount.value = '0';
  if (els.loopCheckbox) els.loopCheckbox.checked = false;
  if (els.showRootMotion) els.showRootMotion.checked = false;
  renderEventLog();
  state.spineLayer.position.set(0, 0);
  state.spineLayer.scale.set(1);
  if (els.zoomRange) els.zoomRange.value = '100';
  if (els.zoomValue) els.zoomValue.textContent = '100%';
  els.animationSelect.innerHTML = '';
  els.skinSelect.innerHTML = '';
  els.slotList.innerHTML = '';
  els.imageList.innerHTML = '';
}

function populateControls() {
  const data = getSkeletonData();
  const animations = data?.animations || [];
  const skins = data?.skins || [];

  const currentName = els.animationSelect?.value;
  els.animationSelect.innerHTML = animations
    .map((anim) => `<option value="${escapeHtml(anim.name)}">${escapeHtml(anim.name)}</option>`)
    .join('');

  if (currentName && animations.some((anim) => anim.name === currentName)) {
    els.animationSelect.value = currentName;
  }

  els.skinSelect.innerHTML = skins
    .map((skin) => `<option value="${escapeHtml(skin.name)}">${escapeHtml(skin.name)}</option>`)
    .join('');
}

function getSkeletonData() {
  return state.spine?.skeleton?.data || state.spine?.spineData || null;
}

function playFirstAnimationIfAny() {
  const first = getSkeletonData()?.animations?.[0]?.name;
  if (first) {
    els.animationSelect.value = first;
    const loop = els.loopCheckbox?.checked ?? true;
    state.spine.state.setAnimation(0, first, loop);
  }
}

function playSelectedAnimation() {
  if (!state.spine) return;

  const name = els.animationSelect.value;
  const loop = els.loopCheckbox?.checked ?? true;
  if (!name) return;

  state.spine.state.timeScale = 1;
  state.spine.autoUpdate = true;

  const entry = state.spine.state.setAnimation(0, name, loop);
  if (entry) entry.timeScale = 1;
}

function playAnimation(name, { seekTime = 0 } = {}) {
  if (!state.spine || !name) return;
  const loopControl = els.loopCheckbox?.checked ?? false;
  const requestedLoops = Number(els.loopCount?.value || 0);
  const infiniteLoop = loopControl && requestedLoops === 0;

  state.requestedLoopCount = requestedLoops;
  state.currentLoopCount = 0;
  state.currentAnimationName = name;
  state.isPaused = false;
  updatePauseButtonState();
  state.playbackSpeed = Number(els.speedRange?.value || 1) || 1;

  const entry = state.spine.state.setAnimation(0, name, infiniteLoop);
  if (entry) {
    entry.loop = infiniteLoop;
    entry.timeScale = state.playbackSpeed;
    if (seekTime > 0) entry.trackTime = seekTime;
    state.currentTrackEntry = entry;
  }

  syncSpineStateListeners();
  renderStatus();
}

function updatePauseButtonState() {
  if (!els.pauseBtn) return;
  els.pauseBtn.classList.toggle('active', state.isPaused);
  els.pauseBtn.textContent = state.isPaused ? 'Resume' : 'Pause';
}

function pausePlayback() {
  if (!state.spine) return;
  state.isPaused = true;
  const st = state.spine.state;
  if (st) st.timeScale = 0;
  updatePauseButtonState();
}

function resumePlayback() {
  if (!state.spine) return;
  state.isPaused = false;
  const st = state.spine.state;
  if (st) st.timeScale = state.playbackSpeed;
  updatePauseButtonState();
}

function togglePause() {
  if (!state.spine) return;
  state.isPaused = !state.isPaused;
  const st = state.spine.state;
  if (st) st.timeScale = state.isPaused ? 0 : state.playbackSpeed;
  setStatus(state.isPaused ? 'Paused' : `Playing ${state.currentAnimationName || 'animation'}`);
  updatePauseButtonState();
}

function stepAnimationFrame(direction) {
  if (!state.spine) return;
  pausePlayback();
  const entry = getCurrentTrackEntry();
  if (!entry || !entry.animation) return;
  const frameTime = 1 / 60;
  const nextTime = Math.max(0, (entry.trackTime || 0) + direction * frameTime);
  seekAnimation(nextTime);
}

function seekAnimation(time) {
  const entry = getCurrentTrackEntry();
  if (!entry || !entry.animation) return;
  const duration = entry.animation.duration || 0.0001;
  entry.trackTime = Math.min(Math.max(time, 0), duration);
  if (entry.loop) entry.loop = false;
  updateTimelineDisplay();
}

function onTimelineScrubStart() {
  if (!state.spine) return;
  state.isScrubbing = true;
  state.wasPausedBeforeScrub = state.isPaused;
  pausePlayback();
}

function onTimelineScrubEnd() {
  if (!state.spine || !state.isScrubbing) return;
  state.isScrubbing = false;
  if (!state.wasPausedBeforeScrub) {
    resumePlayback();
  }
}

function onSpeedChange() {
  const speed = Number(els.speedRange.value) || 1;
  state.playbackSpeed = speed;
  if (els.speedValue) els.speedValue.textContent = `${speed.toFixed(2)}x`;
  const st = state.spine?.state;
  if (st && !state.isPaused) st.timeScale = speed;
}

function onTimelineChange() {
  const value = Number(els.timelineRange.value);
  seekAnimation(value);
}

function onLoopCountChange() {
  const value = Number(els.loopCount.value) || 0;
  state.requestedLoopCount = value;
  renderStatus();
}


function onRootMotionToggle() {
  state.rootMotionPreview = els.showRootMotion?.checked ?? false;
  renderRootMotionInfo();
}

function renderRootMotionInfo() {
  if (!els.rootMotionInfo) return;
  if (!state.rootMotionPreview || !state.spine) {
    els.rootMotionInfo.textContent = '';
    return;
  }

  const skeleton = state.spine.skeleton;
  const bone = skeleton.findBone('root') || skeleton.bones[0];
  if (!bone) {
    els.rootMotionInfo.textContent = 'Root motion preview not available.';
    return;
  }

  els.rootMotionInfo.textContent = `Root motion: x=${bone.worldX.toFixed(1)}, y=${bone.worldY.toFixed(1)}, rotation=${bone.worldRotation?.toFixed(1) ?? bone.rotation.toFixed(1)}°`;
}


function getCurrentTrackEntry() {
  if (!state.spine) return null;
  const st = state.spine.state;
  return typeof st?.getCurrent === 'function' ? st.getCurrent(0) : st?.tracks?.[0] || null;
}

function syncSpineStateListeners() {
  if (!state.spine) return;
  const st = state.spine.state;
  if (!st) return;

  if (state.currentStateListener && typeof st.removeListener === 'function') {
    st.removeListener(state.currentStateListener);
  }

  const listener = {
    event(entry, event) {
      state.eventLog.unshift(`${event.name} @ ${entry.trackTime.toFixed(2)}s`);
      if (state.eventLog.length > 20) state.eventLog.length = 20;
      renderEventLog();
    },
    complete(entry) {
      const hasQueue = false;
      if (state.requestedLoopCount > 0) {
        state.currentLoopCount += 1;
        if (state.currentLoopCount < state.requestedLoopCount) {
          const name = state.currentAnimationName;
          const speed = state.playbackSpeed;
          const loopControl = els.loopCheckbox?.checked ?? false;
          const entry2 = state.spine.state.setAnimation(0, name, false);
          if (entry2) {
            entry2.loop = false;
            entry2.timeScale = speed;
            state.currentTrackEntry = entry2;
          }
          return;
        }
      }
      if (hasQueue) {
      } else {
        setStatus(`Animation complete: ${state.currentAnimationName}`);
      }
    }
  };

  state.currentStateListener = listener;
  if (typeof st.addListener === 'function') {
    st.addListener(listener);
  }
}

function renderEventLog() {
  if (!els.eventLog) return;
  els.eventLog.innerHTML = state.eventLog.length
    ? state.eventLog.map((line) => `<div>${escapeHtml(line)}</div>`).join('')
    : '<div class="small">No events yet.</div>';
}

function renderStatus() {
  setStatus(`Playing: ${state.currentAnimationName || 'none'} | Speed: ${state.playbackSpeed.toFixed(2)}x | Loop count: ${state.requestedLoopCount || (els.loopCheckbox?.checked ? '∞' : 1)}`);
}

function onAppTick() {
  if (!state.spine) return;
  if (state.isPaused) return;
  updateTimelineDisplay();
  if (state.rootMotionPreview) renderRootMotionInfo();
}

function updateTimelineDisplay() {
  const entry = getCurrentTrackEntry();
  if (!entry || !entry.animation) return;

  const duration = entry.animation.duration || 0;
  const time = Math.max(0, Math.min(entry.trackTime || 0, duration));
  if (els.timelineRange) {
    els.timelineRange.max = duration.toFixed(3);
    els.timelineRange.value = time.toFixed(3);
  }
  if (els.timelineTime) {
    els.timelineTime.textContent = `${time.toFixed(2)} / ${duration.toFixed(2)}s`;
  }
}

function updateCurrentTrackLoop() {
  if (!state.spine) return;
  const loop = els.loopCheckbox?.checked ?? true;
  const st = state.spine.state;
  try {
    if (typeof st.getCurrent === 'function') {
      const entry = st.getCurrent(0);
      if (entry) entry.loop = loop;
    } else if (st.tracks && st.tracks[0]) {
      st.tracks[0].loop = loop;
    }
  } catch (e) {
    // Not critical; ignore if runtime shape differs
    // eslint-disable-next-line no-console
    console.warn('Could not update track loop flag', e);
  }
}

function setupPose() {
  if (!state.spine) return;
  state.spine.state.clearTracks();
  if (state.spine.skeleton.setupPose) state.spine.skeleton.setupPose();
  else {
    state.spine.skeleton.setToSetupPose?.();
    state.spine.skeleton.setSlotsToSetupPose?.();
  }
}

function applySelectedSkin() {
  if (!state.spine) return;
  const skinName = els.skinSelect.value;
  const skeleton = state.spine.skeleton;
  const data = getSkeletonData();
  const skin = data?.findSkin?.(skinName) || data?.skins?.find((item) => item.name === skinName);
  if (!skin) return;

  if (skeleton.setSkin) skeleton.setSkin(skin);
  else skeleton.skin = skin;

  skeleton.setupPoseSlots?.();
  skeleton.setSlotsToSetupPose?.();
}

function renderSlotList() {
  const slots = getSkeletonData()?.slots || [];
  els.slotList.innerHTML = slots.map((slot) => {
    const name = slot.name;
    const marked = state.markedSlots.has(name);
    return `
      <div class="slot-row ${marked ? 'marked' : ''}" data-slot="${escapeHtml(name)}">
        <span title="${escapeHtml(name)}">${escapeHtml(name)}</span>
      </div>`;
  }).join('');

  els.slotList.querySelectorAll('button[data-slot]').forEach((button) => {
    button.addEventListener('click', () => {
      toggleSlotMark(button.dataset.slot);
    });
  });

  els.slotList.querySelectorAll('.slot-row[data-slot]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('button[data-slot]')) return;
      toggleSlotMark(row.dataset.slot);
    });
  });
}

function toggleSlotMark(slotName) {
  if (!slotName) return;
  if (state.markedSlots.has(slotName)) state.markedSlots.delete(slotName);
  else state.markedSlots.add(slotName);
  syncMarkers();
  renderSlotList();
}

function syncMarkers() {
  if (!state.spine) return;

  for (const [slotName, marker] of state.markerObjects.entries()) {
    if (!state.markedSlots.has(slotName)) {
      state.spine.removeSlotObject?.(slotName, marker);
      marker.destroy({ children: true });
      state.markerObjects.delete(slotName);
    }
  }

  for (const slotName of state.markedSlots) {
    if (state.markerObjects.has(slotName)) continue;
    const marker = createSlotMarker();
    state.markerObjects.set(slotName, marker);
    if (state.spine.addSlotObject) {
      state.spine.addSlotObject(slotName, marker, { followAttachmentTimeline: true });
    } else {
      // Fallback for older runtimes: marker is still shown, but may not follow perfectly.
      state.spine.addChild(marker);
    }
  }
}

function createSlotMarker() {
  const wrapper = new Container();
  const g = new Graphics();
  g.circle(0, 0, 14).fill({ color: 0x1f7a29, alpha: 0.35 }).stroke({ width: 3, color: 0x1f7a29, alpha: 1 });
  g.moveTo(-16, 0).lineTo(16, 0).moveTo(0, -16).lineTo(0, 16).stroke({ width: 3, color: 0x1f7a29, alpha: 1 });
  wrapper.addChild(g);
  return wrapper;
}

function fitSpineToView() {
  if (!state.spine) return;
  state.spineLayer.position.set(0, 0);
  state.spineLayer.scale.set(1);
  state.spine.position.set(0, 0);
  state.spine.scale.set(1);

  requestAnimationFrame(() => {
    try {
      const bounds = state.spine.getBounds();
      if (bounds.width > 0 && bounds.height > 0) {
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        const viewCenterX = state.app.renderer.width / 2;
        const viewCenterY = state.app.renderer.height / 2;
        state.spine.x = state.spine.x + (viewCenterX - centerX);
        state.spine.y = state.spine.y + (viewCenterY - centerY);

        const scale = Math.min(
          (state.app.renderer.width * 0.75) / bounds.width,
          (state.app.renderer.height * 0.75) / bounds.height,
          1.5
        );
        const minScale = 0.85;
        state.zoomBase = Math.min(Math.max(scale * 1.05, minScale), 1.5);
        applyZoom(viewCenterX, viewCenterY);
      }
    } catch {
      state.zoomBase = 1;
      const viewCenterX = state.app.renderer.width / 2;
      const viewCenterY = state.app.renderer.height / 2;
      applyZoom(viewCenterX, viewCenterY);
    }
  });
}

async function buildPackedPageImageMap(pageNames) {
  const map = {};
  const report = [];

  for (const pageName of pageNames) {
    const fileName = getFileName(pageName);
    const url = `/images/${fileName}`;
    const ok = await canLoadImage(url);
    map[pageName] = { pageName, url, ok };
    map[fileName] = map[pageName];
    report.push({ name: fileName, url, status: ok ? 'ok' : 'error', note: 'atlas page image' });
  }

  const images = Object.fromEntries(
    Object.entries(map).map(([key, value]) => [key, value.url])
  );
  return { images, report, hasInvalid: report.some((item) => item.status !== 'ok') };
}

async function buildLooseImageAtlas(regions) {
  if (!regions.length) {
    throw new Error('Packed atlas page image is invalid and no atlas regions were found for loose-image fallback.');
  }

  const loadedRegions = [];
  const report = [];

  for (const region of regions) {
    const match = await loadFirstExistingImage(region.name, ['png', 'webp', 'jpg', 'jpeg']);
    if (!match) {
      report.push({ name: region.name, url: `/images/${region.name}.png`, status: 'error', note: 'missing image' });
      continue;
    }
    loadedRegions.push({ ...region, image: match.image, sourceUrl: match.url });
    report.push({ name: region.name, url: match.url, status: 'ok', note: '' });
  }

  if (!loadedRegions.length) {
    state.lastImageReport = report;
    renderImageReport();
    throw new Error('No images could be loaded. Expected files like /images/<atlas-region-name>.png');
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
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const region of loadedRegions) {
    ctx.drawImage(region.image, region.packed.x, region.packed.y);
  }

  const pageName = '__generated_loose_images.png';
  const imageUrl = canvas.toDataURL('image/png');
  const atlasText = makeGeneratedAtlasText(pageName, canvas.width, canvas.height, loadedRegions);
  const atlasUrl = createObjectUrl(atlasText, 'text/plain');

  return { atlasUrl, imageUrl, pageName, report };
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

function parseAtlas(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const pages = [];
  const regions = [];
  let currentRegion = null;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
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

async function loadFirstExistingImage(baseName, extensions) {
  for (const ext of extensions) {
    const url = `/images/${baseName}.${ext}`;
    const image = await loadImage(url).catch(() => null);
    if (image) return { url, image };
  }
  return null;
}

function canLoadImage(url) {
  return loadImage(url).then(() => true).catch(() => false);
}

function loadImage(url) {
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

async function fetchText(url, failMessage) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${failMessage}. HTTP ${response.status}`);
  return response.text();
}

function createObjectUrl(content, mimeType) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  state.objectUrls.push(url);
  return url;
}

function renderImageReport() {
  if (!state.lastImageReport.length) {
    els.imageList.textContent = 'No image checks yet.';
    return;
  }

  els.imageList.innerHTML = state.lastImageReport.map((item) => {
    const cls = item.status === 'ok' ? 'ok' : item.status === 'warn' ? 'warn' : 'error';
    return `<span class="badge ${cls}" title="${escapeHtml(item.url)}">${escapeHtml(item.name)}</span>`;
  }).join(' ');
}

function onZoomChange() {
  state.zoom = Number(els.zoomRange.value) / 100;
  if (els.zoomValue) els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  const centerX = state.app.renderer.width / 2;
  const centerY = state.app.renderer.height / 2;
  applyZoom(centerX, centerY);
}

function onViewerPointerDown(event) {
  if (event.button !== 0 || !state.spine) return;
  state.isPanning = true;
  state.panStart.x = event.clientX;
  state.panStart.y = event.clientY;
  state.panOrigin.x = state.spineLayer.x;
  state.panOrigin.y = state.spineLayer.y;
  els.viewer.classList.add('panning');
  if (event.currentTarget?.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
}

function onViewerPointerMove(event) {
  if (!state.isPanning) return;
  event.preventDefault();
  const dx = event.clientX - state.panStart.x;
  const dy = event.clientY - state.panStart.y;
  state.spineLayer.x = state.panOrigin.x + dx;
  state.spineLayer.y = state.panOrigin.y + dy;
}

function onViewerPointerUp(event) {
  if (!state.isPanning) return;
  state.isPanning = false;
  els.viewer.classList.remove('panning');
  if (event.currentTarget?.releasePointerCapture) event.currentTarget.releasePointerCapture(event.pointerId);
}

function applyZoom(focusX, focusY) {
  if (!state.spine) return;
  const oldScale = state.spineLayer.scale.x || 1;
  const newScale = Math.max(0.1, Math.min(2, state.zoomBase * state.zoom));

  const targetX = typeof focusX === 'number' ? focusX : state.app.renderer.width / 2;
  const targetY = typeof focusY === 'number' ? focusY : state.app.renderer.height / 2;

  if (oldScale !== 0) {
    const worldX = (targetX - state.spineLayer.x) / oldScale;
    const worldY = (targetY - state.spineLayer.y) / oldScale;
    state.spineLayer.x = targetX - worldX * newScale;
    state.spineLayer.y = targetY - worldY * newScale;
  }

  state.spineLayer.scale.set(newScale);
}

function updateZoomControls() {
  if (els.zoomRange) els.zoomRange.value = `${Math.round(state.zoom * 100)}`;
  if (els.zoomValue) els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
}

function onViewerWheel(event) {
  if (!state.spine) return;
  event.preventDefault();

  const step = event.deltaY > 0 ? -0.05 : 0.05;
  const nextZoom = clamp(state.zoom + step, 0.1, 2);

  state.zoom = nextZoom;
  updateZoomControls();
  const centerX = state.app.renderer.width / 2;
  const centerY = state.app.renderer.height / 2;
  applyZoom(centerX, centerY);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function removeExtension(name) {
  return name.replace(/\.[^/.]+$/, '');
}

function getFileName(path) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function uniqueByName(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.name)) map.set(item.name, item);
  }
  return Array.from(map.values());
}

function nextPowerOfTwo(value) {
  return 2 ** Math.ceil(Math.log2(Math.max(1, value)));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(message) {
  els.status.textContent = message;
}
