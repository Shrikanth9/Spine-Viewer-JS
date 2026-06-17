export function getAppTemplate() {
  return `
  <aside class="panel">
    <h1>Spine Viewer JS</h1>
    <label>Spine files (skeleton .json/.spine, .atlas)</label>
    <input id="skeletonInput" type="file" accept=".json,.spine,.skel,.atlas" multiple />

    <label for="textureSourceMode">Texture source</label>
    <select id="textureSourceMode">
      <option value="sprites">Sprites</option>
      <option value="spritesheets">Spritesheets</option>
    </select>

    <div id="spriteUploadSection" class="upload-section">
      <label>Sprite image files (.png, .jpg, .jpeg, .webp)</label>
      <input id="imageInput" type="file" accept=".png,.jpg,.jpeg,.webp" multiple />
      <p class="small">Use this when every atlas region has its own image file with the same name.</p>
    </div>

    <div id="spritesheetUploadSection" class="upload-section hidden">
      <label>Spritesheet files (.json + .png/.jpg/.webp)</label>
      <input id="spritesheetInput" type="file" accept=".json,.png,.jpg,.jpeg,.webp" multiple />
      <p class="small">Use this when atlas region images are packed inside TexturePacker spritesheet JSON files. Upload all related multipack JSON + image files.</p>
    </div>

    <label for="uploadedSkeletonSelect">Select uploaded spine skeleton</label>
    <select id="uploadedSkeletonSelect"></select>

    <h2>Animation</h2>
    <select id="animationSelect"></select>

    <h2>Track Mixer</h2>
    <label>Track number</label>
    <input id="trackNumber" type="number" min="0" max="15" value="0" />
    <p class="small">Track 0 is base animation. Higher track numbers override lower tracks when they animate the same bone/slot.</p>
    <div class="button-grid">
      <button type="button" id="playBtn">Play on Track</button>
      <button type="button" id="pauseBtn" class="secondary">Pause</button>
    </div>
    <div class="button-grid">
      <button type="button" id="clearTrackBtn" class="secondary">Clear Track</button>
      <button type="button" id="clearAllTracksBtn" class="danger">Clear All Tracks</button>
    </div>
    <div id="activeTracks" class="small report-box">No active tracks.</div>
    <p class="small">Active track list shows progress percentage only, so looping animations will not look like an infinite timer.</p>
    <div class="button-grid">
      <button type="button" id="prevFrameBtn" class="secondary">Prev Frame</button>
      <button type="button" id="nextFrameBtn" class="secondary">Next Frame</button>
    </div>
    <label>Playback speed: <span id="speedValue">1.00x</span></label>
    <input id="speedRange" type="range" min="0.1" max="3" value="1" step="0.1" />
    <label>Timeline <span id="timelineTime">0.00 / 0.00</span></label>
    <input id="timelineRange" type="range" min="0" max="1" value="0" step="0.001" />
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

    <h2>Debug Tools</h2>
    <div class="checkbox-row stacked">
      <label><input id="showSpineBounds" type="checkbox"/> Spine bounds</label>
      <label><input id="showSlotBounds" type="checkbox"/> Slot transform points</label>
      <label><input id="showAttachmentBounds" type="checkbox"/> Attachment bounds</label>
    </div>


    <h2>Slots</h2>
    <p class="small">Click any slot to inspect it. Clicking an <code>rm_</code> slot automatically toggles its transform marker.</p>
    <div id="slotList" class="list"></div>
    <button type="button" id="clearMarksBtn" class="danger">Clear RM Marks</button>

    <h2>Slot / Attachment Inspector</h2>
    <div id="slotInspector" class="small report-box">Load a Spine and select a slot.</div>

    <h2>Image Detection</h2>
    <div id="imageList" class="small"></div>

    <h2>Events</h2>
    <div id="eventLog" class="small list"></div>

    <div id="status" class="status">Ready.</div>
  </aside>
  <main id="viewer" class="viewer"></main>
`;
}
