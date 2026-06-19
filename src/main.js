import './style.css';
import { getAppTemplate } from './ui/template.js';
import { parseAtlas } from './spine/atlasParser.js';
import { buildTextureAtlasForSelectedSource, configureTextureAtlasBuilder } from './spine/textureAtlasBuilder.js';
import { readSkeletonAssetFromFile } from './spine/skeletonAsset.js';
import { clamp, escapeHtml, getFileName, removeExtension } from './utils/index.js';
import { Application, Container, Graphics, Texture, TextureStyle } from 'pixi.js';
import { Spine, SpineTexture, TextureAtlas, AtlasAttachmentLoader, SkeletonJson, SkeletonBinary } from '@esotericsoftware/spine-pixi-v8';


const renderQuality = {
  resolution: Math.max(1, window.devicePixelRatio || 1),
  textureScaleMode: 'linear',
  maxAnisotropy: 16
};

TextureStyle.defaultOptions = {
  ...TextureStyle.defaultOptions,
  scaleMode: renderQuality.textureScaleMode,
  maxAnisotropy: renderQuality.maxAnisotropy
};

const state = {
  app: null,
  spine: null,
  spineLayer: new Container(),
  markerObjects: new Map(),
  markedSlots: new Set(),
  objectUrls: [],
  lastImageReport: [],
  lastAtlasInfo: null,
  uploadedSkeletonFiles: [],
  uploadedImageFiles: [],
  uploadedSpritesheetFiles: [],
  uploadedFiles: [],
  textureSourceMode: 'sprites',
  selectedSlotName: '',
  selectedTrackNumber: 0,
  activeTrackSummaryHtml: '',
  debugGraphics: null,
  showSpineBounds: false,
  showSlotBounds: false,
  showAttachmentBounds: false,
  lastSlotInspectorHtml: '',
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

configureTextureAtlasBuilder({ state, renderImageReport });

const appRoot = document.querySelector('#app');
appRoot.innerHTML = getAppTemplate();

const els = {
  viewer: document.querySelector('#viewer'),
  skeletonInput: document.querySelector('#skeletonInput'),
  textureSourceMode: document.querySelector('#textureSourceMode'),
  spriteUploadSection: document.querySelector('#spriteUploadSection'),
  spritesheetUploadSection: document.querySelector('#spritesheetUploadSection'),
  imageInput: document.querySelector('#imageInput'),
  spritesheetInput: document.querySelector('#spritesheetInput'),
  uploadedSkeletonSelect: document.querySelector('#uploadedSkeletonSelect'),
  animationSelect: document.querySelector('#animationSelect'),
  trackNumber: document.querySelector('#trackNumber'),
  clearTrackBtn: document.querySelector('#clearTrackBtn'),
  clearAllTracksBtn: document.querySelector('#clearAllTracksBtn'),
  activeTracks: document.querySelector('#activeTracks'),
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
  showSpineBounds: document.querySelector('#showSpineBounds'),
  showSlotBounds: document.querySelector('#showSlotBounds'),
  showAttachmentBounds: document.querySelector('#showAttachmentBounds'),
  slotInspector: document.querySelector('#slotInspector'),
  slotList: document.querySelector('#slotList'),
  clearMarksBtn: document.querySelector('#clearMarksBtn'),
  imageList: document.querySelector('#imageList'),
  eventLog: document.querySelector('#eventLog'),
  status: document.querySelector('#status')
};

boot();

async function boot() {
  state.app = new Application();
  await state.app.init({
    resizeTo: els.viewer,
    background: '#10131a',
    antialias: true,
    autoDensity: true,
    resolution: renderQuality.resolution,
    hello: false
  });
  els.viewer.appendChild(state.app.canvas);
  state.app.stage.addChild(state.spineLayer);
  state.debugGraphics = new Graphics();
  state.debugGraphics.eventMode = 'none';
  state.app.stage.addChild(state.debugGraphics);

  renderUploadedSkeletonOptions();
  updateTextureSourceUploadUi();
  els.skeletonInput.addEventListener('change', handleUploadedSkeletonFilesChange);
  els.textureSourceMode.addEventListener('change', onTextureSourceModeChange);
  els.imageInput.addEventListener('change', handleUploadedImageFilesChange);
  els.spritesheetInput.addEventListener('change', handleUploadedSpritesheetFilesChange);
  els.uploadedSkeletonSelect.addEventListener('change', loadSelectedSkeletonFromUploads);
  els.animationSelect?.addEventListener('change', playSelectedAnimation);
  els.trackNumber?.addEventListener('input', onTrackNumberChange);
  els.playBtn?.addEventListener('click', playSelectedAnimation);
  els.clearTrackBtn?.addEventListener('click', clearSelectedTrack);
  els.clearAllTracksBtn?.addEventListener('click', clearAllTracks);
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
  els.showSpineBounds?.addEventListener('change', onDebugBoundsToggle);
  els.showSlotBounds?.addEventListener('change', onDebugBoundsToggle);
  els.showAttachmentBounds?.addEventListener('change', onDebugBoundsToggle);
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
    renderDebugBounds();
  });
  updatePauseButtonState();
}

