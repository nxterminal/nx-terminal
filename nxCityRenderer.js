/**
 * nxCityRenderer.js
 *
 * Pure Canvas 2D rendering module for NX CITY.
 * No React. No DOM access except the canvas passed in.
 *
 * The renderer is consumed by the NXCity component which:
 *   1) creates a render context (rc) with createRenderContext()
 *   2) calls advanceFrame(rc, deltaMs) inside a requestAnimationFrame loop
 *   3) feeds in updates (addBuilding, removeBuilding, applyEvent, etc.)
 *      coming from the useNxCity hook.
 *
 * All draw functions take `rc` as their first arg. They read ctx, camera,
 * time, viewport size, and city state from there.
 *
 * Ported from nxcity-prototype-v0.6.html. Geometry is iso (TW=22, TH=11).
 */

import {
  GRID_SIZE,
  BLOCK_SIZE,
  TW,
  TH,
  TIERS,
  ZONE,
  FACADES,
  NEONS,
  WEATHERS,
  hash32,
  sRand,
  shade,
  rgba,
  mixColors,
  daylightFactor,
  currentPhase
} from './nxCityConstants.js';

import {
  ARCHETYPES,
  drawBuildingArchetype
} from './nxCityArchetypes.js';

/* ========================================================================
   RENDER CONTEXT
   ======================================================================== */

/**
 * Create the render context for a single canvas instance.
 * Call once when the canvas mounts. Pass it to every draw fn.
 */
export function createRenderContext(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('NXCITY: 2D context unavailable');
  }
  const rc = {
    canvas,
    ctx,
    W: 0,
    H: 0,
    DPR: 1,
    camera: { x: 0, y: 0, zoom: 1, targetZoom: 1 },
    initialCameraY: 0,
    time: 0,
    state: createCityState(),
    settings: {
      flicker: true,
      vehicles: true,
      aircraft: true,
      weather: true,
      eventAnims: true,
      crt: true,
      autoCenter: true,
      preset: 'high'
    },
    // performance auto-degrade flag (set when buildings > threshold)
    perfReduced: false
  };
  resizeCanvas(rc);
  return rc;
}

/**
 * Recompute canvas size in CSS px and DPR-scaled backing pixels.
 * Call on window resize.
 */
export function resizeCanvas(rc) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = rc.canvas.clientWidth || rc.canvas.parentElement?.clientWidth || 800;
  const cssH = rc.canvas.clientHeight || rc.canvas.parentElement?.clientHeight || 600;
  rc.canvas.width = cssW * dpr;
  rc.canvas.height = cssH * dpr;
  rc.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  rc.W = cssW;
  rc.H = cssH;
  rc.DPR = dpr;
  // initial camera Y centers the iso diamond
  rc.initialCameraY = -((GRID_SIZE / 2) * TH) / 2;
  if (rc.camera.x === 0 && rc.camera.y === 0) {
    rc.camera.y = rc.initialCameraY;
  }
}

/* ========================================================================
   CITY STATE
   ======================================================================== */

export function createCityState() {
  // Occupied tiles: 0 empty, 1 building, 2 street, 3 park, 4 lake, 5 plaza
  const occupied = new Uint8Array(GRID_SIZE * GRID_SIZE);
  // pre-mark streets
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      if (gx % BLOCK_SIZE === 0 || gy % BLOCK_SIZE === 0) {
        occupied[gy * GRID_SIZE + gx] = 2;
      }
    }
  }
  // Functional zones per block (DOWNTOWN, MIXED, RESIDENTIAL, INDUSTRIAL, ENTERTAINMENT)
  const blocksPerSide = GRID_SIZE / BLOCK_SIZE;
  const blockZones = new Int8Array(blocksPerSide * blocksPerSide);
  const center = blocksPerSide / 2;
  for (let by = 0; by < blocksPerSide; by++) {
    for (let bx = 0; bx < blocksPerSide; bx++) {
      const dx = bx - center, dy = by - center;
      const d = Math.sqrt(dx * dx + dy * dy);
      let zone;
      if (d < 4) zone = ZONE.DOWNTOWN;
      else if (d < 8) zone = ZONE.MIXED;
      else if (bx < 7 && by > blocksPerSide - 7) zone = ZONE.INDUSTRIAL;
      else if (bx > blocksPerSide - 7 && by < 7) zone = ZONE.ENTERTAINMENT;
      else zone = ZONE.RESIDENTIAL;
      blockZones[by * blocksPerSide + bx] = zone;
    }
  }
  // Reserve parks, plaza, lakes (deterministic positions)
  const parks = [];
  const lakes = [];
  const plazas = [];
  // Central plaza
  const c = GRID_SIZE / 2;
  const plazaGx = Math.floor(c - BLOCK_SIZE / 2) - (Math.floor(c - BLOCK_SIZE / 2) % BLOCK_SIZE) + 1;
  if (canPlace(occupied, plazaGx, plazaGx, BLOCK_SIZE - 1, BLOCK_SIZE - 1)) {
    setRect(occupied, plazaGx, plazaGx, BLOCK_SIZE - 1, BLOCK_SIZE - 1, 5);
    plazas.push({ gx: plazaGx, gy: plazaGx, w: BLOCK_SIZE - 1, d: BLOCK_SIZE - 1 });
  }
  const parkSpots = [
    { bx: 5, by: 5, w: 1, h: 1 }, { bx: 22, by: 4, w: 1, h: 1 },
    { bx: 6, by: 22, w: 1, h: 1 }, { bx: 20, by: 20, w: 2, h: 1 },
    { bx: 13, by: 7, w: 1, h: 1 }, { bx: 8, by: 14, w: 1, h: 1 },
    { bx: 18, by: 12, w: 1, h: 1 }, { bx: 12, by: 21, w: 1, h: 2 }
  ];
  for (const p of parkSpots) {
    const gx = p.bx * BLOCK_SIZE + 1;
    const gy = p.by * BLOCK_SIZE + 1;
    const w = p.w * BLOCK_SIZE - 1;
    const h = p.h * BLOCK_SIZE - 1;
    if (canPlace(occupied, gx, gy, w, h)) {
      setRect(occupied, gx, gy, w, h, 3);
      parks.push({ gx, gy, w, d: h });
    }
  }
  const lakeSpots = [
    { bx: 16, by: 3, w: 2, h: 2 },
    { bx: 4, by: 18, w: 2, h: 2 }
  ];
  for (const p of lakeSpots) {
    const gx = p.bx * BLOCK_SIZE + 1;
    const gy = p.by * BLOCK_SIZE + 1;
    const w = p.w * BLOCK_SIZE - 1;
    const h = p.h * BLOCK_SIZE - 1;
    if (canPlace(occupied, gx, gy, w, h)) {
      setRect(occupied, gx, gy, w, h, 4);
      lakes.push({ gx, gy, w, d: h });
    }
  }
  return {
    occupied,
    blockZones,
    parks,
    lakes,
    plazas,
    buildings: [],
    buildingsByDevId: new Map(),
    buildingsByBuildingId: new Map(),
    vehicles: [],
    skycars: [],
    drones: [],
    airplanes: [],
    effects: [],
    highlightedBuildings: new Map(), // bid -> expiresAt
    weather: {
      current: 'CLEAR',
      endsAt: 0,
      nextCheckAt: Date.now() + 30000,
      particles: [],
      meteors: [],
      fireworks: [],
      ufo: null,
      lightning: { active: false, until: 0 },
      fogAlpha: 0,
      auroraPhase: 0,
      _lastBurst: 0
    }
  };
}

function canPlace(occupied, gx, gy, w, d) {
  if (gx < 1 || gy < 1 || gx + w >= GRID_SIZE - 1 || gy + d >= GRID_SIZE - 1) return false;
  for (let dy = 0; dy < d; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (occupied[(gy + dy) * GRID_SIZE + (gx + dx)] !== 0) return false;
    }
  }
  return true;
}

function setRect(occupied, gx, gy, w, d, val) {
  for (let dy = 0; dy < d; dy++) {
    for (let dx = 0; dx < w; dx++) {
      occupied[(gy + dy) * GRID_SIZE + (gx + dx)] = val;
    }
  }
}

function blockZoneAt(state, gx, gy) {
  const blocksPerSide = GRID_SIZE / BLOCK_SIZE;
  const bx = Math.floor(gx / BLOCK_SIZE);
  const by = Math.floor(gy / BLOCK_SIZE);
  return state.blockZones[by * blocksPerSide + bx];
}

/* ========================================================================
   ISO PROJECTION
   ======================================================================== */

export function iso(rc, gx, gy, z = 0) {
  const zoom = rc.camera.zoom;
  return {
    x: rc.W / 2 + rc.camera.x + (gx - gy) * (TW / 2) * zoom,
    y: rc.H / 2 - 80 + rc.camera.y + (gx + gy) * (TH / 2) * zoom - z * zoom
  };
}

/* ========================================================================
   PLOT FINDER & BUILDING LIFECYCLE
   ======================================================================== */

function findPlot(state, devId, currentDevCount) {
  const rnd = sRand(hash32('plot_' + devId));
  const tier = getTier(currentDevCount);
  const cx = GRID_SIZE / 2;
  const cy = GRID_SIZE / 2;

  for (let attempt = 0; attempt < 100; attempt++) {
    const sigma = GRID_SIZE * 0.22 * (1 + attempt * 0.03);
    const u1 = Math.max(1e-6, rnd());
    const u2 = rnd();
    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
    const targGx = Math.round(cx + z1 * sigma);
    const targGy = Math.round(cy + z2 * sigma);
    const bx0 = Math.floor(targGx / BLOCK_SIZE) * BLOCK_SIZE;
    const by0 = Math.floor(targGy / BLOCK_SIZE) * BLOCK_SIZE;
    if (bx0 < 0 || by0 < 0 || bx0 >= GRID_SIZE - BLOCK_SIZE || by0 >= GRID_SIZE - BLOCK_SIZE) continue;

    const zone = blockZoneAt(state, bx0, by0);
    const cands = ARCHETYPES.filter(a => a.tiers.includes(tier.idx) && a.zones.includes(zone));
    if (cands.length === 0) continue;
    let tot = 0;
    for (const c of cands) tot += c.weight;
    let r = rnd() * tot;
    let pick = cands[0];
    for (const c of cands) {
      r -= c.weight;
      if (r <= 0) { pick = c; break; }
    }
    const [fw, fd] = pick.footprint;
    const height = pick.minH + Math.floor(rnd() * (pick.maxH - pick.minH + 1));
    const maxOx = Math.max(1, BLOCK_SIZE - fw - 1);
    const maxOy = Math.max(1, BLOCK_SIZE - fd - 1);
    for (let tr = 0; tr < 8; tr++) {
      const gx = bx0 + 1 + Math.floor(rnd() * maxOx);
      const gy = by0 + 1 + Math.floor(rnd() * maxOy);
      if (canPlace(state.occupied, gx, gy, fw, fd)) {
        return { gx, gy, archetype: pick, height, fw, fd };
      }
    }
  }
  // Fallback: outward radial scan for 1x1 house
  const house = ARCHETYPES[0];
  for (let rad = 1; rad < GRID_SIZE / 2; rad++) {
    for (let i = 0; i < 30; i++) {
      const ang = rnd() * Math.PI * 2;
      const gxc = Math.round(cx + Math.cos(ang) * rad * BLOCK_SIZE);
      const gyc = Math.round(cy + Math.sin(ang) * rad * BLOCK_SIZE);
      const bx0 = Math.floor(gxc / BLOCK_SIZE) * BLOCK_SIZE + 1;
      const by0 = Math.floor(gyc / BLOCK_SIZE) * BLOCK_SIZE + 1;
      if (bx0 >= 1 && by0 >= 1 && bx0 < GRID_SIZE - 2 && by0 < GRID_SIZE - 2
          && canPlace(state.occupied, bx0, by0, 1, 1)) {
        return { gx: bx0, gy: by0, archetype: house, height: 3, fw: 1, fd: 1 };
      }
    }
  }
  return null;
}

export function getTier(devCount) {
  for (const t of TIERS) if (devCount >= t.min && devCount < t.max) return t;
  return TIERS[TIERS.length - 1];
}

/**
 * Add a dev as a building. Idempotent by devId — if already present, returns existing.
 * Returns the building or null if no plot available.
 */
export function addBuildingForDev(rc, devId, walletAddr, currentDevCount) {
  const state = rc.state;
  if (state.buildingsByDevId.has(devId)) return state.buildingsByDevId.get(devId);
  const plot = findPlot(state, devId, currentDevCount);
  if (!plot) return null;
  const rnd = sRand(hash32('bldg_' + devId));
  const palette = FACADES[Math.floor(rnd() * FACADES.length)];
  const neon = NEONS[Math.floor(rnd() * NEONS.length)];
  const b = {
    id: 'd' + devId,
    devId,
    wallet: walletAddr || null,
    gx: plot.gx,
    gy: plot.gy,
    fw: plot.fw,
    fd: plot.fd,
    archetype: plot.archetype,
    height: plot.height,
    palette,
    neon,
    flicker: rnd(),
    pulse: 0, beacon: 0, check: 0, aiHolo: 0, shield: 0, firewall: 0,
    spawnAnim: 0
  };
  setRect(state.occupied, plot.gx, plot.gy, plot.fw, plot.fd, 1);
  state.buildings.push(b);
  state.buildingsByDevId.set(devId, b);
  state.buildingsByBuildingId.set(b.id, b);
  // sort once on insertion (painter's algorithm key by gx+gy front corner)
  state.buildings.sort((a, b) => (a.gx + a.fw - 1 + a.gy + a.fd - 1) - (b.gx + b.fw - 1 + b.gy + b.fd - 1));
  // auto-perf: reduce flicker/trails when too many buildings
  rc.perfReduced = state.buildings.length > 1000;
  return b;
}

/**
 * Apply an event to a specific dev's building.
 * Types: 'mint' (already handled by addBuildingForDev),
 *        'transfer', 'protocol', 'mission', 'hack', 'ai'
 */
export function applyEvent(rc, type, devId, targetDevId) {
  const state = rc.state;
  const b = devId != null ? state.buildingsByDevId.get(devId) : null;
  const t = targetDevId != null ? state.buildingsByDevId.get(targetDevId) : null;
  switch (type) {
    case 'transfer':
      if (b && t && b !== t) {
        state.effects.push({ type: 'transfer', from: b, to: t, t: 0, duration: 1.2 });
        t.pulse = 1;
      }
      break;
    case 'protocol':
      if (b) b.beacon = 1;
      break;
    case 'mission':
      if (b) { b.check = 1; b.pulse = 1; }
      break;
    case 'hack':
      if (b && t && b !== t) {
        state.effects.push({ type: 'hack', from: b, to: t, t: 0, duration: 1 });
        t.shield = 1;
        // success/fail randomized by client
        if (Math.random() > 0.6) t.firewall = 1;
      }
      break;
    case 'ai':
      if (b) b.aiHolo = 1;
      break;
  }
}