function updateCombinedUploads() {
  state.uploadedFiles = [
    ...state.uploadedSkeletonFiles,
    ...state.uploadedImageFiles,
    ...state.uploadedSpritesheetFiles
  ];
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
    setStatus('Sprite image files uploaded. Reloading selected skeleton with new textures...');
    loadSelectedSkeletonFromUploads();
  } else {
    setStatus('Sprite image files uploaded. Select a skeleton file to load.');
  }
}

function handleUploadedSpritesheetFilesChange() {
  state.uploadedSpritesheetFiles = Array.from(els.spritesheetInput.files || []);
  updateCombinedUploads();
  if (els.uploadedSkeletonSelect.value) {
    setStatus('Spritesheet files uploaded. Reloading selected skeleton with new textures...');
    loadSelectedSkeletonFromUploads();
  } else {
    setStatus('Spritesheet files uploaded. Select a skeleton file to load.');
  }
}

function onTextureSourceModeChange() {
  state.textureSourceMode = els.textureSourceMode?.value || 'sprites';
  updateTextureSourceUploadUi();
  updateCombinedUploads();

  if (els.uploadedSkeletonSelect.value) {
    setStatus('Texture source changed. Reloading selected skeleton...');
    loadSelectedSkeletonFromUploads();
  }
}

function updateTextureSourceUploadUi() {
  const mode = els.textureSourceMode?.value || state.textureSourceMode || 'sprites';
  state.textureSourceMode = mode;
  els.spriteUploadSection?.classList.toggle('hidden', mode !== 'sprites');
  els.spritesheetUploadSection?.classList.toggle('hidden', mode !== 'spritesheets');
}

function renderUploadedSkeletonOptions() {
  const skeletonFiles = getUploadedSkeletonFiles();
  if (!els.uploadedSkeletonSelect) return;

  els.uploadedSkeletonSelect.innerHTML = skeletonFiles.length
    ? skeletonFiles.map((file) => `<option value="${escapeHtml(file.name)}">${escapeHtml(file.name)}</option>`).join('')
    : '<option value="">No skeleton files uploaded</option>';
}