export function highlightBuildings(rc, buildingIds, durationMs = 3000) {
  const expiresAt = Date.now() + durationMs;
  for (const id of buildingIds) {
    rc.state.highlightedBuildings.set(id, expiresAt);
  }
}

/* ========================================================================
   FLEET MANAGEMENT (vehicles, skycars, drones, airplanes)
   ======================================================================== */

const VTYPES = [
  { type: 'sedan',  size: [4, 1.6], speed: 0.0018, colors: ['#FF00AA', '#00F0FF', '#FFB000', '#FFFFFF', '#FF3355', '#B066FF', '#00FF99'] },
  { type: 'sports', size: [4.5, 1.6], speed: 0.0038, colors: ['#FF3355', '#FFF066', '#00F0FF', '#FF00AA'] },
  { type: 'truck',  size: [6, 2], speed: 0.0010, colors: ['#6a6a6a', '#704030', '#4a4a50', '#804020'] },
  { type: 'van',    size: [5, 2], speed: 0.0014, colors: ['#FFFFFF', '#c0c0c0', '#a08060', '#408060'] },
  { type: 'bus',    size: [8, 2.2], speed: 0.0012, colors: ['#FFB000', '#FF6020', '#40A060'] }
];

export function syncFleet(rc, currentDevCount) {
  const state = rc.state;
  const tier = getTier(currentDevCount);
  const streetCount = Math.min(Math.floor(state.buildings.length / 3), 180);
  while (state.vehicles.length < streetCount) {
    const horizontal = Math.random() > 0.5;
    const trackBlock = 1 + Math.floor(Math.random() * (GRID_SIZE / BLOCK_SIZE - 1));
    const track = trackBlock * BLOCK_SIZE;
    const vt = VTYPES[Math.floor(Math.random() * VTYPES.length)];
    state.vehicles.push({
      horizontal, track,
      type: vt.type,
      w: vt.size[0], l: vt.size[1],
      t: Math.random(),
      speed: vt.speed * (0.8 + Math.random() * 0.5),
      dir: Math.random() > 0.5 ? 1 : -1,
      color: vt.colors[Math.floor(Math.random() * vt.colors.length)]
    });
  }
  state.vehicles.length = streetCount;

  const skyCount = tier.idx >= 3 ? (tier.idx - 2) * 6 : 0;
  while (state.skycars.length < skyCount) {
    state.skycars.push({
      horizontal: Math.random() > 0.5,
      t: Math.random(),
      offset: 10 + Math.random() * (GRID_SIZE - 20),
      speed: 0.0015 + Math.random() * 0.002,
      dir: Math.random() > 0.5 ? 1 : -1,
      z: 40 + Math.random() * 50,
      color: ['#FF00AA', '#00F0FF', '#FFB000', '#B066FF'][Math.floor(Math.random() * 4)]
    });
  }
  state.skycars.length = skyCount;

  const droneCount = Math.min(Math.floor(state.buildings.length / 20), 20);
  while (state.drones.length < droneCount) {
    state.drones.push({
      gx: Math.random() * GRID_SIZE,
      gy: Math.random() * GRID_SIZE,
      vx: (Math.random() - 0.5) * 0.015,
      vy: (Math.random() - 0.5) * 0.015,
      z: 25 + Math.random() * 40,
      blink: Math.random()
    });
  }
  state.drones.length = droneCount;

  // airplanes spawn rarely
  if (state.airplanes.length < 2 && Math.random() < 0.003) {
    state.airplanes.push({
      horizontal: Math.random() > 0.5,
      t: -0.1,
      offset: 5 + Math.random() * (GRID_SIZE - 10),
      speed: 0.00045 + Math.random() * 0.0003,
      dir: Math.random() > 0.5 ? 1 : -1,
      z: 120 + Math.random() * 40,
      size: 6 + Math.random() * 4
    });
  }
  state.airplanes = state.airplanes.filter(a => a.t < 1.15 && a.t > -0.15);
}

/* ========================================================================
   DRAW: SKY
   ======================================================================== */

function drawSky(rc, day) {
  const { ctx, W, H, time } = rc;
  const topCol  = mixColors('#1a0830', '#5a86c2', day);
  const midCol  = mixColors('#0a0318', '#9abbd8', day);
  const horzCol = mixColors('#000',    '#dfe9f5', day);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, topCol);
  grad.addColorStop(0.4, midCol);
  grad.addColorStop(1, horzCol);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Sun or moon
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  const isDayBody = h >= 6 && h < 18;
  if (isDayBody) {
    const tD = Math.max(0, Math.min(1, (h - 6) / 12));
    const skyCx = W * tD;
    const skyCy = H * 0.18 + Math.sin(tD * Math.PI) * (H * 0.10);
    ctx.fillStyle = '#fff8c4';
    ctx.shadowColor = '#ffec7a';
    ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.arc(skyCx, skyCy, 18, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    const nightT = h < 6 ? (h + 6) / 12 : (h - 18) / 12;
    const mx = W * nightT;
    const my = H * 0.15 - Math.sin(nightT * Math.PI) * (H * 0.08);
    ctx.fillStyle = '#e6e8f8';
    ctx.shadowColor = '#a0b0cc';
    ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(mx, my, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7f88a8';
    ctx.beginPath(); ctx.arc(mx - 4, my - 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 5, my + 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Stars when dark
  if (day < 0.4) {
    const sr = sRand(54321);
    const alphaMul = 1 - day / 0.4;
    for (let i = 0; i < 160; i++) {
      const x = sr() * W;
      const y = sr() * H * 0.5;
      const a = 0.3 + 0.7 * (0.5 + Math.sin(time * 0.002 + i) * 0.5);
      ctx.fillStyle = `rgba(255,255,255,${a * 0.3 * alphaMul})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Distant skyline silhouette
  ctx.fillStyle = mixColors('#140625', '#7488a2', day);
  ctx.beginPath();
  ctx.moveTo(0, H * 0.55);
  for (let i = 0; i <= 60; i++) {
    const x = (i / 60) * W;
    const h_ = (Math.sin(i * 1.7) + Math.sin(i * 3.1) + 2) * 16;
    ctx.lineTo(x, H * 0.55 - h_);
  }
  ctx.lineTo(W, H * 0.55); ctx.lineTo(W, H); ctx.lineTo(0, H);
  ctx.closePath(); ctx.fill();
}

/* ========================================================================
   DRAW: GROUND (terrain, city diamond, parks, lakes, plazas, streets)
   ======================================================================== */

function drawGround(rc, day) {
  const { ctx, W, H, state } = rc;

  // Outer terrain (dark wasteland)
  ctx.fillStyle = mixColors('#1a1622', '#3a3428', day);
  ctx.fillRect(0, H * 0.42, W, H * 0.58);
  if (rc.camera.zoom > 0.4) {
    const sr = sRand(999333);
    for (let i = 0; i < 60; i++) {
      const x = sr() * W;
      const y = H * 0.45 + sr() * H * 0.55;
      const s = 4 + sr() * 12;
      ctx.fillStyle = day > 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(0,0,0,.2)';
      ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // City diamond
  const p0 = iso(rc, 0, 0);
  const p1 = iso(rc, GRID_SIZE, 0);
  const p2 = iso(rc, GRID_SIZE, GRID_SIZE);
  const p3 = iso(rc, 0, GRID_SIZE);
  ctx.fillStyle = mixColors('#0a0714', '#404a5a', day);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
  ctx.closePath(); ctx.fill();
  // edge glow
  ctx.strokeStyle = day > 0.5 ? 'rgba(255,176,0,.3)' : 'rgba(255,0,170,.4)';
  ctx.lineWidth = 0.8;
  ctx.shadowColor = day > 0.5 ? '#FFB000' : '#FF00AA';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
  ctx.closePath(); ctx.stroke();
  ctx.shadowBlur = 0;

  for (const p of state.parks) drawPark(rc, p, day);
  for (const p of state.plazas) drawPlaza(rc, p, day);
  for (const p of state.lakes) drawLake(rc, p, day);

  // Streets
  ctx.strokeStyle = mixColors('#1a1726', '#2a2d36', day);
  ctx.lineWidth = (TH * 1.2) * rc.camera.zoom;
  ctx.lineCap = 'round';
  for (let i = 0; i <= GRID_SIZE; i += BLOCK_SIZE) {
    const a = iso(rc, 0, i), b = iso(rc, GRID_SIZE, i);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    const c = iso(rc, i, 0), d = iso(rc, i, GRID_SIZE);
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  }

  // Static dashed lane markings (anchored to world coords)
  if (rc.camera.zoom > 0.6) {
    ctx.strokeStyle = day > 0.5 ? 'rgba(255,255,255,.4)' : 'rgba(255,0,170,0.3)';
    ctx.lineWidth = 0.7;
    for (let gy = 0; gy <= GRID_SIZE; gy += BLOCK_SIZE) {
      for (let gx = 0; gx < GRID_SIZE; gx += 2) {
        const a = iso(rc, gx + 0.3, gy);
        const b = iso(rc, gx + 1.7, gy);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    for (let gx = 0; gx <= GRID_SIZE; gx += BLOCK_SIZE) {
      for (let gy = 0; gy < GRID_SIZE; gy += 2) {
        const a = iso(rc, gx, gy + 0.3);
        const b = iso(rc, gx, gy + 1.7);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }

  // Street lamps
  if (rc.camera.zoom > 0.6) {
    for (let gy = 0; gy <= GRID_SIZE; gy += BLOCK_SIZE * 2) {
      for (let gx = 0; gx <= GRID_SIZE; gx += BLOCK_SIZE * 2) {
        const p = iso(rc, gx, gy);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 6 * rc.camera.zoom); ctx.stroke();
        if (day < 0.6) {
          ctx.fillStyle = '#FFB000';
          ctx.shadowColor = '#FFB000';
          ctx.shadowBlur = 4 * rc.camera.zoom;
          ctx.fillRect(p.x - 1, p.y - 7 * rc.camera.zoom, 2, 2);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = '#666';
          ctx.fillRect(p.x - 1, p.y - 7 * rc.camera.zoom, 2, 2);
        }
      }
    }
  }
}

function drawPark(rc, p, day) {
  const { ctx } = rc;
  const c00 = iso(rc, p.gx, p.gy);
  const c10 = iso(rc, p.gx + p.w, p.gy);
  const c11 = iso(rc, p.gx + p.w, p.gy + p.d);
  const c01 = iso(rc, p.gx, p.gy + p.d);
  ctx.fillStyle = mixColors('#1d3a20', '#3a7a3a', day);
  ctx.beginPath();
  ctx.moveTo(c00.x, c00.y); ctx.lineTo(c10.x, c10.y); ctx.lineTo(c11.x, c11.y); ctx.lineTo(c01.x, c01.y);
  ctx.closePath(); ctx.fill();
  if (rc.camera.zoom > 0.6) {
    const sr = sRand(hash32('park_' + p.gx + '_' + p.gy));
    for (let i = 0; i < p.w * p.d * 6; i++) {
      const rx = sr() * p.w, ry = sr() * p.d;
      const pp = iso(rc, p.gx + rx, p.gy + ry);
      ctx.fillStyle = day > 0.5 ? '#2a6030' : '#18331a';
      ctx.fillRect(pp.x, pp.y - 0.5, 1, 1);
    }
  }
  const sr2 = sRand(hash32('trees_' + p.gx + '_' + p.gy));
  const treeCount = Math.floor(p.w * p.d * 0.8);
  for (let i = 0; i < treeCount; i++) {
    const rx = 0.3 + sr2() * (p.w - 0.6);
    const ry = 0.3 + sr2() * (p.d - 0.6);
    drawTree(rc, p.gx + rx, p.gy + ry, day);
  }
  ctx.strokeStyle = day > 0.5 ? '#b8a880' : '#4a4028';
  ctx.lineWidth = 1.5 * rc.camera.zoom;
  const pa = iso(rc, p.gx, p.gy + p.d / 2);
  const pb = iso(rc, p.gx + p.w, p.gy + p.d / 2);
  ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
}

function drawTree(rc, gx, gy, day) {
  const { ctx } = rc;
  const z = rc.camera.zoom;
  if (z < 0.35) return;
  const p = iso(rc, gx, gy);
  ctx.fillStyle = '#4a3320';
  ctx.fillRect(p.x - 0.6, p.y - 5 * z, 1.2, 5 * z);
  const canColor = day > 0.5 ? '#2a8a3a' : '#1a4a24';
  const sh = day > 0.5 ? '#1a6a28' : '#0e3018';
  ctx.fillStyle = sh;
  ctx.beginPath(); ctx.arc(p.x, p.y - 6 * z, 4 * z, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = canColor;
  ctx.beginPath(); ctx.arc(p.x - 0.7, p.y - 6.5 * z, 3.4 * z, 0, Math.PI * 2); ctx.fill();
}

function drawPlaza(rc, p, day) {
  const { ctx, time } = rc;
  const z = rc.camera.zoom;
  const c00 = iso(rc, p.gx, p.gy);
  const c10 = iso(rc, p.gx + p.w, p.gy);
  const c11 = iso(rc, p.gx + p.w, p.gy + p.d);
  const c01 = iso(rc, p.gx, p.gy + p.d);
  ctx.fillStyle = mixColors('#2a2a3a', '#a09080', day);
  ctx.beginPath();
  ctx.moveTo(c00.x, c00.y); ctx.lineTo(c10.x, c10.y); ctx.lineTo(c11.x, c11.y); ctx.lineTo(c01.x, c01.y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = day > 0.5 ? '#c8b8a0' : '#40384a';
  ctx.lineWidth = 1.5 * z;
  const mh1 = iso(rc, p.gx, p.gy + p.d / 2);
  const mh2 = iso(rc, p.gx + p.w, p.gy + p.d / 2);
  const mv1 = iso(rc, p.gx + p.w / 2, p.gy);
  const mv2 = iso(rc, p.gx + p.w / 2, p.gy + p.d);
  ctx.beginPath(); ctx.moveTo(mh1.x, mh1.y); ctx.lineTo(mh2.x, mh2.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mv1.x, mv1.y); ctx.lineTo(mv2.x, mv2.y); ctx.stroke();
  const fc = iso(rc, p.gx + p.w / 2, p.gy + p.d / 2);
  ctx.fillStyle = day > 0.5 ? '#5a7a9a' : '#1a3a6a';
  ctx.beginPath(); ctx.arc(fc.x, fc.y, 5 * z, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = day > 0.5 ? '#88b8d8' : '#4080c8';
  ctx.beginPath(); ctx.arc(fc.x, fc.y, 3.5 * z, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + time * 0.001;
    const jx = fc.x + Math.cos(a) * 2 * z;
    const jy = fc.y + Math.sin(a) * z;
    ctx.fillStyle = 'rgba(180,220,255,.7)';
    ctx.fillRect(jx, jy - 4 * z, 0.8, 4 * z);
  }
  drawTree(rc, p.gx + 0.5, p.gy + 0.5, day);
  drawTree(rc, p.gx + p.w - 0.5, p.gy + 0.5, day);
  drawTree(rc, p.gx + 0.5, p.gy + p.d - 0.5, day);
  drawTree(rc, p.gx + p.w - 0.5, p.gy + p.d - 0.5, day);
}

function drawLake(rc, p, day) {
  const { ctx, time } = rc;
  const z = rc.camera.zoom;
  const c00 = iso(rc, p.gx, p.gy);
  const c10 = iso(rc, p.gx + p.w, p.gy);
  const c11 = iso(rc, p.gx + p.w, p.gy + p.d);
  const c01 = iso(rc, p.gx, p.gy + p.d);
  ctx.fillStyle = day > 0.5 ? '#6e6650' : '#352d20';
  ctx.beginPath();
  ctx.moveTo(c00.x, c00.y); ctx.lineTo(c10.x, c10.y); ctx.lineTo(c11.x, c11.y); ctx.lineTo(c01.x, c01.y);
  ctx.closePath(); ctx.fill();
  const ins = 0.4;
  const i00 = iso(rc, p.gx + ins, p.gy + ins);
  const i10 = iso(rc, p.gx + p.w - ins, p.gy + ins);
  const i11 = iso(rc, p.gx + p.w - ins, p.gy + p.d - ins);
  const i01 = iso(rc, p.gx + ins, p.gy + p.d - ins);
  const wa = mixColors('#0a1e5a', '#4080c8', day);
  ctx.fillStyle = wa;
  ctx.beginPath();
  ctx.moveTo(i00.x, i00.y); ctx.lineTo(i10.x, i10.y); ctx.lineTo(i11.x, i11.y); ctx.lineTo(i01.x, i01.y);
  ctx.closePath(); ctx.fill();
  if (rc.camera.zoom > 0.5) {
    ctx.strokeStyle = day > 0.5 ? 'rgba(255,255,255,.3)' : 'rgba(120,180,255,.25)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const t = (time * 0.0005 + i * 0.25) % 1;
      const rx = ins + t * (p.w / 2 - ins);
      const ec = iso(rc, p.gx + p.w / 2, p.gy + p.d / 2);
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.ellipse(ec.x, ec.y, rx * TW / 2 * z, rx * TH / 2 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/* ========================================================================
   DRAW: BUILDING (delegates to archetype + applies event effects)
   ======================================================================== */

function drawBuilding(rc, b, day) {
  const { ctx, time } = rc;
  const p = iso(rc, b.gx, b.gy);
  const z = rc.camera.zoom;
  const alpha = b.spawnAnim;
  ctx.globalAlpha = alpha;
  drawBuildingArchetype(rc, b, p, z, alpha, day);
  ctx.globalAlpha = 1;

  // Event effects
  const midP = iso(rc, b.gx + b.fw / 2 - 0.5, b.gy + b.fd / 2 - 0.5);
  const topY = midP.y - (b.height * 4 + 4) * z;

  if (b.pulse > 0) {
    for (let i = 0; i < 6; i++) {
      const pt = (b.pulse + i / 6) % 1;
      ctx.fillStyle = '#FFB000';
      ctx.globalAlpha = alpha * (1 - pt) * 0.9;
      ctx.shadowColor = '#FFB000'; ctx.shadowBlur = 8;
      ctx.fillRect(midP.x - 0.5, topY - pt * 40 * z, 1 * z, 3 * z);
    }
    ctx.shadowBlur = 0;
    b.pulse -= 0.015; if (b.pulse < 0) b.pulse = 0;
  }
  if (b.beacon > 0) {
    ctx.strokeStyle = '#00F0FF'; ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00F0FF'; ctx.shadowBlur = 12;
    ctx.globalAlpha = alpha * b.beacon;
    ctx.beginPath();
    ctx.ellipse(midP.x, topY, (18 * (1 - b.beacon)) * z, (18 * (1 - b.beacon)) * z * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke(); ctx.shadowBlur = 0;
    b.beacon -= 0.02;
  }
  if (b.check > 0) {
    const cy = topY - 8 * z - (1 - b.check) * 15 * z;
    ctx.fillStyle = '#00FF99';
    ctx.globalAlpha = alpha * b.check;
    ctx.shadowColor = '#00FF99'; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(midP.x - 3 * z, cy);
    ctx.lineTo(midP.x - 1 * z, cy + 2 * z);
    ctx.lineTo(midP.x + 3 * z, cy - 2 * z);
    ctx.lineTo(midP.x + 2 * z, cy - 3 * z);
    ctx.lineTo(midP.x - 1 * z, cy);
    ctx.lineTo(midP.x - 2 * z, cy - 1 * z);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    b.check -= 0.018;
  }
  if (b.aiHolo > 0) {
    ctx.strokeStyle = '#00F0FF'; ctx.lineWidth = 1;
    ctx.globalAlpha = alpha * b.aiHolo;
    ctx.shadowColor = '#00F0FF'; ctx.shadowBlur = 10;
    const cy = topY - 10 * z;
    for (let i = 0; i < 3; i++) {
      const rot = time * 0.003 + i * 2;
      ctx.beginPath();
      ctx.ellipse(midP.x, cy, 6 * z, 2 * z, rot, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    b.aiHolo -= 0.008;
  }
  if (b.firewall > 0) {
    ctx.strokeStyle = '#FF3355'; ctx.lineWidth = 1.5;
    ctx.globalAlpha = alpha * b.firewall;
    ctx.shadowColor = '#FF3355'; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(midP.x, topY + (b.height * 2) * z, (b.height * 3) * z, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    b.firewall -= 0.02;
  }
  if (b.shield > 0) {
    ctx.strokeStyle = '#FF00AA'; ctx.lineWidth = 1.5;
    ctx.globalAlpha = alpha * b.shield * (0.5 + Math.random() * 0.5);
    ctx.shadowColor = '#FF00AA'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(midP.x, topY + (b.height * 2) * z, (b.height * 3) * z, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    b.shield -= 0.02;
  }
  ctx.globalAlpha = 1;

  if (b.spawnAnim < 1) b.spawnAnim = Math.min(1, b.spawnAnim + 0.015);
}

/* ========================================================================
   DRAW: VEHICLES
   ======================================================================== */

function drawVehicleBody(rc, x, y, w, l, color, dir, horizontal, day) {
  const { ctx } = rc;
  const z = rc.camera.zoom;
  const W_ = w * z * 0.5;
  const L_ = l * z * 0.5;
  ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 4;
  if (horizontal) ctx.fillRect(x - W_, y - L_, W_ * 2, L_ * 2);
  else ctx.fillRect(x - L_, y - W_, L_ * 2, W_ * 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = shade(color, 0.6);
  if (horizontal) ctx.fillRect(x - W_ * 0.6, y - L_ * 0.8, W_ * 1.2, L_ * 1.4);
  else ctx.fillRect(x - L_ * 0.8, y - W_ * 0.6, L_ * 1.4, W_ * 1.2);
  if (day < 0.6) {
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#ffec7a'; ctx.shadowBlur = 8;
    if (horizontal) {
      const fx = x + dir * W_;
      ctx.fillRect(fx - dir * 0.8, y - L_ * 0.5, 0.8, L_ * 0.4);
      ctx.fillRect(fx - dir * 0.8, y + L_ * 0.1, 0.8, L_ * 0.4);
    } else {
      const fy = y + dir * W_;
      ctx.fillRect(x - L_ * 0.5, fy - dir * 0.8, L_ * 0.4, 0.8);
      ctx.fillRect(x + L_ * 0.1, fy - dir * 0.8, L_ * 0.4, 0.8);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff3333';
    if (horizontal) {
      const rx = x - dir * W_;
      ctx.fillRect(rx, y - L_ * 0.4, 0.6, L_ * 0.3);
      ctx.fillRect(rx, y + L_ * 0.1, 0.6, L_ * 0.3);
    }
  }
}

function updateVehicles(rc) {
  for (const v of rc.state.vehicles) {
    v.t += v.speed * v.dir;
    if (v.t > 1.1) v.t = -0.1;
    if (v.t < -0.1) v.t = 1.1;
  }
}

function drawOneVehicle(rc, v, day) {
  let gx, gy;
  if (v.horizontal) { gx = v.t * GRID_SIZE; gy = v.track + 0.5; }
  else { gx = v.track + 0.5; gy = v.t * GRID_SIZE; }
  if (gx < 0 || gx > GRID_SIZE || gy < 0 || gy > GRID_SIZE) return;
  const p = iso(rc, gx, gy, 0.8);
  drawVehicleBody(rc, p.x, p.y, v.w, v.l, v.color, v.dir, v.horizontal, day);
  rc.ctx.strokeStyle = rgba(v.color, 0.25);
  rc.ctx.lineWidth = 0.5;
  const tx = gx - (v.horizontal ? v.dir * 0.8 : 0);
  const ty = gy - (v.horizontal ? 0 : v.dir * 0.8);
  const tp = iso(rc, tx, ty, 0.8);
  rc.ctx.beginPath();
  rc.ctx.moveTo(tp.x, tp.y);
  rc.ctx.lineTo(p.x, p.y);
  rc.ctx.stroke();
}

function drawSkycars(rc, day) {
  const { ctx } = rc;
  for (const s of rc.state.skycars) {
    s.t += s.speed * s.dir;
    if (s.t > 1.1) s.t = -0.1;
    if (s.t < -0.1) s.t = 1.1;
    let gx, gy;
    if (s.horizontal) { gx = s.t * GRID_SIZE; gy = s.offset; }
    else { gx = s.offset; gy = s.t * GRID_SIZE; }
    const p = iso(rc, gx, gy, s.z);
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color; ctx.shadowBlur = 8;
    ctx.fillRect(p.x - 2, p.y - 0.5, 4, 1.2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(s.color, 0.25);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    const trailX = p.x - (s.horizontal ? s.dir * 12 : 0);
    ctx.moveTo(trailX, p.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
}

function drawAirplanes(rc, day) {
  const { ctx, time } = rc;
  for (const a of rc.state.airplanes) {
    a.t += a.speed * a.dir;
    let gx, gy;
    if (a.horizontal) { gx = a.t * GRID_SIZE; gy = a.offset; }
    else { gx = a.offset; gy = a.t * GRID_SIZE; }
    const p = iso(rc, gx, gy, a.z);
    ctx.fillStyle = day > 0.5 ? '#f0f0f0' : '#c0c0d0';
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 6;
    if (a.horizontal) {
      ctx.fillRect(p.x - a.size, p.y - 0.6, a.size * 2, 1.2);
      ctx.fillStyle = day > 0.5 ? '#d0d0d0' : '#9a9aaa';
      ctx.fillRect(p.x - a.size * 0.2, p.y - a.size * 0.5, a.size * 0.5, a.size);
      ctx.fillRect(p.x - a.dir * a.size * 0.9, p.y - a.size * 0.4, a.size * 0.15, a.size * 0.5);
    } else {
      ctx.fillRect(p.x - 0.6, p.y - a.size, 1.2, a.size * 2);
      ctx.fillStyle = day > 0.5 ? '#d0d0d0' : '#9a9aaa';
      ctx.fillRect(p.x - a.size * 0.5, p.y - a.size * 0.2, a.size, a.size * 0.5);
    }
    ctx.shadowBlur = 0;
    if (Math.sin(time * 0.01 + a.offset) > 0) {
      ctx.fillStyle = '#ff3333';
      ctx.shadowColor = '#ff3333'; ctx.shadowBlur = 6;
      const tipX = p.x + (a.horizontal ? a.dir * a.size : 0);
      const tipY = p.y + (!a.horizontal ? a.dir * a.size : 0);
      ctx.fillRect(tipX - 0.6, tipY - 0.6, 1.2, 1.2);
      ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = day > 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(200,200,255,.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (a.horizontal) {
      const endX = p.x - a.dir * a.size * 6;
      ctx.moveTo(endX, p.y); ctx.lineTo(p.x - a.dir * a.size, p.y);
    } else {
      const endY = p.y - a.dir * a.size * 6;
      ctx.moveTo(p.x, endY); ctx.lineTo(p.x, p.y - a.dir * a.size);
    }
    ctx.stroke();
  }
}

function drawDrones(rc, day) {
  const { ctx } = rc;
  for (const d of rc.state.drones) {
    d.gx += d.vx; d.gy += d.vy;
    if (d.gx < 5 || d.gx > GRID_SIZE - 5) d.vx *= -1;
    if (d.gy < 5 || d.gy > GRID_SIZE - 5) d.vy *= -1;
    d.blink += 0.02;
    const p = iso(rc, d.gx, d.gy, d.z);
    const blink = Math.sin(d.blink) > 0;
    ctx.fillStyle = blink ? '#FF3333' : '#00F0FF';
    if (day > 0.5) ctx.fillStyle = blink ? '#ff3333' : '#4488ff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = day > 0.5 ? 2 : 5;
    ctx.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6);
    ctx.shadowBlur = 0;
  }
}

/* ========================================================================
   DRAW: EFFECTS (transfer, hack, construction beams)
   ======================================================================== */

function drawEffects(rc, day) {
  const { ctx, state } = rc;
  for (let i = state.effects.length - 1; i >= 0; i--) {
    const e = state.effects[i];
    e.t += 1 / 60;
    if (e.t >= e.duration) { state.effects.splice(i, 1); continue; }
    const frac = e.t / e.duration;

    if (e.type === 'transfer' && e.from && e.to) {
      const a = iso(rc, e.from.gx + e.from.fw / 2, e.from.gy + e.from.fd / 2, e.from.height * 2);
      const bp = iso(rc, e.to.gx + e.to.fw / 2, e.to.gy + e.to.fd / 2, e.to.height * 2);
      const x = a.x + (bp.x - a.x) * frac;
      const y = a.y + (bp.y - a.y) * frac - Math.sin(frac * Math.PI) * 40;
      ctx.fillStyle = '#FFB000';
      ctx.shadowColor = '#FFB000'; ctx.shadowBlur = 10;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,176,0,.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x, y); ctx.stroke();
    } else if (e.type === 'hack' && e.from && e.to) {
      const a = iso(rc, e.from.gx + e.from.fw / 2, e.from.gy + e.from.fd / 2, e.from.height * 3);
      const bp = iso(rc, e.to.gx + e.to.fw / 2, e.to.gy + e.to.fd / 2, e.to.height * 3);
      ctx.strokeStyle = `rgba(255,51,85,${1 - frac})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#FF3355'; ctx.shadowBlur = 12;
      const segs = 8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      for (let s = 1; s < segs; s++) {
        const sf = s / segs;
        const sx = a.x + (bp.x - a.x) * sf + (Math.random() - 0.5) * 18;
        const sy = a.y + (bp.y - a.y) * sf + (Math.random() - 0.5) * 18;
        ctx.lineTo(sx, sy);
      }
      ctx.lineTo(bp.x, bp.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (e.type === 'construction' && e.target) {
      const p = iso(rc, e.target.gx + e.target.fw / 2, e.target.gy + e.target.fd / 2);
      ctx.strokeStyle = '#FFB000'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 8, p.y - 18);
      ctx.lineTo(p.x + 10, p.y - 18);
      ctx.stroke();
      for (let s = 0; s < 8; s++) {
        const sy = p.y - 6 + (Math.random() - 0.5) * 10;
        const sx = p.x + (Math.random() - 0.5) * 12;
        ctx.fillStyle = `rgba(255,${Math.floor(150 + Math.random() * 100)},0,${1 - frac})`;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
    }
  }
}

/* ========================================================================
   DRAW: HIGHLIGHTED BUILDINGS (top-holders click)
   ======================================================================== */

function drawHighlights(rc) {
  const { ctx, state, time } = rc;
  const now = Date.now();
  for (const [bid, expiresAt] of state.highlightedBuildings) {
    if (now > expiresAt) { state.highlightedBuildings.delete(bid); continue; }
    const b = state.buildingsByBuildingId.get(bid);
    if (!b) continue;
    const p = iso(rc, b.gx + b.fw / 2 - 0.5, b.gy + b.fd / 2 - 0.5);
    const z = rc.camera.zoom;
    const h = b.height * 4 * z;
    const remain = (expiresAt - now) / 3000;
    const pulse = 0.5 + Math.sin(time * 0.01) * 0.5;
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00F0FF';
    ctx.shadowBlur = 16 * (1 + pulse * 0.5);
    ctx.globalAlpha = remain * (0.5 + pulse * 0.4);
    ctx.beginPath();
    ctx.arc(p.x, p.y - h / 2, (b.height * 2.5 + 6) * z, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

/* ========================================================================
   DRAW: WEATHER
   ======================================================================== */

function tickWeather(rc) {
  if (!rc.settings.weather && rc.state.weather.current === 'CLEAR') return;
  const w = rc.state.weather;
  const now = Date.now();

  if (w.current === 'CLEAR') {
    if (rc.settings.weather && now >= w.nextCheckAt) {
      if (Math.random() < 0.25) startWeather(rc, pickWeatherType());
      else w.nextCheckAt = now + (60000 + Math.random() * 90000);
    }
  } else {
    if (now >= w.endsAt || !rc.settings.weather) endWeather(rc);
  }

  if (w.current === 'STORM' && !w.lightning.active && Math.random() < 0.008) {
    w.lightning.active = true;
    w.lightning.until = now + 120;
  }
  if (w.lightning.active && now > w.lightning.until) w.lightning.active = false;

  const fogTarget = w.current === 'FOG' ? 0.45 : 0;
  w.fogAlpha += (fogTarget - w.fogAlpha) * 0.03;
}

function pickWeatherType() {
  const phase = currentPhase();
  const candidates = Object.entries(WEATHERS).filter(([k, v]) => {
    if (v.weight <= 0) return false;
    if (v.phase && !v.phase.includes(phase)) return false;
    return true;
  });
  const total = candidates.reduce((s, [_, v]) => s + v.weight, 0);
  let r = Math.random() * total;
  for (const [k, v] of candidates) {
    r -= v.weight;
    if (r <= 0) return k;
  }
  return candidates[0]?.[0] || 'CLEAR';
}

function startWeather(rc, type) {
  const w = rc.state.weather;
  w.current = type;
  const cfg = WEATHERS[type];
  if (!cfg) { w.current = 'CLEAR'; return; }
  const dur = (cfg.dur[0] + Math.random() * (cfg.dur[1] - cfg.dur[0])) * 1000;
  w.endsAt = Date.now() + dur;
  w.particles = []; w.meteors = []; w.fireworks = []; w.ufo = null;

  if (type === 'RAIN_LIGHT' || type === 'STORM') {
    const count = type === 'STORM' ? 320 : 180;
    for (let i = 0; i < count; i++) {
      w.particles.push({
        x: Math.random() * rc.W, y: Math.random() * rc.H,
        vy: 6 + Math.random() * 4, vx: 1.5,
        len: 8 + Math.random() * 6
      });
    }
  } else if (type === 'WIND') {
    for (let i = 0; i < 40; i++) {
      w.particles.push({
        x: -10 - Math.random() * rc.W, y: Math.random() * rc.H,
        vx: 2 + Math.random() * 4, vy: (Math.random() - 0.5) * 0.8,
        kind: Math.random() > 0.6 ? 'leaf' : 'paper',
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.1,
        size: 3 + Math.random() * 3
      });
    }
  } else if (type === 'UFO') {
    w.ufo = {
      x: -80, y: rc.H * 0.2 + Math.random() * 80,
      vx: 1.2 + Math.random() * 0.6,
      vy: Math.random() * 0.4 - 0.2,
      rot: 0
    };
  } else if (type === 'METEOR') {
    for (let i = 0; i < 12; i++) {
      w.meteors.push({
        x: Math.random() * rc.W, y: -20 - Math.random() * 200,
        vx: 3 + Math.random() * 3, vy: 5 + Math.random() * 4,
        len: 40 + Math.random() * 40,
        delay: Math.random() * 1500
      });
    }
  } else if (type === 'AURORA') {
    w.auroraPhase = Math.random() * Math.PI * 2;
  }
}

function endWeather(rc) {
  const w = rc.state.weather;
  w.current = 'CLEAR';
  w.particles = []; w.meteors = []; w.fireworks = []; w.ufo = null;
  w.lightning.active = false;
  w.nextCheckAt = Date.now() + (60000 + Math.random() * 90000);
}

function drawWeather(rc, day) {
  if (!rc.settings.weather && rc.state.weather.current === 'CLEAR') return;
  const w = rc.state.weather;
  const { ctx, W, H, time } = rc;
  const now = Date.now();

  if (w.current === 'RAIN_LIGHT' || w.current === 'STORM') {
    ctx.strokeStyle = w.current === 'STORM' ? 'rgba(160,200,255,.7)' : 'rgba(160,200,255,.5)';
    ctx.lineWidth = 1;
    for (const p of w.particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.y > H) { p.y = -p.len; p.x = Math.random() * (W + 50); }
      if (p.x > W + 10) p.x = -10;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 2, p.y - p.len);
      ctx.stroke();
    }
    if (w.lightning.active) {
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 20;
      ctx.beginPath();
      let bx = Math.random() * W * 0.8 + W * 0.1;
      let by = 0;
      ctx.moveTo(bx, by);
      while (by < H * 0.7) {
        by += 20 + Math.random() * 30;
        bx += (Math.random() - 0.5) * 40;
        ctx.lineTo(bx, by);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  if (w.current === 'WIND') {
    for (const p of w.particles) {
      p.x += p.vx; p.y += p.vy;
      p.rot += p.rotV;
      if (p.x > W + 20) { p.x = -20; p.y = Math.random() * H; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === 'leaf') {
        ctx.fillStyle = day > 0.5 ? '#8a6a1a' : '#4a3a10';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = day > 0.5 ? '#e0d8b4' : '#887a50';
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
      }
      ctx.restore();
    }
  }

  if (w.fogAlpha > 0.01) {
    const fogColor = day > 0.5 ? '255,255,255' : '160,170,200';
    ctx.fillStyle = `rgba(${fogColor},${w.fogAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (w.current === 'UFO' && w.ufo) {
    const u = w.ufo;
    u.x += u.vx; u.y += u.vy; u.rot += 0.1;
    if (u.x > W + 100) { endWeather(rc); return; }
    ctx.fillStyle = 'rgba(0,255,153,.15)';
    ctx.beginPath();
    ctx.moveTo(u.x - 6, u.y + 4);
    ctx.lineTo(u.x + 6, u.y + 4);
    ctx.lineTo(u.x + 40, u.y + 160);
    ctx.lineTo(u.x - 40, u.y + 160);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a5560';
    ctx.beginPath(); ctx.ellipse(u.x, u.y + 6, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#707880';
    ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a94a4';
    ctx.beginPath(); ctx.arc(u.x, u.y, 10, Math.PI, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#00F0FF';
    ctx.globalAlpha = 0.6 + Math.sin(now * 0.008) * 0.4;
    ctx.beginPath(); ctx.arc(u.x - 3, u.y - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 5; i++) {
      const a = u.rot + (i / 5) * Math.PI * 2;
      const lx = u.x + Math.cos(a) * 18;
      const ly = u.y + 4 + Math.sin(a) * 3;
      const col = ['#FF00AA', '#00F0FF', '#FFB000', '#00FF99', '#B066FF'][i];
      ctx.fillStyle = col;
      ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.fillRect(lx - 1, ly - 1, 2, 2);
    }
    ctx.shadowBlur = 0;
  }

  if (w.current === 'METEOR') {
    for (const m of w.meteors) {
      if (m.delay > 0) { m.delay -= 16; continue; }
      m.x += m.vx; m.y += m.vy;
      if (m.y > H) { m.y = -20; m.x = Math.random() * W; m.delay = Math.random() * 1000; }
      const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 5, m.y - m.vy * 5);
      g.addColorStop(0, 'rgba(255,240,180,1)');
      g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#fff4c4'; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * m.len * 0.15, m.y - m.vy * m.len * 0.15);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  if (w.current === 'FIREWORKS') {
    if (now - (w._lastBurst || 0) > 800) {
      w._lastBurst = now;
      const bx = W * 0.25 + Math.random() * W * 0.5;
      const by = H * 0.15 + Math.random() * H * 0.25;
      const col = ['#FF00AA', '#00F0FF', '#FFB000', '#00FF99', '#B066FF', '#FFF066'][Math.floor(Math.random() * 6)];
      const particles = [];
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 2 + Math.random() * 3;
        particles.push({ x: bx, y: by, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col });
      }
      w.fireworks.push({ particles });
    }
    for (const burst of w.fireworks) {
      for (const p of burst.particles) {
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.06;
        p.life -= 0.02;
      }
      burst.particles = burst.particles.filter(p => p.life > 0);
      for (const p of burst.particles) {
        ctx.fillStyle = p.col;
        ctx.globalAlpha = p.life;
        ctx.shadowColor = p.col; ctx.shadowBlur = 8;
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    w.fireworks = w.fireworks.filter(b => b.particles.length > 0);
  }

  if (w.current === 'AURORA') {
    const bands = 4;
    w.auroraPhase = (w.auroraPhase || 0) + 0.01;
    for (let b = 0; b < bands; b++) {
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      const col = ['#00FF99', '#00F0FF', '#B066FF', '#FF00AA'][b];
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(0.5, rgba(col, 0.18));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= W; x += 20) {
        const y = 20 + b * 15 + Math.sin(x * 0.01 + w.auroraPhase + b) * 30;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, 0);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/* ========================================================================
   HIT TEST
   ======================================================================== */

export function hitTestBuilding(rc, sx, sy) {
  const state = rc.state;
  for (let i = state.buildings.length - 1; i >= 0; i--) {
    const b = state.buildings[i];
    const p = iso(rc, b.gx, b.gy);
    const z = rc.camera.zoom;
    const hwX = (b.fw * TW / 2) * z;
    const hwY = (b.fd * TW / 2) * z;
    const hhX = (b.fw * TH / 2) * z;
    const hhY = (b.fd * TH / 2) * z;
    const h = b.height * 4 * z;
    const minX = p.x - hwY;
    const maxX = p.x + hwX;
    const minY = p.y - h;
    const maxY = p.y + hhX + hhY + 4 * z;
    if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) return b;
  }
  return null;
}

/* ========================================================================
   MAIN FRAME LOOP
   ======================================================================== */

/**
 * Advance one frame. Called from a requestAnimationFrame loop owned by
 * the React component. Pass deltaMs (typically 16) for time advancement.
 */
export function advanceFrame(rc, deltaMs = 16, currentDevCount = 0) {
  rc.time += deltaMs;
  // smooth zoom
  rc.camera.zoom += (rc.camera.targetZoom - rc.camera.zoom) * 0.12;
  // dynamic min-zoom based on building count
  const minZoom = rc.state.buildings.length < 200 ? 0.7
                : rc.state.buildings.length < 1000 ? 0.5
                : 0.32;
  if (rc.camera.targetZoom < minZoom) rc.camera.targetZoom = minZoom;
  if (rc.camera.zoom < minZoom) rc.camera.zoom = minZoom;

  const day = daylightFactor();

  tickWeather(rc);

  const { ctx, W, H } = rc;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  drawSky(rc, day);
  drawGround(rc, day);

  // Painter's algorithm: combine buildings + ground vehicles
  const renderList = [];
  for (const b of rc.state.buildings) {
    const sortKey = (b.gx + b.fw - 1) + (b.gy + b.fd - 1);
    renderList.push({ k: sortKey, draw: () => drawBuilding(rc, b, day) });
  }
  if (rc.settings.vehicles) {
    updateVehicles(rc);
    for (const v of rc.state.vehicles) {
      const gx = v.horizontal ? v.t * GRID_SIZE : v.track + 0.5;
      const gy = v.horizontal ? v.track + 0.5 : v.t * GRID_SIZE;
      if (gx < 0 || gx > GRID_SIZE || gy < 0 || gy > GRID_SIZE) continue;
      const sortKey = gx + gy;
      renderList.push({ k: sortKey, draw: () => drawOneVehicle(rc, v, day) });
    }
  }
  renderList.sort((a, b) => a.k - b.k);
  for (const r of renderList) r.draw();

  // Sky layer: always on top
  if (rc.settings.aircraft) {
    drawDrones(rc, day);
    drawSkycars(rc, day);
    drawAirplanes(rc, day);
  }
  if (rc.settings.eventAnims) drawEffects(rc, day);
  drawHighlights(rc);
  drawWeather(rc, day);
}

/* ========================================================================
   CAMERA HELPERS (called by component event handlers)
   ======================================================================== */

export function panCamera(rc, dx, dy) {
  rc.camera.x = dx;
  rc.camera.y = dy;
}

export function zoomCamera(rc, deltaY) {
  const factor = deltaY < 0 ? 1.1 : 0.9;
  rc.camera.targetZoom = Math.max(0.3, Math.min(2.5, rc.camera.targetZoom * factor));
}

export function recenterCamera(rc) {
  rc.camera.x = 0;
  rc.camera.y = rc.initialCameraY;
  rc.camera.targetZoom = 1;
}