function getUploadedSkeletonFiles() {
  return state.uploadedSkeletonFiles.filter((file) => /\.(json|spine|skel)$/i.test(file.name));
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
    let sourceAtlasText;
    let runtimeAtlasText;
    let runtimeAtlasImages = {};
    let imageMode = 'packed atlas page images';

    if (atlasFile) {
      sourceAtlasText = await atlasFile.text();
      const atlasInfo = parseAtlas(sourceAtlasText);
      state.lastAtlasInfo = atlasInfo;
      if (!atlasInfo.pages.length) {
        throw new Error('Uploaded atlas file is invalid or empty.');
      }

      const textureResult = await buildTextureAtlasForSelectedSource(sourceAtlasText, atlasInfo);
      runtimeAtlasText = textureResult.atlasText || sourceAtlasText;
      runtimeAtlasImages = textureResult.atlasData?.images || {};
      imageMode = textureResult.imageMode;
    } else {
      throw new Error(`No uploaded atlas file found for ${skeletonFile.name}. Upload ${baseName}.atlas alongside the skeleton.`);
    }

    renderImageReport();

    setStatus('Creating Spine data...');
    const skeletonAsset = await readSkeletonAssetFromFile(skeletonFile);
    const textureAtlas = createRuntimeTextureAtlas(runtimeAtlasText, runtimeAtlasImages);
    const spine = createSpineFromSkeletonAsset(skeletonAsset, textureAtlas);

    state.spine = spine;
    state.spineLayer.addChild(spine);

    fitSpineToView();
    populateControls();
    renderSlotList();
    renderSlotInspector();
    renderDebugBounds();
    playFirstAnimationIfAny();

    setStatus([
      `Loaded: ${skeletonFile.name}`,
      `Atlas source: uploaded file`,
      `Image mode: ${imageMode}`,
      'Loader: direct in-memory Spine parser',
      '',
      'If animation still does not appear, check Spine editor/runtime version match.'
    ].join('\n'));
  } catch (error) {
    console.error(error);
    const details = error?.stack ? `\n\n${error.stack}` : '';
    setStatus(`Load failed: ${error.message}${details}`);
  }
}

function createRuntimeTextureAtlas(atlasText, imageMap) {
  const atlas = new TextureAtlas(atlasText);

  for (const page of atlas.pages) {
    const source = imageMap?.[page.name] || imageMap?.[getFileName(page.name)];
    if (!source) {
      throw new Error(`No texture source found for atlas page "${page.name}".`);
    }

    const textureSource = toPixiTextureSource(source);
    page.setTexture(SpineTexture.from(textureSource));
  }

  return atlas;
}

function toPixiTextureSource(source) {
  if (!source) return source;

  // Already a Pixi TextureSource.
  if (source.resource !== undefined || source.style !== undefined) {
    return source;
  }

  // Pixi Texture object.
  if (source.source) {
    return source.source;
  }

  // HTMLImageElement, HTMLCanvasElement, ImageBitmap, or URL string.
  return Texture.from(source).source;
}

function createSpineFromSkeletonAsset(skeletonAsset, textureAtlas) {
  const attachmentLoader = new AtlasAttachmentLoader(textureAtlas);
  const parser = skeletonAsset instanceof Uint8Array
    ? new SkeletonBinary(attachmentLoader)
    : new SkeletonJson(attachmentLoader);

  parser.scale = 1;
  const skeletonData = parser.readSkeletonData(skeletonAsset);
  return new Spine({ skeletonData });
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
  state.lastAtlasInfo = null;
  state.playbackSpeed = 1;
  state.isPaused = false;
  state.requestedLoopCount = 0;
  state.currentLoopCount = 0;
  state.eventLog = [];
  state.rootMotionPreview = false;
  state.currentAnimationName = '';
  state.currentTrackIndex = 0;
  state.currentTrackEntry = null;
  state.selectedTrackNumber = 0;
  state.selectedSlotName = '';
  state.lastSlotInspectorHtml = '';
  state.zoom = 1;
  state.zoomBase = 1;
  if (els.loopCount) els.loopCount.value = '0';
  if (els.trackNumber) els.trackNumber.value = '0';
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
  if (els.slotInspector) els.slotInspector.textContent = 'Load a Spine and select a slot.';
  renderActiveTracks();
  state.debugGraphics?.clear();
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
    setTrackNumber(0);
    playSelectedAnimation();
  }
}

function getSelectedTrackNumber() {
  const value = Number(els.trackNumber?.value ?? state.selectedTrackNumber ?? 0);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(15, Math.floor(value)));
}

function setTrackNumber(trackNumber) {
  state.selectedTrackNumber = Math.max(0, Math.min(15, Math.floor(Number(trackNumber) || 0)));
  state.currentTrackIndex = state.selectedTrackNumber;
  if (els.trackNumber) els.trackNumber.value = String(state.selectedTrackNumber);
  updateTimelineDisplay();
  renderActiveTracks();
}

function onTrackNumberChange() {
  setTrackNumber(getSelectedTrackNumber());
}

function playSelectedAnimation() {
  if (!state.spine) return;

  const name = els.animationSelect.value;
  const trackNumber = getSelectedTrackNumber();
  const loop = els.loopCheckbox?.checked ?? true;
  if (!name) return;

  state.spine.autoUpdate = true;
  state.spine.state.timeScale = state.isPaused ? 0 : state.playbackSpeed;

  const entry = state.spine.state.setAnimation(trackNumber, name, loop);
  if (entry) {
    entry.loop = loop;
    entry.timeScale = state.playbackSpeed;
    state.currentTrackEntry = entry;
  }

  state.selectedTrackNumber = trackNumber;
  state.currentTrackIndex = trackNumber;
  state.currentAnimationName = name;
  syncSpineStateListeners();
  updateTimelineDisplay();
  renderActiveTracks();
  setStatus(`Playing track ${trackNumber}: ${name}${loop ? ' (loop)' : ''}`);
}

function clearSelectedTrack() {
  if (!state.spine) return;
  const trackNumber = getSelectedTrackNumber();
  state.spine.state.clearTrack(trackNumber);
  if (trackNumber === state.currentTrackIndex) {
    state.currentTrackEntry = null;
    state.currentAnimationName = '';
  }
  updateTimelineDisplay();
  renderActiveTracks();
  setStatus(`Cleared track ${trackNumber}.`);
}

function clearAllTracks() {
  if (!state.spine) return;
  state.spine.state.clearTracks();
  state.currentTrackEntry = null;
  state.currentAnimationName = '';
  updateTimelineDisplay();
  renderActiveTracks();
  setStatus('Cleared all animation tracks.');
}

function getTrackEntry(trackNumber) {
  if (!state.spine) return null;
  const st = state.spine.state;
  if (typeof st?.getCurrent === 'function') return st.getCurrent(trackNumber);
  return st?.tracks?.[trackNumber] || null;
}

function getActiveTrackEntries() {
  if (!state.spine) return [];
  const st = state.spine.state;
  const entries = [];
  const tracks = st?.tracks || [];
  const maxCount = Math.max(tracks.length || 0, 16);

  for (let i = 0; i < maxCount; i += 1) {
    const entry = getTrackEntry(i);
    if (entry?.animation) entries.push({ track: i, entry });
  }

  return entries;
}

function renderActiveTracks() {
  if (!els.activeTracks) return;
  const rows = getActiveTrackEntries();

  if (!rows.length) {
    const html = 'No active tracks.';
    if (state.activeTrackSummaryHtml !== html) {
      state.activeTrackSummaryHtml = html;
      els.activeTracks.textContent = html;
    }
    return;
  }

  const html = rows.map(({ track, entry }) => {
    const duration = entry.animation?.duration || 0;
    const trackTime = entry.trackTime || 0;
    const displayTime = entry.loop && duration > 0 ? trackTime % duration : Math.min(trackTime, duration);
    const progress = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;
    const selected = track === getSelectedTrackNumber();
    const label = selected ? 'selected' : 'active';
    const modeLabel = entry.loop ? 'loop' : 'once';
    return `<div class="track-row ${selected ? 'selected' : ''}">
      <strong>Track ${track}</strong> <span class="badge ${selected ? 'warn' : 'ok'}">${label}</span><br/>
      ${escapeHtml(entry.animation.name)} <span class="muted-line">(${modeLabel})</span><br/>
      <span class="muted-line">progress ${progress.toFixed(0)}%</span>
    </div>`;
  }).join('');

  if (state.activeTrackSummaryHtml !== html) {
    state.activeTrackSummaryHtml = html;
    els.activeTracks.innerHTML = html;
  }
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
  for (const { entry } of getActiveTrackEntries()) {
    entry.timeScale = speed;
  }
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
  return getTrackEntry(getSelectedTrackNumber());
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
      const track = entry?.trackIndex ?? '?';
      const animationName = entry?.animation?.name || 'unknown_animation';
      const eventName = getSpineEventName(event);
      const eventTime = Number.isFinite(event?.time) ? event.time : entry?.trackTime;
      const timeLabel = Number.isFinite(eventTime) ? eventTime.toFixed(2) : '0.00';

      state.eventLog.unshift(`track ${track} | anim: ${animationName} | event: ${eventName} @ ${timeLabel}s`);
      if (state.eventLog.length > 20) state.eventLog.length = 20;
      renderEventLog();
    },
    complete(entry) {
      const track = entry.trackIndex ?? '?';
      const name = entry.animation?.name || state.currentAnimationName || 'animation';
      renderActiveTracks();
      if (!entry.loop) setStatus(`Animation complete on track ${track}: ${name}`);
    }
  };

  state.currentStateListener = listener;
  if (typeof st.addListener === 'function') {
    st.addListener(listener);
  }
}

function getSpineEventName(event) {
  return event?.data?.name
    || event?.name
    || event?.stringValue
    || 'unnamed_event';
}

function renderEventLog() {
  if (!els.eventLog) return;
  els.eventLog.innerHTML = state.eventLog.length
    ? state.eventLog.map((line) => `<div>${escapeHtml(line)}</div>`).join('')
    : '<div class="small">No events yet.</div>';
}

function renderStatus() {
  setStatus(`Selected track ${getSelectedTrackNumber()} | Playing: ${state.currentAnimationName || 'none'} | Speed: ${state.playbackSpeed.toFixed(2)}x | Loop: ${els.loopCheckbox?.checked ? 'on' : 'off'}`);
}

function onAppTick() {
  if (!state.spine) return;
  if (!state.isPaused) updateTimelineDisplay();
  renderActiveTracks();
  if (state.rootMotionPreview) renderRootMotionInfo();
  renderSlotInspector();
  renderDebugBounds();
}

function updateTimelineDisplay() {
  const entry = getCurrentTrackEntry();
  if (!entry || !entry.animation) {
    if (els.timelineRange) {
      els.timelineRange.max = '1';
      els.timelineRange.value = '0';
    }
    if (els.timelineTime) {
      els.timelineTime.textContent = `Track ${getSelectedTrackNumber()}: 0.00 / 0.00s`;
    }
    return;
  }

  const duration = entry.animation.duration || 0;
  const time = Math.max(0, Math.min(entry.trackTime || 0, duration));
  if (els.timelineRange) {
    els.timelineRange.max = duration.toFixed(3);
    els.timelineRange.value = time.toFixed(3);
  }
  if (els.timelineTime) {
    els.timelineTime.textContent = `Track ${getSelectedTrackNumber()}: ${time.toFixed(2)} / ${duration.toFixed(2)}s`;
  }
}

function updateCurrentTrackLoop() {
  if (!state.spine) return;
  const loop = els.loopCheckbox?.checked ?? true;
  try {
    const entry = getCurrentTrackEntry();
    if (entry) entry.loop = loop;
    renderActiveTracks();
  } catch (e) {
    // Runtime shape can differ slightly between Spine versions.
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
  renderSlotInspector();
  renderDebugBounds();
  renderActiveTracks();
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
  renderSlotInspector();
  renderDebugBounds();
}

function renderSlotList() {
  const slots = getSkeletonData()?.slots || [];
  els.slotList.innerHTML = slots.map((slot) => {
    const name = slot.name;
    const marked = state.markedSlots.has(name);
    const selected = state.selectedSlotName === name;
    const rmSlot = isRmSlot(name);
    return `
      <div class="slot-row ${rmSlot ? 'rm-slot' : ''} ${marked ? 'marked' : ''} ${selected ? 'selected' : ''}" data-slot="${escapeHtml(name)}">
        <span title="${escapeHtml(name)}">${escapeHtml(name)}</span>
        ${rmSlot ? `<span class="slot-status">${marked ? 'RM marked' : 'RM'}</span>` : '<span></span>'}
      </div>`;
  }).join('');

  els.slotList.querySelectorAll('.slot-row[data-slot]').forEach((row) => {
    row.addEventListener('click', () => {
      selectSlot(row.dataset.slot);
    });
  });
}

function selectSlot(slotName) {
  if (!slotName) return;
  state.selectedSlotName = slotName;
  state.lastSlotInspectorHtml = '';

  if (isRmSlot(slotName)) {
    toggleSlotMark(slotName, { renderList: false });
  }

  renderSlotList();
  renderSlotInspector();
  renderDebugBounds();
}

function isRmSlot(slotName) {
  return /^rm[_-]/i.test(slotName || '');
}

function toggleSlotMark(slotName, options = {}) {
  if (!slotName) return;
  if (state.markedSlots.has(slotName)) state.markedSlots.delete(slotName);
  else state.markedSlots.add(slotName);
  syncMarkers();
  if (options.renderList !== false) renderSlotList();
  renderDebugBounds();
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
      // Older runtimes may not expose slot-object helpers.
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

function onDebugBoundsToggle() {
  state.showSpineBounds = Boolean(els.showSpineBounds?.checked);
  state.showSlotBounds = Boolean(els.showSlotBounds?.checked);
  state.showAttachmentBounds = Boolean(els.showAttachmentBounds?.checked);
  renderDebugBounds();
}

function renderSlotInspector() {
  if (!els.slotInspector) return;
  if (!state.spine) {
    updateSlotInspectorHtml('Load a Spine and select a slot.');
    return;
  }

  const slotName = state.selectedSlotName;
  if (!slotName) {
    updateSlotInspectorHtml('Select a slot from the slot list to inspect attachment, bone, color, and bounds.');
    return;
  }

  const slot = getRuntimeSlot(slotName);
  const slotData = getSlotData(slotName);
  if (!slot && !slotData) {
    updateSlotInspectorHtml(`Slot not found: ${escapeHtml(slotName)}`);
    return;
  }

  const attachment = slot?.attachment || null;
  const attachmentName = attachment?.name || slotData?.attachmentName || '(none)';
  const bone = slot?.bone || null;
  const color = slot?.color || null;
  const visible = Boolean(attachment) && (!color || color.a > 0.001);
  const attachmentBounds = getAttachmentStageBounds(slot);
  const blendMode = formatBlendMode(slotData?.blendMode ?? slot?.data?.blendMode ?? slot?.blendMode);
  const attachmentType = attachment?.constructor?.name || (attachment ? 'Attachment' : '(none)');

  const rows = [
    ['Slot', slotName],
    ['Attachment', attachmentName],
    ['Attachment type', attachmentType],
    ['Visible', visible ? 'true' : 'false'],
    ['Blend mode', blendMode],
    ['Color', color ? formatColor(color) : '(runtime color unavailable)'],
    ['Bone', bone?.data?.name || bone?.name || slotData?.boneData?.name || '(none)'],
    ['Bone world', bone ? `x=${formatNumber(bone.worldX)}, y=${formatNumber(bone.worldY)}, rot=${formatNumber(getBoneRotation(bone))}°` : '(unavailable)'],
    ['Bounds', attachmentBounds ? `x=${formatNumber(attachmentBounds.x)}, y=${formatNumber(attachmentBounds.y)}, w=${formatNumber(attachmentBounds.width)}, h=${formatNumber(attachmentBounds.height)}` : '(no drawable attachment bounds)']
  ];

  const html = `
    <div class="inspector-grid">
      ${rows.map(([label, value]) => `<div>${escapeHtml(label)}</div><div>${escapeHtml(value)}</div>`).join('')}
    </div>`;
  updateSlotInspectorHtml(html);
}

function updateSlotInspectorHtml(html) {
  if (state.lastSlotInspectorHtml === html) return;
  state.lastSlotInspectorHtml = html;
  els.slotInspector.innerHTML = html;
}

function getRuntimeSlot(slotName) {
  const skeleton = state.spine?.skeleton;
  if (!skeleton || !slotName) return null;
  if (typeof skeleton.findSlot === 'function') return skeleton.findSlot(slotName);
  return skeleton.slots?.find((slot) => slot?.data?.name === slotName || slot?.name === slotName) || null;
}

function getSlotData(slotName) {
  const data = getSkeletonData();
  if (!data || !slotName) return null;
  if (typeof data.findSlot === 'function') return data.findSlot(slotName);
  return data.slots?.find((slot) => slot?.name === slotName) || null;
}

function renderDebugBounds() {
  const g = state.debugGraphics;
  if (!g) return;
  g.clear();
  if (!state.spine) return;

  const showSpine = Boolean(state.showSpineBounds || els.showSpineBounds?.checked);
  const showSlots = Boolean(state.showSlotBounds || els.showSlotBounds?.checked);
  const showAttachments = Boolean(state.showAttachmentBounds || els.showAttachmentBounds?.checked);
  if (!showSpine && !showSlots && !showAttachments) return;

  try {
    state.spine.skeleton?.updateWorldTransform?.();
  } catch {
    // Some runtime builds update transforms during render only.
  }

  if (showSpine) {
    try {
      const bounds = state.spine.getBounds();
      drawRect(g, bounds.x, bounds.y, bounds.width, bounds.height, 0x4fc3f7, 2);
    } catch {
      // Bounds support varies across runtime/export versions.
    }
  }

  const slots = getSlotsForDebugDrawing();

  if (showAttachments) {
    for (const slot of slots) {
      drawAttachmentBounds(g, slot, slot?.data?.name === state.selectedSlotName);
    }
  }

  if (showSlots) {
    for (const slot of slots) {
      drawSlotPoint(g, slot, slot?.data?.name === state.selectedSlotName);
    }
  }
}

function getSlotsForDebugDrawing() {
  const skeleton = state.spine?.skeleton;
  if (!skeleton?.slots) return [];
  if (state.selectedSlotName) {
    const slot = getRuntimeSlot(state.selectedSlotName);
    return slot ? [slot] : [];
  }
  return skeleton.slots;
}

function drawSlotPoint(g, slot, selected) {
  const bone = slot?.bone;
  if (!bone) return;
  const point = spineLocalToStagePoint(bone.worldX, bone.worldY);
  const size = selected ? 8 : 5;
  const color = selected ? 0xffd166 : 0xa2e665;
  g.circle(point.x, point.y, size).fill({ color, alpha: selected ? 0.9 : 0.65 });
  g.moveTo(point.x - size * 2, point.y).lineTo(point.x + size * 2, point.y)
    .moveTo(point.x, point.y - size * 2).lineTo(point.x, point.y + size * 2)
    .stroke({ width: selected ? 2 : 1, color, alpha: 0.95 });
}

function drawAttachmentBounds(g, slot, selected) {
  if (!slot?.attachment) return;
  const points = getAttachmentStagePoints(slot);
  if (points.length >= 3) {
    const color = selected ? 0xffd166 : 0xff7ab6;
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) g.lineTo(points[i].x, points[i].y);
    g.lineTo(points[0].x, points[0].y).stroke({ width: selected ? 2 : 1, color, alpha: selected ? 1 : 0.65 });
  }

  const bounds = getAttachmentStageBounds(slot);
  if (bounds) {
    drawRect(g, bounds.x, bounds.y, bounds.width, bounds.height, selected ? 0xffd166 : 0xff7ab6, selected ? 2 : 1);
  }
}

function drawRect(g, x, y, width, height, color, lineWidth = 1) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  g.rect(x, y, width, height).stroke({ width: lineWidth, color, alpha: 0.95 });
}

function getAttachmentStageBounds(slot) {
  const points = getAttachmentStagePoints(slot);
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function getAttachmentStagePoints(slot) {
  const localPoints = getAttachmentSpineLocalPoints(slot);
  return localPoints.map((point) => spineLocalToStagePoint(point.x, point.y));
}

function getAttachmentSpineLocalPoints(slot) {
  const attachment = slot?.attachment;
  if (!attachment) return [];

  if (typeof attachment.computeWorldVertices === 'function') {
    const meshLength = Number(attachment.worldVerticesLength || 0);
    if (meshLength > 0) {
      try {
        const vertices = new Float32Array(meshLength);
        attachment.computeWorldVertices(slot, 0, meshLength, vertices, 0, 2);
        return verticesToPoints(vertices);
      } catch {
        // Attachment APIs differ by runtime/export type.
      }
    }

    try {
      const vertices = new Float32Array(8);
      attachment.computeWorldVertices(slot, vertices, 0, 2);
      return verticesToPoints(vertices);
    } catch {
      // Attachment APIs differ by runtime/export type.
    }
  }

  const bone = slot?.bone;
  if (bone) return [{ x: bone.worldX, y: bone.worldY }];
  return [];
}

function verticesToPoints(vertices) {
  const points = [];
  for (let i = 0; i < vertices.length; i += 2) {
    const x = vertices[i];
    const y = vertices[i + 1];
    if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
  }
  return points;
}

function spineLocalToStagePoint(x, y) {
  const point = { x, y };
  try {
    if (state.spine?.worldTransform?.apply) return state.spine.worldTransform.apply(point);
    if (state.spine?.toGlobal) return state.spine.toGlobal(point);
  } catch {
    // Fall through to untransformed coordinates.
  }
  return point;
}

function formatColor(color) {
  const r = Math.round((color.r ?? 1) * 255).toString(16).padStart(2, '0');
  const g = Math.round((color.g ?? 1) * 255).toString(16).padStart(2, '0');
  const b = Math.round((color.b ?? 1) * 255).toString(16).padStart(2, '0');
  const a = color.a ?? 1;
  return `#${r}${g}${b}, alpha=${formatNumber(a, 2)}`;
}

function formatBlendMode(value) {
  if (value == null) return '(default)';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    const names = ['normal', 'additive', 'multiply', 'screen'];
    return names[value] || String(value);
  }
  if (value.name) return value.name;
  return String(value);
}

function getBoneRotation(bone) {
  if (typeof bone.getWorldRotationX === 'function') return bone.getWorldRotationX();
  if (Number.isFinite(bone.worldRotation)) return bone.worldRotation;
  if (Number.isFinite(bone.rotation)) return bone.rotation;
  return 0;
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : 'n/a';
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


function renderImageReport() {
  if (!state.lastImageReport.length) {
    els.imageList.textContent = 'No image checks yet.';
    return;
  }

  els.imageList.innerHTML = state.lastImageReport.map((item) => {
    const cls = item.status === 'ok' ? 'ok' : item.status === 'warn' ? 'warn' : 'error';
    const note = item.note ? ` — ${item.note}` : '';
    return `<span class="badge ${cls}" title="${escapeHtml(item.url)}${escapeHtml(note)}">${escapeHtml(item.name)}</span>`;
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
  renderDebugBounds();
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
  renderDebugBounds();
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

function setStatus(message) {
  els.status.textContent = message;
}
