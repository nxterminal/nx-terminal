import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMonadCityData } from './hooks/useMonadCityData';
import {
  TW, TH, GR, G2, BUILDING_COLORS, SIGN_NAMES, CAR_COLORS,
  SKIN_COLORS, SHIRT_COLORS, EVENT_TYPES, PROTOCOLS, DISTRICTS,
  FOOTER_BRANDS, generateLayout, pickWeather, getDistrictAt,
  DISTRICT_COLORS, DISTRICT_SIGNS, DISTRICT_BILLBOARDS, DISTRICT_BUILDING_TYPES,
} from './constants';
import './MonadCity.css';

/* ── helpers ── */
function sc(co, pct) {
  try {
    let r = parseInt(co.slice(1, 3), 16);
    let g = parseInt(co.slice(3, 5), 16);
    let b = parseInt(co.slice(5, 7), 16);
    r = Math.max(0, Math.min(255, ~~(r * (1 + pct))));
    g = Math.max(0, Math.min(255, ~~(g * (1 + pct))));
    b = Math.max(0, Math.min(255, ~~(b * (1 + pct))));
    return `rgb(${r},${g},${b})`;
  } catch { return co; }
}

/* height lookup by building type */
const TYPE_HEIGHTS = {
  mega: [75, 40], sky: [52, 28], corp: [40, 20], tower: [48, 22], off: [26, 14],
  dome: [16, 12], glass: [35, 25], cyber: [32, 25], neon: [40, 22], ant: [25, 32],
  data: [18, 10], wh: [10, 7], shop: [7, 5], church: [22, 14], fac: [14, 10],
  heli: [28, 14], pyr: [20, 16], stad: [12, 8], apt: [18, 12], hotel: [42, 22],
  mall: [14, 9], garage: [10, 7], theater: [18, 10], hospital: [30, 18],
  school: [16, 10], bank: [35, 20], museum: [20, 15], station: [12, 8],
  bar: [8, 5], telecom: [35, 30], res: [11, 8],
};
const ALL_TYPES = Object.keys(TYPE_HEIGHTS);

/* ── entity generators (called once) ── */
function generateBuildings(layout) {
  const bldgs = [];
  for (let gy = 0; gy < GR; gy++) for (let gx = 0; gx < GR; gx++) {
    if (layout[gy]?.[gx] !== 0 || Math.random() < .03) continue;
    // Determine district and pick colors/types accordingly
    const dist = getDistrictAt(gx, gy);
    const distCols = dist && DISTRICT_COLORS[dist];
    const distTypes = dist && DISTRICT_BUILDING_TYPES[dist];
    const distSigns = dist && DISTRICT_SIGNS[dist];
    const distBBs = dist && DISTRICT_BILLBOARDS[dist];
    // Pick color from district palette (70%) or global (30%)
    let col;
    if (distCols && Math.random() < .7) col = distCols[Math.floor(Math.random() * distCols.length)];
    else col = BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)];
    // Pick building type: district preferred (60%) or random
    let tp;
    if (distTypes && Math.random() < .6) tp = distTypes[Math.floor(Math.random() * distTypes.length)];
    else tp = ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)];
    const [hBase, hRng] = TYPE_HEIGHTS[tp] || [15, 10];
    const h = hBase + Math.random() * hRng;
    // Pick sign from district signs or global
    const signPool = distSigns || SIGN_NAMES;
    const sn = signPool[Math.floor(Math.random() * signPool.length)];
    // Billboard text from district or generic
    const bbPool = distBBs || ['MEGAETH', 'DeFi', 'NFT', 'BRIDGE', 'YIELD'];
    const bbText = bbPool[Math.floor(Math.random() * bbPool.length)];
    bldgs.push({
      gx, gy, col, tp, h, dist,
      wR: Math.max(1, Math.floor(h / 7)),
      wC: tp === 'wh' ? 5 : tp === 'shop' ? 2 : 2 + Math.floor(Math.random() * 3),
      sign: Math.random() < .25, roofL: Math.random() < .28,
      po: Math.random() * 6.28, ps: .3 + Math.random() * 2,
      sn,
      ledge: Math.random() < .2 ? Math.floor(1 + Math.random() * 3) : 0,
      bb: Math.random() < .14, bbText, roofG: Math.random() < .06,
      stripes: Math.random() < .15 ? Math.floor(2 + Math.random() * 4) : 0,
      aw: tp === 'shop' ? ['#FF3366','#00F0FF','#FFE066','#00FF88','#836EF9','#FF9F1C'][Math.floor(Math.random() * 6)] : null,
      proto: PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)],
      // District visual extras (pre-computed for perf)
      dxSlot: Math.floor(Math.random() * 5),  // which decoration variant
      dxOff: Math.random() * 6.28,            // animation offset
      dxH: .2 + Math.random() * .6,           // how high the decoration sits
    });
  }
  bldgs.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
  return bldgs;
}

function generateTrees(layout) {
  const trees = [];
  for (let gy = 0; gy < GR; gy++) for (let gx = 0; gx < GR; gx++) {
    if (layout[gy]?.[gx] === 2) for (let t = 0; t < 5; t++)
      trees.push({ gx: gx - .3 + Math.random() * .6, gy: gy - .3 + Math.random() * .6, sz: 2 + Math.random() * 4, tp: ['r','p','pa','b','cy'][Math.floor(Math.random() * 5)], sw: Math.random() * 6.28 });
    if (layout[gy]?.[gx] === 1 && Math.random() < .07)
      trees.push({ gx: gx + (Math.random() - .5) * .35, gy: gy + (Math.random() - .5) * .35, sz: 1.8 + Math.random() * 2, tp: Math.random() < .5 ? 'r' : 'cy', sw: Math.random() * 6.28 });
  }
  return trees;
}

function generateCars(count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const hz = Math.random() < .5;
    const ri = Math.floor(Math.random() * 9) * 3;
    if (ri >= GR) continue;
    let gx, gy, dx, dy;
    if (hz) { gy = ri + .15 * (Math.random() - .5); gx = 1 + Math.random() * (GR - 2); dx = .012 + Math.random() * .028; dy = 0; }
    else { gx = ri + .15 * (Math.random() - .5); gy = 1 + Math.random() * (GR - 2); dx = 0; dy = .012 + Math.random() * .028; }
    if (Math.random() < .5) { dx = -dx; dy = -dy; }
    const r = Math.random(); let vtp = 'car';
    if (r < .05) vtp = 'bus'; else if (r < .09) vtp = 'truck'; else if (r < .14) vtp = 'taxi';
    else if (r < .17) vtp = 'ambulance'; else if (r < .20) vtp = 'police'; else if (r < .24) vtp = 'van';
    else if (r < .28) vtp = 'sports'; else if (r < .31) vtp = 'motorcycle'; else if (r < .33) vtp = 'firetruck';
    else if (r < .38) vtp = 'cybertruck';
    const vc = vtp === 'taxi' ? '#FFE066' : vtp === 'ambulance' ? '#FFFFFF' : vtp === 'police' ? '#3366FF'
      : vtp === 'bus' ? '#FF9F1C' : vtp === 'firetruck' ? '#FF2200'
      : vtp === 'sports' ? ['#FF0044','#00CCFF','#FFAA00','#00FF66'][Math.floor(Math.random() * 4)]
      : vtp === 'van' ? '#888899' : vtp === 'cybertruck' ? '#B0B8C0'
      : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    cars.push({ gx, gy, dx, dy, col: vc, vtp });
  }
  return cars;
}

function generatePeds(count, layout) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const ri = Math.floor(Math.random() * 9) * 3;
    if (ri >= GR) continue;
    let gx, gy;
    if (Math.random() < .5) { gy = ri + .4 * (Math.random() < .5 ? 1 : -1); gx = 1 + Math.random() * (GR - 2); }
    else { gx = ri + .4 * (Math.random() < .5 ? 1 : -1); gy = 1 + Math.random() * (GR - 2); }
    const spd = .004 + Math.random() * .008; const ang = Math.random() * 6.28;
    peds.push({ gx, gy, dx: Math.cos(ang) * spd, dy: Math.sin(ang) * spd,
      skin: SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)],
      shirt: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
      step: Math.random() * 6.28, tt: 60 + Math.random() * 200 });
  }
  // Park/plaza loiterers
  for (let gy = 0; gy < GR; gy++) for (let gx = 0; gx < GR; gx++) {
    const t2 = layout[gy]?.[gx];
    if (t2 === 2 || t2 === 3) {
      const cnt = t2 === 3 ? 4 : 3;
      for (let i = 0; i < cnt; i++) {
        const spd2 = .002 + Math.random() * .004; const ang2 = Math.random() * 6.28;
        peds.push({ gx: gx + Math.random() * .6 - .3, gy: gy + Math.random() * .6 - .3,
          dx: Math.cos(ang2) * spd2, dy: Math.sin(ang2) * spd2,
          skin: SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)],
          shirt: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
          step: Math.random() * 6.28, tt: 30 + Math.random() * 120 });
      }
    }
  }
  return peds;
}

function generateLamps(layout) {
  const lamps = [];
  for (let gy = 0; gy < GR; gy++) for (let gx = 0; gx < GR; gx++)
    if (layout[gy]?.[gx] === 1 && Math.random() < .09) lamps.push({ gx: gx + .28, gy: gy + .28 });
  return lamps;
}

function generateAircraft() {
  const air = [];
  for (let i = 0; i < 7; i++) { const hz = Math.random() < .5; air.push({ tp: 'plane', gx: Math.random() * GR, gy: Math.random() * GR, dx: hz ? (.012 + Math.random() * .02) * (Math.random() < .5 ? 1 : -1) : 0, dy: hz ? 0 : (.012 + Math.random() * .02) * (Math.random() < .5 ? 1 : -1), alt: 45 + Math.random() * 35, bk: Math.random() * 6.28 }); }
  for (let i = 0; i < 3; i++) air.push({ tp: 'ufo', gx: 5 + Math.random() * (GR - 10), gy: 5 + Math.random() * (GR - 10), ogx: 5 + Math.random() * (GR - 10), ogy: 5 + Math.random() * (GR - 10), alt: 55 + Math.random() * 25, bk: Math.random() * 6.28, col: ['#836EF9','#00F0FF','#FF3366'][i] });
  for (let i = 0; i < 2; i++) air.push({ tp: 'heli', gx: GR / 2, gy: GR / 2, orA: i * 3.14, orR: 4 + i * 3, alt: 40 + i * 10, bk: i });
  air.push({ tp: 'blimp', gx: -10, gy: GR / 2, dx: .003, dy: 0, alt: 130, bk: Math.random() * 6.28 });
  // 4 drones
  for (let i = 0; i < 4; i++) { air.push({ tp: 'drone', gx: 3 + Math.random() * (GR - 6), gy: 3 + Math.random() * (GR - 6), ogx: 3 + Math.random() * (GR - 6), ogy: 3 + Math.random() * (GR - 6), alt: 25 + Math.random() * 20, bk: Math.random() * 6.28, col: ['#00F0FF','#FF3366','#00FF88','#836EF9'][i] }); }
  for (let i = 0; i < 4; i++) { const ang = Math.random() * 6.28; const spd = .02 + Math.random() * .015; air.push({ tp: 'sat', gx: Math.random() * GR, gy: Math.random() * GR, dx: Math.cos(ang) * spd, dy: Math.sin(ang) * spd, alt: 90 + Math.random() * 30, bk: Math.random() * 6.28 }); }
  return air;
}

// Weather particles (pre-allocated)
function generateWeatherParticles() {
  const drops = []; for (let i = 0; i < 250; i++) drops.push({ x: Math.random() * 2400, y: Math.random() * 1600, spd: 5 + Math.random() * 12, len: 3 + Math.random() * 14, a: .04 + Math.random() * .12 });
  const sfl = []; for (let i = 0; i < 100; i++) sfl.push({ x: Math.random() * 2400, y: Math.random() * 1600, spd: .6 + Math.random() * 2, sz: .6 + Math.random() * 1.8, a: .06 + Math.random() * .2, dr: Math.random() * 6.28 });
  const pts = []; for (let i = 0; i < 20; i++) pts.push({ x: Math.random() * 2200 - 300, y: Math.random() * 1400, spd: .1 + Math.random() * .25, sz: .6 + Math.random() * 1, a: .04 + Math.random() * .12, co: Math.random() < .5 ? '#836EF9' : '#00F0FF' });
  return { drops, sfl, pts };
}


/* ══════════ DRAWING FUNCTIONS ══════════ */
function iso(gx, gy, W, H) {
  return { x: W / 2 + (gx - gy) * (TW / 2), y: H / 2 + 20 + (gx + gy) * (TH / 2) };
}

function edgeF(gx, gy) {
  const m = 1.2; let a = 1;
  if (gx < m) a *= gx / m; if (gy < m) a *= gy / m;
  if (gx > GR - m) a *= (GR - gx) / m; if (gy > GR - m) a *= (GR - gy) / m;
  return Math.max(0, Math.min(1, a));
}

function dTile(c, gx, gy, col, brd, W, H) {
  const p = iso(gx - G2, gy - G2, W, H), hw = TW / 2, hh = TH / 2;
  c.fillStyle = col; c.beginPath();
  c.moveTo(p.x, p.y - hh); c.lineTo(p.x + hw, p.y); c.lineTo(p.x, p.y + hh); c.lineTo(p.x - hw, p.y);
  c.closePath(); c.fill();
  if (brd) { c.strokeStyle = brd; c.lineWidth = .25; c.stroke(); }
}

/* ── District-specific decorations drawn on top of base building ── */
function dDistrictDecor(c, b, p, hw, hh, h, t) {
  const d = b.dist; if (!d) return;
  const s = b.dxSlot, off = b.dxOff;

  if (d === 'defi') {
    // Ticker tape bar
    if (h > 18) {
      const ty = p.y - h * .35;
      c.fillStyle = '#001828'; c.fillRect(p.x - hw, ty - 1, hw * 2, 3.5);
      c.fillStyle = '#00F0FF'; c.globalAlpha = .5; c.font = 'bold 2px monospace';
      c.fillText('ETH +2.4% BTC -0.8%', p.x - hw + 1, ty + 1.5);
      c.globalAlpha = 1;
    }
    // Cyan accent edges
    c.strokeStyle = '#00F0FF'; c.globalAlpha = .15; c.lineWidth = .5;
    c.beginPath(); c.moveTo(p.x - hw, p.y); c.lineTo(p.x - hw, p.y - h);
    c.moveTo(p.x + hw, p.y); c.lineTo(p.x + hw, p.y - h); c.stroke();
    c.globalAlpha = 1;
  }

  else if (d === 'nft') {
    // Art panels — one per face, simple colored blocks
    if (h > 14) {
      const nftC = ['#FF3366','#FF00FF','#AA44FF','#FFAA00','#00FFCC'][s];
      const fy = p.y - h * .4, fw = hw * .6, fh2 = Math.min(8, h * .18);
      // Left face panel
      c.strokeStyle = nftC; c.globalAlpha = .45; c.lineWidth = .5;
      c.strokeRect(p.x - hw + 1.5, fy, fw, fh2);
      c.fillStyle = nftC; c.globalAlpha = .18;
      c.fillRect(p.x - hw + 2, fy + .5, fw - 1, fh2 - 1);
      // Right face panel
      c.strokeStyle = nftC; c.globalAlpha = .35;
      c.strokeRect(p.x + 1, fy + 2, fw, fh2);
      c.fillStyle = nftC; c.globalAlpha = .14;
      c.fillRect(p.x + 1.5, fy + 2.5, fw - 1, fh2 - 1);
      c.globalAlpha = 1;
    }
    // Neon edge glow
    const pulse = .25 + Math.sin(t * 2.5 + off) * .12;
    c.strokeStyle = '#FF3366'; c.globalAlpha = pulse; c.lineWidth = 1;
    c.beginPath(); c.moveTo(p.x - hw + .3, p.y); c.lineTo(p.x - hw + .3, p.y - h);
    c.moveTo(p.x + hw - .3, p.y); c.lineTo(p.x + hw - .3, p.y - h); c.stroke();
    c.globalAlpha = 1;
    // Label
    if (h > 22 && s < 3) {
      c.fillStyle = '#FF3366'; c.globalAlpha = .4; c.font = 'bold 2.2px Orbitron,monospace';
      c.fillText(['GALLERY','MINT','ART'][s], p.x - hw + 2, p.y - h + 4);
      c.globalAlpha = 1;
    }
  }

  else if (d === 'yield') {
    // Rooftop garden bushes
    if (h > 10) {
      c.fillStyle = '#0E5824'; c.globalAlpha = .5;
      c.beginPath(); c.ellipse(p.x - hw * .3, p.y - h - hh + 1.5, 2.5, 1.3, 0, 0, 6.28); c.fill();
      c.fillStyle = '#0A4018';
      c.beginPath(); c.ellipse(p.x + hw * .2, p.y - h - hh + 1.2, 2, 1, 0, 0, 6.28); c.fill();
      c.globalAlpha = 1;
    }
    // Vine + leaves (single vine per wall)
    c.strokeStyle = '#0A6828'; c.globalAlpha = .3; c.lineWidth = .5;
    const vy = p.y - h * .5;
    c.beginPath(); c.moveTo(p.x - hw + 1, vy);
    c.quadraticCurveTo(p.x - hw + 3, vy + h * .15, p.x - hw + 1.5, vy + h * .35); c.stroke();
    c.fillStyle = '#00FF88'; c.globalAlpha = .12;
    c.fillRect(p.x - hw + 1.5, vy + h * .1, 2, 1);
    c.fillRect(p.x - hw + .5, vy + h * .2, 2, 1);
    c.globalAlpha = 1;
    // Green ledges
    if (h > 18) {
      c.fillStyle = '#0A5020'; c.globalAlpha = .2;
      c.fillRect(p.x - hw - .5, p.y - h * .4, hw * 2 + 1, 1.2);
      c.fillRect(p.x - hw - .5, p.y - h * .7, hw * 2 + 1, 1.2);
      c.globalAlpha = 1;
    }
  }

  else if (d === 'derivatives') {
    // Chevron marks
    if (h > 18) {
      c.strokeStyle = '#FF9F1C'; c.globalAlpha = .35; c.lineWidth = .8;
      const cy2 = p.y - h * .45;
      c.beginPath(); c.moveTo(p.x - hw + 1, cy2 - 3); c.lineTo(p.x, cy2); c.lineTo(p.x - hw + 1, cy2 + 3); c.stroke();
      c.globalAlpha = 1;
    }
    // Candle chart
    if (h > 22 && s < 3) {
      const cx2 = p.x - hw + 2, cy2 = p.y - h * .65;
      c.fillStyle = '#0A0600'; c.fillRect(cx2, cy2, hw - 1, 6);
      c.globalAlpha = .45;
      for (let cd = 0; cd < 4; cd++) {
        c.fillStyle = cd % 2 === 0 ? '#00FF88' : '#FF3366';
        c.fillRect(cx2 + 1 + cd * (hw - 3) / 4, cy2 + 1, 1, 4);
      }
      c.globalAlpha = 1;
    }
    // Orange roof accent
    c.strokeStyle = '#FF9F1C'; c.globalAlpha = .18; c.lineWidth = .5;
    c.beginPath(); c.moveTo(p.x - hw, p.y - h); c.lineTo(p.x, p.y - h - hh); c.lineTo(p.x + hw, p.y - h); c.stroke();
    c.globalAlpha = 1;
  }

  else if (d === 'infra') {
    // Circuit traces (2 traces, combined path)
    c.strokeStyle = '#836EF9'; c.globalAlpha = .22; c.lineWidth = .4;
    c.beginPath();
    const by = p.y - h * .4;
    c.moveTo(p.x - hw + 2, by); c.lineTo(p.x - hw + 4, by); c.lineTo(p.x - hw + 4, by + 3); c.lineTo(p.x - hw + 6, by + 3);
    c.moveTo(p.x + 2, by + 1); c.lineTo(p.x + 4, by + 1); c.lineTo(p.x + 4, by - 2); c.lineTo(p.x + 6, by - 2);
    c.stroke(); c.globalAlpha = 1;
    // Server rack lights (fewer)
    if (h > 14) {
      for (let r = 0; r < 3; r++) {
        const lx = p.x - hw + 2.5 + r * 2.5, ly = p.y - h + 5 + s * 3;
        const on = Math.sin(t * 5 + r * 2.1 + off) > 0;
        c.fillStyle = on ? '#00FF88' : '#330808'; c.globalAlpha = on ? .4 : .1;
        c.fillRect(lx, ly, .7, .7);
      }
      c.globalAlpha = 1;
    }
    // Antenna
    if (h > 22) {
      c.strokeStyle = '#836EF9'; c.globalAlpha = .25; c.lineWidth = .4;
      c.beginPath(); c.moveTo(p.x + hw * .3, p.y - h - hh); c.lineTo(p.x + hw * .3, p.y - h - hh - 7); c.stroke();
      c.globalAlpha = 1;
    }
  }

  else if (d === 'perps') {
    // Warning stripes
    const flash = Math.sin(t * 4 + off) * .5 + .5;
    c.globalAlpha = .1 + flash * .06;
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i % 2 === 0 ? '#FF3366' : '#FFE066';
      c.fillRect(p.x - hw + .5, p.y - h + 4 + i * h * .25, hw * 2 - 1, 1);
    }
    // PnL display
    if (h > 20 && s < 2) {
      const profit = Math.sin(t * .3 + off) > 0;
      c.fillStyle = profit ? '#00FF88' : '#FF3366'; c.globalAlpha = .5;
      c.font = 'bold 2.2px Orbitron,monospace';
      c.fillText(profit ? '+$142K' : '-$87K', p.x - hw + 2, p.y - h * .5);
    }
    // Red edges
    c.strokeStyle = '#FF3366'; c.globalAlpha = .18; c.lineWidth = .7;
    c.beginPath(); c.moveTo(p.x - hw, p.y); c.lineTo(p.x - hw, p.y - h);
    c.moveTo(p.x + hw, p.y); c.lineTo(p.x + hw, p.y - h); c.stroke();
    c.globalAlpha = 1;
  }

  else if (d === 'bridge') {
    // Portal ring
    if (h > 16) {
      const cy2 = p.y - h * .5;
      const pulse = .25 + Math.sin(t * 1.5 + off) * .12;
      c.strokeStyle = '#00FFCC'; c.globalAlpha = pulse * .5; c.lineWidth = 1;
      c.beginPath(); c.ellipse(p.x, cy2, 4, 7, 0, 0, 6.28); c.stroke();
      c.fillStyle = '#00FFCC'; c.globalAlpha = pulse * .06;
      c.beginPath(); c.ellipse(p.x, cy2, 3, 5.5, 0, 0, 6.28); c.fill();
      c.globalAlpha = 1;
    }
    // Teal edges
    c.strokeStyle = '#00FFCC'; c.globalAlpha = .13; c.lineWidth = .5;
    c.beginPath(); c.moveTo(p.x - hw, p.y); c.lineTo(p.x - hw, p.y - h);
    c.moveTo(p.x + hw, p.y); c.lineTo(p.x + hw, p.y - h); c.stroke();
    c.globalAlpha = 1;
  }

  else if (d === 'lending') {
    // Columns (3 max, single alpha set)
    if (h > 16) {
      c.fillStyle = '#FFE066'; c.globalAlpha = .1;
      const cols = Math.min(3, Math.floor(hw / 3));
      for (let i = 0; i < cols; i++) {
        const cx2 = p.x - hw + 2 + i * (hw * 2 - 4) / Math.max(1, cols - 1);
        c.fillRect(cx2, p.y - h + 3, 1.2, h - 5);
      }
      c.globalAlpha = 1;
    }
    // Gold trim bands
    c.fillStyle = '#FFE066'; c.globalAlpha = .12;
    c.fillRect(p.x - hw + .5, p.y - h + 1.5, hw * 2 - 1, 1.5);
    c.fillRect(p.x - hw + .5, p.y + hh - 1, hw * 2 - 1, 1);
    c.globalAlpha = 1;
  }

  else if (d === 'parallel') {
    // Speed lines (4, combined path)
    c.strokeStyle = '#B8A9FF'; c.lineWidth = .4; c.globalAlpha = .15;
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const ly = p.y - h + 5 + i * h * .2;
      const lw = hw * (.5 + Math.sin(t * 3 + i * 1.3 + off) * .3);
      c.moveTo(p.x - hw + .5, ly); c.lineTo(p.x - hw + .5 + lw, ly);
    }
    c.stroke(); c.globalAlpha = 1;
    // Pipeline on roof
    if (h > 20) {
      c.fillStyle = '#836EF9'; c.globalAlpha = .18;
      c.fillRect(p.x - 1, p.y - h - hh - 4, 2, 5);
      c.globalAlpha = .3; c.beginPath(); c.arc(p.x, p.y - h - hh - 4, 2, 0, 6.28); c.fill();
      c.globalAlpha = 1;
    }
    // Purple edges
    c.strokeStyle = '#836EF9'; c.globalAlpha = .12; c.lineWidth = .5;
    c.beginPath(); c.moveTo(p.x - hw, p.y); c.lineTo(p.x - hw, p.y - h);
    c.moveTo(p.x + hw, p.y); c.lineTo(p.x + hw, p.y - h); c.stroke();
    c.globalAlpha = 1;
  }
}

function dBldg(c, b, t, W, H, highlight) {
  const p = iso(b.gx - G2, b.gy - G2, W, H), hw = TW / 2 - 2, hh = TH / 2 - 1, h = b.h, cl = b.col;
  const d = b.dist;
  // Shadow
  c.fillStyle = 'rgba(0,0,0,.05)'; c.beginPath();
  c.moveTo(p.x, p.y + hh); c.lineTo(p.x + hw + h * .08, p.y - h * .04);
  c.lineTo(p.x + hw + h * .08, p.y - h * .18); c.lineTo(p.x, p.y + hh - h * .1); c.closePath(); c.fill();

  // === DISTRICT-SPECIFIC SHAPE: setbacks/tiers drawn BEFORE main box ===
  if (d === 'defi' && h > 30) {
    // Setback tier — narrower upper section (glass tower look)
    const tierH = h * .35, tierW = hw * .65, tierHH = hh * .65;
    const tierBase = p.y - h;
    // Upper tier left
    c.fillStyle = sc(cl.l, .08); c.beginPath();
    c.moveTo(p.x - tierW, tierBase); c.lineTo(p.x, tierBase + tierHH);
    c.lineTo(p.x, tierBase + tierHH - tierH); c.lineTo(p.x - tierW, tierBase - tierH); c.closePath(); c.fill();
    // Upper tier right
    c.fillStyle = sc(cl.r, .08); c.beginPath();
    c.moveTo(p.x + tierW, tierBase); c.lineTo(p.x, tierBase + tierHH);
    c.lineTo(p.x, tierBase + tierHH - tierH); c.lineTo(p.x + tierW, tierBase - tierH); c.closePath(); c.fill();
    // Upper tier top
    c.fillStyle = cl.top; c.beginPath();
    c.moveTo(p.x, tierBase - tierH - tierHH); c.lineTo(p.x - tierW, tierBase - tierH);
    c.lineTo(p.x, tierBase - tierH + tierHH); c.lineTo(p.x + tierW, tierBase - tierH); c.closePath(); c.fill();
  }
  if (d === 'nft' && h > 20) {
    // Stepped facade — multiple setback levels (artistic zigzag)
    const steps = 2 + (b.dxSlot % 2);
    for (let st = 0; st < steps; st++) {
      const stepH = h * (.15 + st * .08);
      const stepW = hw * (1 - (st + 1) * .15);
      const stepHH = hh * (1 - (st + 1) * .15);
      const base = p.y - h + stepH * st * .3;
      const colors = ['#FF3366','#FF00FF','#AA44FF'];
      c.fillStyle = colors[st % 3]; c.globalAlpha = .06;
      c.beginPath(); c.moveTo(p.x - stepW, base - stepH);
      c.lineTo(p.x, base - stepH + stepHH); c.lineTo(p.x + stepW, base - stepH); c.closePath(); c.fill();
      c.globalAlpha = 1;
    }
  }
  if (d === 'yield' && h > 15) {
    // Terraced/pyramid shape — each level slightly smaller
    for (let terr = 1; terr <= 2; terr++) {
      const tw = hw * (1 - terr * .18), th2 = hh * (1 - terr * .18);
      const terrY = p.y - h * (.4 + terr * .25);
      c.fillStyle = `rgba(14,${80 + terr * 20},${36 + terr * 10},.12)`;
      c.beginPath();
      c.moveTo(p.x - tw - 1, terrY); c.lineTo(p.x, terrY + th2);
      c.lineTo(p.x + tw + 1, terrY); c.closePath(); c.fill();
    }
  }
  if (d === 'lending' && h > 22) {
    // Classical pediment — triangle above the roof line
    c.fillStyle = cl.top; c.beginPath();
    c.moveTo(p.x - hw + 1, p.y - h - hh + 1); c.lineTo(p.x, p.y - h - hh - 6);
    c.lineTo(p.x + hw - 1, p.y - h - hh + 1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,215,0,.12)'; c.lineWidth = .4;
    c.beginPath(); c.moveTo(p.x - hw + 1, p.y - h - hh + 1); c.lineTo(p.x, p.y - h - hh - 6);
    c.lineTo(p.x + hw - 1, p.y - h - hh + 1); c.stroke();
  }
  if (d === 'parallel' && h > 25) {
    // Spire/needle extending from roof
    c.fillStyle = '#836EF9'; c.globalAlpha = .15;
    c.beginPath(); c.moveTo(p.x - 1, p.y - h - hh); c.lineTo(p.x, p.y - h - hh - 14);
    c.lineTo(p.x + 1, p.y - h - hh); c.closePath(); c.fill();
    c.globalAlpha = 1;
  }
  if (d === 'derivatives' && h > 24) {
    // Angular crown — aggressive pointed top
    c.fillStyle = sc(cl.top, .15); c.beginPath();
    c.moveTo(p.x - hw * .5, p.y - h - hh); c.lineTo(p.x, p.y - h - hh - 8);
    c.lineTo(p.x + hw * .5, p.y - h - hh); c.closePath(); c.fill();
    c.fillStyle = '#FF9F1C'; c.globalAlpha = .08;
    c.beginPath(); c.moveTo(p.x - hw * .3, p.y - h - hh + 1);
    c.lineTo(p.x, p.y - h - hh - 6); c.lineTo(p.x + hw * .3, p.y - h - hh + 1); c.closePath(); c.fill();
    c.globalAlpha = 1;
  }
  if (d === 'bridge' && h > 20) {
    // Arch gateway shape on front
    c.fillStyle = '#00FFCC'; c.globalAlpha = .05;
    c.beginPath(); c.arc(p.x, p.y + hh - 4, hw * .7, Math.PI, 0); c.fill();
    c.strokeStyle = '#00FFCC'; c.globalAlpha = .12; c.lineWidth = .5;
    c.beginPath(); c.arc(p.x, p.y + hh - 4, hw * .7, Math.PI, 0); c.stroke();
    c.globalAlpha = 1;
  }
  if (d === 'infra' && h > 18) {
    // Industrial blocky additions — AC units, pipes on side
    c.fillStyle = sc(cl.l, -.15);
    c.fillRect(p.x + hw - 1, p.y - h * .6, 2.5, 3);
    c.fillRect(p.x + hw - 1, p.y - h * .35, 2.5, 2.5);
    c.fillStyle = '#836EF9'; c.globalAlpha = .06;
    c.fillRect(p.x + hw - .5, p.y - h * .6 + .5, 1.5, 2);
    c.globalAlpha = 1;
  }

  // Left face
  c.fillStyle = cl.l; c.beginPath();
  c.moveTo(p.x - hw, p.y); c.lineTo(p.x, p.y + hh); c.lineTo(p.x, p.y + hh - h); c.lineTo(p.x - hw, p.y - h);
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(0,0,0,.04)'; c.beginPath();
  c.moveTo(p.x - hw, p.y); c.lineTo(p.x - hw + 2, p.y - 1); c.lineTo(p.x - hw + 2, p.y - h - 1); c.lineTo(p.x - hw, p.y - h);
  c.closePath(); c.fill();
  // Right face
  c.fillStyle = cl.r; c.beginPath();
  c.moveTo(p.x + hw, p.y); c.lineTo(p.x, p.y + hh); c.lineTo(p.x, p.y + hh - h); c.lineTo(p.x + hw, p.y - h);
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.018)'; c.beginPath();
  c.moveTo(p.x + hw, p.y); c.lineTo(p.x + hw - 1.5, p.y - .6); c.lineTo(p.x + hw - 1.5, p.y - h - .6); c.lineTo(p.x + hw, p.y - h);
  c.closePath(); c.fill();
  // Top
  c.fillStyle = cl.top; c.beginPath();
  c.moveTo(p.x, p.y - h - hh); c.lineTo(p.x - hw, p.y - h); c.lineTo(p.x, p.y - h + hh); c.lineTo(p.x + hw, p.y - h);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = .4; c.beginPath();
  c.moveTo(p.x - hw, p.y - h); c.lineTo(p.x, p.y - h - hh); c.lineTo(p.x + hw, p.y - h); c.stroke();
  // Stripes
  if (b.stripes) for (let s = 1; s <= b.stripes; s++) {
    const sy = p.y + hh - h + s * (h / (b.stripes + 1));
    c.strokeStyle = 'rgba(255,255,255,.014)'; c.lineWidth = .25; c.beginPath();
    c.moveTo(p.x - hw, sy - hh * (sy - (p.y - h)) / h); c.lineTo(p.x, sy);
    c.lineTo(p.x + hw, sy - hh * (sy - (p.y - h)) / h); c.stroke();
  }
  if (b.ledge) for (let l = 1; l <= b.ledge; l++) {
    const ly = p.y - h + l * (h / (b.ledge + 1));
    c.fillStyle = 'rgba(255,255,255,.015)'; c.fillRect(p.x - hw - .8, ly, hw * 2 + 1.6, 1);
  }
  // Windows
  const wP = Math.sin(t * b.ps + b.po);
  for (let face = 0; face < 2; face++) {
    for (let row = 0; row < b.wR; row++) {
      const ry = p.y - h + 4 + row * 7; if (ry > p.y + hh - 2) break;
      const rf = (ry - (p.y - h)) / h;
      for (let col2 = 0; col2 < b.wC; col2++) {
        if (Math.sin(t * (.2 + face * .1) + row * 1.5 + col2 * 2.1 + b.po + face * 1.4) <= -.4) continue;
        let wx;
        if (face === 0) { const le = p.x - hw + rf * hw; const ww = hw * (1 - rf); wx = le + 2 + (col2 / b.wC) * (ww - 3); }
        else { const ww = hw * (1 - rf); wx = p.x + 1.2 + (col2 / b.wC) * (ww - 2.5); }
        const a = .12 + wP * .08;
        c.fillStyle = cl.w; c.globalAlpha = a; c.fillRect(wx, ry, 1.5, 2.5);
        c.globalAlpha = a * .2; c.fillRect(wx - .2, ry - .2, 1.9, 2.9); c.globalAlpha = 1;
      }
    }
  }
  // Type specials
  if (b.tp === 'mega' || b.tp === 'sky' || b.tp === 'ant' || b.tp === 'tower') {
    c.strokeStyle = cl.w; c.lineWidth = .4; c.beginPath(); c.moveTo(p.x, p.y - h - hh); c.lineTo(p.x, p.y - h - hh - 18); c.stroke();
    if (Math.sin(t * 3 + b.po) > .2) { c.fillStyle = '#FF3366'; c.beginPath(); c.arc(p.x, p.y - h - hh - 18, 1, 0, 6.28); c.fill(); }
  }
  if (b.tp === 'mega') for (let l = 0; l < 4; l++) { const la = t * 1.1 + l * 1.57; c.fillStyle = cl.w; c.globalAlpha = .2 + Math.sin(la) * .12; c.beginPath(); c.arc(p.x + Math.cos(la) * 3, p.y - h - hh - 1 + Math.sin(la) * 1.5, .8, 0, 6.28); c.fill(); c.globalAlpha = 1; }
  if (b.tp === 'dome') { c.fillStyle = cl.top; c.beginPath(); c.ellipse(p.x, p.y - h - hh + 1.5, hw * .38, 7, 0, Math.PI, 0); c.fill(); }
  if (b.tp === 'pyr') { c.fillStyle = cl.top; c.beginPath(); c.moveTo(p.x, p.y - h - hh - 10); c.lineTo(p.x - hw * .55, p.y - h); c.lineTo(p.x, p.y - h + hh * .55); c.lineTo(p.x + hw * .55, p.y - h); c.closePath(); c.fill(); }
  if (b.tp === 'glass') for (let s = 0; s < 3; s++) { const sy = p.y - h + 6 + s * h * .22; c.fillStyle = 'rgba(160,190,255,.02)'; c.fillRect(p.x - hw + 2, sy, hw - 3, .4); c.fillRect(p.x + 1, sy + 1, hw - 3, .4); }
  if (b.tp === 'wh') { c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(p.x + 1.5, p.y + hh - 8, hw - 2.5, 6); c.fillStyle = cl.w; c.globalAlpha = .05; c.fillRect(p.x + 2, p.y + hh - 7, hw - 4, 4); c.globalAlpha = 1; }
  if (b.tp === 'shop' && b.aw) { c.fillStyle = b.aw; c.globalAlpha = .22; c.beginPath(); c.moveTo(p.x - hw, p.y - 2); c.lineTo(p.x, p.y + hh); c.lineTo(p.x, p.y + hh + 1.5); c.lineTo(p.x - hw, p.y - .5); c.closePath(); c.fill(); c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.03)'; c.fillRect(p.x - hw / 2 - .5, p.y + hh - 3, 2, 3); }
  if (b.tp === 'fac') for (let ch = 0; ch < 2; ch++) { const cx2 = p.x - hw * .35 + ch * hw * .7; c.fillStyle = '#161628'; c.fillRect(cx2 - 1, p.y - h - hh - 6, 2, 7); for (let sm = 0; sm < 2; sm++) { const sa = Math.sin(t * .8 + sm + ch) * 2; c.fillStyle = `rgba(80,80,100,${.03 - sm * .01})`; c.beginPath(); c.ellipse(cx2 + sa, p.y - h - hh - 7 - sm * 3.5, 2 + sm * 1.2, 1.2 + sm * .6, 0, 0, 6.28); c.fill(); } }
  if (b.tp === 'cyber') { c.strokeStyle = cl.w; c.globalAlpha = .12 + Math.sin(t * 1.6 + b.po) * .08; c.lineWidth = .5; c.beginPath(); c.moveTo(p.x - hw, p.y); c.lineTo(p.x - hw, p.y - h); c.stroke(); c.beginPath(); c.moveTo(p.x + hw, p.y); c.lineTo(p.x + hw, p.y - h); c.stroke(); c.globalAlpha = 1; }
  if (b.tp === 'neon') for (let nb = 0; nb < 2; nb++) { const ny = p.y - h + 7 + nb * h * .35; c.fillStyle = cl.s; c.globalAlpha = .18 + Math.sin(t * 2 + nb + b.po) * .1; c.fillRect(p.x - hw + 1, ny, hw * 2 - 2, 1.2); c.globalAlpha = 1; }
  if (b.tp === 'data') for (let row = 0; row < Math.min(b.wR, 3); row++) for (let col2 = 0; col2 < 5; col2++) { const ly = p.y - h + 3 + row * 6, lx = p.x - hw + 3 + col2 * 2.2; if (Math.sin(t * 4 + row + col2 * 3 + b.po) > .0) { c.fillStyle = col2 % 3 === 0 ? '#00FF88' : '#FF3366'; c.globalAlpha = .2; c.fillRect(lx, ly, .6, .6); c.globalAlpha = 1; } }
  if (b.tp === 'heli') { c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(p.x - 3, p.y - h - hh + 1.5, 6, .7); c.fillRect(p.x - 3, p.y - h - hh + 1.5, .7, 3); c.fillRect(p.x + 2.3, p.y - h - hh + 1.5, .7, 3); c.strokeStyle = 'rgba(255,255,255,.03)'; c.lineWidth = .3; c.beginPath(); c.ellipse(p.x, p.y - h - hh + 3.5, 4.5, 2.2, 0, 0, 6.28); c.stroke(); }
  if (b.tp === 'church') { c.strokeStyle = cl.w; c.lineWidth = .4; c.beginPath(); c.moveTo(p.x, p.y - h - hh); c.lineTo(p.x, p.y - h - hh - 12); c.stroke(); c.beginPath(); c.moveTo(p.x - 2.5, p.y - h - hh - 8); c.lineTo(p.x + 2.5, p.y - h - hh - 8); c.stroke(); }
  if (b.tp === 'stad') { c.fillStyle = 'rgba(131,110,249,.03)'; c.beginPath(); c.moveTo(p.x, p.y - h - hh + 2); c.lineTo(p.x - hw + 2, p.y - h + 1.5); c.lineTo(p.x, p.y - h + hh - 1); c.lineTo(p.x + hw - 2, p.y - h + 1.5); c.closePath(); c.fill(); for (let fl = 0; fl < 4; fl++) { const fx = [p.x - hw, p.x - hw * .3, p.x + hw * .3, p.x + hw][fl]; c.fillStyle = 'rgba(255,255,200,.2)'; c.beginPath(); c.arc(fx, p.y - h - 2, .8, 0, 6.28); c.fill(); } }
  if (b.tp === 'hotel') { c.fillStyle = '#FFD700'; c.globalAlpha = .06; c.fillRect(p.x - hw + 1, p.y - h + 2, hw * 2 - 2, 1.5); c.globalAlpha = 1; }
  if (b.tp === 'apt') for (let bal = 0; bal < Math.min(2, Math.floor(h / 11)); bal++) { const by2 = p.y - h + 8 + bal * 12; c.fillStyle = 'rgba(255,255,255,.02)'; c.fillRect(p.x - hw - .8, by2, 2, .6); c.fillRect(p.x + hw - 1.2, by2, 2, .6); }
  if (b.tp === 'mall') { c.fillStyle = cl.s; c.globalAlpha = .2 + Math.sin(t * 1.5 + b.po) * .1; c.fillRect(p.x - hw + 1, p.y - h + 3, hw * 2 - 2, 2); c.globalAlpha = 1; c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(p.x - hw / 3, p.y + hh - 5, hw * .5, 5); }
  if (b.tp === 'garage') { c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(p.x + 1, p.y + hh - 6, hw - 2, 5); c.fillRect(p.x - hw + 1, p.y + hh - 6, hw * .4, 5); }
  if (b.tp === 'theater') { c.fillStyle = cl.s; c.globalAlpha = .35 + Math.sin(t * 2 + b.po) * .15; const tw2 = hw - 2; c.beginPath(); c.moveTo(p.x - tw2, p.y - h + 2); c.lineTo(p.x, p.y - h + 2 - 3); c.lineTo(p.x + tw2, p.y - h + 2); c.closePath(); c.fill(); c.globalAlpha = 1; }
  if (b.tp === 'hospital') { c.fillStyle = '#FF3366'; c.globalAlpha = .2; c.fillRect(p.x - 2, p.y - h + 3, 4, 1); c.fillRect(p.x - .5, p.y - h + 1.5, 1, 4); c.globalAlpha = 1; if (Math.sin(t * 4 + b.po) > .0) { c.fillStyle = '#FF3366'; c.beginPath(); c.arc(p.x, p.y - h - hh - 2, 1, 0, 6.28); c.fill(); } }
  if (b.tp === 'school') { c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(p.x - hw * .6, p.y - h + 2, hw * 1.2, 1.5); c.strokeStyle = cl.w; c.lineWidth = .3; c.beginPath(); c.moveTo(p.x, p.y - h - hh); c.lineTo(p.x, p.y - h - hh - 6); c.stroke(); c.fillStyle = 'rgba(255,200,50,.15)'; c.fillRect(p.x - 1.5, p.y - h - hh - 6, 3, 2); }
  if (b.tp === 'bank') { c.fillStyle = 'rgba(255,215,0,.06)'; c.fillRect(p.x - hw + 1, p.y - h + 2, hw * 2 - 2, 2); c.fillRect(p.x - hw + 1, p.y + hh - 2, hw * 2 - 2, 1); for (let col2 = 0; col2 < 3; col2++) { const cx2 = p.x - hw + 3 + col2 * hw * .6; c.fillStyle = 'rgba(255,215,0,.03)'; c.fillRect(cx2, p.y - h + 4, 1.5, h - 6); } }
  if (b.tp === 'museum') { c.fillStyle = cl.top; c.beginPath(); c.moveTo(p.x - hw * .8, p.y - h); c.lineTo(p.x, p.y - h - 8); c.lineTo(p.x + hw * .8, p.y - h); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.04)'; c.beginPath(); c.moveTo(p.x, p.y - h - 8); c.lineTo(p.x + hw * .8, p.y - h); c.lineTo(p.x, p.y - h + hh * .6); c.closePath(); c.fill(); }
  if (b.tp === 'station') { c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(p.x - hw * .8, p.y + hh - 6, hw * 1.6, 5); c.fillStyle = cl.s; c.globalAlpha = .15; c.fillRect(p.x - hw + 1, p.y - h + 2, hw * 2 - 2, 1.5); c.globalAlpha = 1; }
  if (b.tp === 'bar') { c.fillStyle = cl.s; c.globalAlpha = .4 + Math.sin(t * 3 + b.po) * .2; c.fillRect(p.x - hw + 1, p.y - h + 2, hw - 2, 1.5); c.globalAlpha = 1; c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(p.x - hw / 2 - .8, p.y + hh - 3.5, 2, 3.5); }
  if (b.tp === 'telecom') { c.strokeStyle = cl.w; c.lineWidth = .4; c.beginPath(); c.moveTo(p.x, p.y - h - hh); c.lineTo(p.x, p.y - h - hh - 25); c.stroke(); for (let d = 0; d < 3; d++) { const dy2 = p.y - h - hh - 8 - d * 6; c.strokeStyle = cl.w; c.globalAlpha = .15; c.beginPath(); c.moveTo(p.x - 3 + d, dy2); c.lineTo(p.x + 3 - d, dy2); c.stroke(); } c.globalAlpha = 1; if (Math.sin(t * 2.5 + b.po) > .2) { c.fillStyle = '#FF3366'; c.beginPath(); c.arc(p.x, p.y - h - hh - 25, 1, 0, 6.28); c.fill(); } }
  // Sign
  if (b.sign) { const a = .3 + Math.sin(t * 1.5 + b.po) * .2; c.fillStyle = cl.s; c.globalAlpha = a; c.font = 'bold 2.2px Orbitron,monospace'; c.fillText(b.sn, p.x - hw + 2, p.y - h + 6); c.globalAlpha = 1; }
  if (b.bb) { const bbt = b.bbText || b.sn; const bbw = Math.max(12, bbt.length * 2.8 + 4); c.fillStyle = '#060614'; c.fillRect(p.x - bbw / 2, p.y - h - hh - 8, bbw, 6); c.strokeStyle = cl.s; c.globalAlpha = .3; c.lineWidth = .4; c.strokeRect(p.x - bbw / 2, p.y - h - hh - 8, bbw, 6); const bp = .4 + Math.sin(t * 1.2 + b.po) * .25; c.fillStyle = cl.w; c.globalAlpha = bp; c.shadowColor = cl.w; c.shadowBlur = 4; c.font = 'bold 3.5px Orbitron,monospace'; c.textAlign = 'center'; c.fillText(bbt, p.x, p.y - h - hh - 3.5); c.shadowBlur = 0; c.globalAlpha = 1; c.textAlign = 'start'; }
  if (b.roofG) for (let rg = 0; rg < 2; rg++) { c.fillStyle = '#083015'; c.beginPath(); c.ellipse(p.x - hw * .3 + rg * hw * .5, p.y - h - hh + 1.2, 1.8, 1, 0, 0, 6.28); c.fill(); }
  if (b.roofL && b.h > 18) { c.fillStyle = '#14142A'; c.fillRect(p.x - 1.8, p.y - h - hh + .8, 3.6, 1.8); c.fillRect(p.x + 3, p.y - h - hh + 1, 2.5, 1.3); }
  c.fillStyle = cl.s; c.globalAlpha = .02 + Math.sin(t + b.po) * .008; c.beginPath(); c.ellipse(p.x, p.y + hh + .5, hw * .45, hh * .25, 0, 0, 6.28); c.fill(); c.globalAlpha = 1;
  // District-specific decorations
  dDistrictDecor(c, b, p, hw, hh, h, t);
  // Highlight overlay for district selection
  if (highlight) {
    c.fillStyle = 'rgba(131,110,249,.15)'; c.beginPath();
    c.moveTo(p.x - hw, p.y); c.lineTo(p.x, p.y + hh); c.lineTo(p.x, p.y + hh - h); c.lineTo(p.x - hw, p.y - h);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(p.x + hw, p.y); c.lineTo(p.x, p.y + hh); c.lineTo(p.x, p.y + hh - h); c.lineTo(p.x + hw, p.y - h);
    c.closePath(); c.fill();
  }
}

function dTree(c, tr, t, W, H) {
  const p = iso(tr.gx - G2, tr.gy - G2, W, H), sw = Math.sin(t * .9 + tr.sw) * .8, sz = tr.sz;
  c.fillStyle = 'rgba(0,0,0,.06)'; c.beginPath(); c.ellipse(p.x, p.y + 1, sz * .5, sz * .18, 0, 0, 6.28); c.fill();
  c.fillStyle = '#201408'; c.fillRect(p.x - .5 + sw * .15, p.y - sz, 1, sz);
  const cx = p.x + sw, cy = p.y - sz * 1.4;
  if (tr.tp === 'r') { c.fillStyle = '#062810'; c.beginPath(); c.ellipse(cx, cy + .8, sz * .9, sz * .65, 0, 0, 6.28); c.fill(); c.fillStyle = '#0A3616'; c.beginPath(); c.ellipse(cx - .2, cy, sz * .65, sz * .48, 0, 0, 6.28); c.fill(); c.fillStyle = '#0E5020'; c.beginPath(); c.ellipse(cx + .2, cy - .6, sz * .42, sz * .32, 0, 0, 6.28); c.fill(); }
  else if (tr.tp === 'p') { for (let l = 0; l < 3; l++) { const ly = cy + sz * .2 - l * sz * .42, lw = sz * (.95 - l * .22); c.fillStyle = ['#062410','#083416','#0C7024'][l]; c.beginPath(); c.moveTo(cx, ly - sz * .42); c.lineTo(cx - lw, ly + sz * .18); c.lineTo(cx + lw, ly + sz * .18); c.closePath(); c.fill(); } }
  else if (tr.tp === 'pa') { c.fillStyle = '#281808'; c.fillRect(p.x - .4 + sw * .2, p.y - sz * 1.5, .8, sz * 1.5); for (let f = 0; f < 4; f++) { const fa = f * 1.57 + t * .1 + tr.sw, fx = cx + Math.cos(fa) * sz * .9, fy = cy - sz * .15 + Math.sin(fa) * sz * .3; c.strokeStyle = '#125018'; c.lineWidth = .8; c.beginPath(); c.moveTo(cx, cy - sz * .15); c.quadraticCurveTo(cx + Math.cos(fa) * sz * .5, cy - sz * .4, fx, fy); c.stroke(); c.fillStyle = '#125018'; c.beginPath(); c.ellipse(fx, fy, sz * .25, sz * .12, fa, 0, 6.28); c.fill(); } }
  else if (tr.tp === 'b') { c.fillStyle = '#082A14'; c.beginPath(); c.ellipse(p.x + sw * .3, p.y - sz * .35, sz * .7, sz * .42, 0, 0, 6.28); c.fill(); }
  else { c.fillStyle = '#072818'; c.beginPath(); c.ellipse(cx, cy, sz * .25, sz * .9, 0, 0, 6.28); c.fill(); }
}

function dCar(c, cr, t, W, H) {
  const p = iso(cr.gx - G2, cr.gy - G2, W, H), a = edgeF(cr.gx, cr.gy); if (a < .02) return;
  c.globalAlpha = a; const hz = cr.dx !== 0;
  c.fillStyle = 'rgba(0,0,0,.06)'; c.beginPath(); c.ellipse(p.x, p.y + 1.5, 4.5, 1.8, 0, 0, 6.28); c.fill();
  const isBig = cr.vtp === 'bus' || cr.vtp === 'truck' || cr.vtp === 'firetruck';
  const isSmall = cr.vtp === 'motorcycle'; const isCyber = cr.vtp === 'cybertruck';
  const bw = isBig ? 8 : isSmall ? 3.5 : isCyber ? 7 : cr.vtp === 'sports' ? 6.5 : 5.5;
  const bh = isBig ? 3.5 : isSmall ? 1.5 : isCyber ? 2.8 : cr.vtp === 'van' ? 3 : 2.5;
  c.fillStyle = cr.col;
  if (hz) {
    c.fillRect(p.x - bw / 2, p.y - 3 - bh / 2, bw, bh);
    if (!isSmall) { c.fillStyle = sc(cr.col, -.2); if (isCyber) { c.beginPath(); c.moveTo(p.x - bw * .2, p.y - 3 - bh / 2 - .8); c.lineTo(p.x + bw * .15, p.y - 3 - bh / 2 - 1.8); c.lineTo(p.x + bw * .35, p.y - 3 - bh / 2 - .8); c.closePath(); c.fill(); } else { c.fillRect(p.x - bw * .28, p.y - 3 - bh / 2 - .8, bw * .4, bh * .45); } }
  } else {
    c.fillRect(p.x - bh / 2, p.y - 3 - bw / 2, bh, bw);
    if (!isSmall) { c.fillStyle = sc(cr.col, -.2); c.fillRect(p.x - bh * .25, p.y - 3 - bw * .28, bh * .4, bw * .35); }
  }
  const dir = hz ? (cr.dx > 0 ? 1 : -1) : (cr.dy > 0 ? 1 : -1);
  c.fillStyle = 'rgba(255,255,190,.5)';
  if (hz) c.fillRect(p.x + dir * bw / 2 - .5, p.y - 3, .8, .8); else c.fillRect(p.x - .3, p.y - 3 + dir * bw / 2 - .5, .8, .8);
  c.fillStyle = 'rgba(255,25,25,.3)';
  if (hz) c.fillRect(p.x - dir * bw / 2, p.y - 3, .7, .7); else c.fillRect(p.x, p.y - 3 - dir * bw / 2, .7, .7);
  if (cr.vtp === 'ambulance' || cr.vtp === 'police' || cr.vtp === 'firetruck') {
    const blink = Math.sin(t * 12) > .3;
    c.fillStyle = cr.vtp === 'police' ? (blink ? '#FF3366' : '#3366FF') : (blink ? '#FF3366' : '#FFF');
    c.fillRect(p.x - .8, p.y - 3 - bh / 2 - 1.2, 1.6, .8);
  }
  if (cr.vtp === 'sports') { c.fillStyle = cr.col; c.fillRect(p.x - .5, p.y - 3 - bh / 2 - .3, 1, .3); }
  c.globalAlpha = 1;
}

function dPed(c, pd, t, W, H) {
  const p = iso(pd.gx - G2, pd.gy - G2, W, H), a = edgeF(pd.gx, pd.gy); if (a < .02) return;
  c.globalAlpha = a; const bob = Math.sin(t * 6 + pd.step) * .6;
  c.fillStyle = 'rgba(0,0,0,.04)'; c.beginPath(); c.ellipse(p.x, p.y + .8, 1.8, .7, 0, 0, 6.28); c.fill();
  c.fillStyle = pd.shirt; c.fillRect(p.x - .8, p.y - 3.8 + bob, 1.6, 2);
  c.fillStyle = pd.skin; c.beginPath(); c.arc(p.x, p.y - 4.8 + bob, 1, 0, 6.28); c.fill();
  const la = Math.sin(t * 6 + pd.step) * .5;
  c.fillStyle = '#141828'; c.fillRect(p.x - .5 + la, p.y - 1.8 + bob, .6, 1.6); c.fillRect(p.x + .05 - la, p.y - 1.8 + bob, .6, 1.6);
  c.globalAlpha = 1;
}

function dLamp(c, lm, t, W, H) {
  const p = iso(lm.gx - G2, lm.gy - G2, W, H);
  c.fillStyle = '#242838'; c.fillRect(p.x - .25, p.y - 8.5, .5, 8.5);
  c.fillStyle = '#343848'; c.fillRect(p.x - 1, p.y - 9.5, 2.2, 1.5);
  const fl = .45 + Math.sin(t * 3 + lm.gx * 4) * .08;
  c.fillStyle = `rgba(255,200,120,${.04 * fl})`; c.beginPath(); c.ellipse(p.x, p.y, 5.5, 2.5, 0, 0, 6.28); c.fill();
  c.fillStyle = `rgba(255,180,80,${.35 * fl})`; c.beginPath(); c.arc(p.x, p.y - 8.8, 1, 0, 6.28); c.fill();
}

function dAir(c, a, t, W, H) {
  const fade = edgeF(a.gx || GR / 2, a.gy || GR / 2);
  if (a.tp === 'plane') {
    a.gx += a.dx; a.gy += a.dy;
    if (a.gx > GR + 1) a.gx = -1; if (a.gx < -1) a.gx = GR + 1;
    if (a.gy > GR + 1) a.gy = -1; if (a.gy < -1) a.gy = GR + 1;
    const p = iso(a.gx - G2, a.gy - G2, W, H); const alt = a.alt; const bob = Math.sin(t + a.bk) * 2;
    const x = p.x, y = p.y - alt + bob; const al = Math.min(1, fade * 1.5); if (al < .02) return;
    c.globalAlpha = al * .35;
    c.fillStyle = 'rgba(0,0,0,.06)'; c.beginPath(); c.ellipse(p.x, p.y, 5, 2, 0, 0, 6.28); c.fill();
    const hz = a.dx !== 0; const dir = hz ? (a.dx > 0 ? 1 : -1) : (a.dy > 0 ? 1 : -1);
    c.globalAlpha = al * .4; c.fillStyle = 'rgba(140,170,210,1)';
    if (hz) { c.fillRect(x - 6, y, 12, 2); c.fillRect(x - 2, y - 3, 4, 8); c.fillRect(x - (dir > 0 ? 6 : -2), y - 2, 2.5, 4.5); }
    else { c.fillRect(x - 1, y - 6, 2, 12); c.fillRect(x - 4, y - 2, 8, 4); c.fillRect(x - 2.2, y - (dir > 0 ? 6 : -2), 4.5, 2.5); }
    if (Math.sin(t * 3 + a.bk) > .3) { c.fillStyle = '#FF3366'; c.beginPath(); c.arc(x - (hz ? (dir > 0 ? 6 : 0) : 0), y - (hz ? 0 : (dir > 0 ? 6 : 0)), .8, 0, 6.28); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(x + (hz ? (dir > 0 ? 6 : 0) : 0), y + (hz ? 1 : (dir > 0 ? 0 : 6)), .7, 0, 6.28); c.fill();
    c.strokeStyle = `rgba(200,200,255,${.04 * al})`; c.lineWidth = .5; c.beginPath();
    c.moveTo(x - (hz ? dir * 6 : 0), y - (hz ? 0 : dir * 6)); c.lineTo(x - (hz ? dir * 35 : 0), y - (hz ? 0 : dir * 35) + 1); c.stroke();
    c.globalAlpha = 1;
  } else if (a.tp === 'ufo') {
    a.gx = a.ogx + Math.sin(t * .18 + a.bk) * 5; a.gy = a.ogy + Math.cos(t * .13 + a.bk) * 5;
    const p = iso(a.gx - G2, a.gy - G2, W, H); const alt = a.alt; const x = p.x, y = p.y - alt;
    const al = Math.min(1, fade * 1.5); if (al < .02) return;
    c.fillStyle = 'rgba(0,0,0,.04)'; c.globalAlpha = al; c.beginPath(); c.ellipse(p.x, p.y, 6, 2.5, 0, 0, 6.28); c.fill();
    c.fillStyle = a.col; c.globalAlpha = al * .35; c.beginPath(); c.ellipse(x, y, 8, 3, 0, 0, 6.28); c.fill();
    c.globalAlpha = al * .2; c.beginPath(); c.ellipse(x, y - 2, 4, 3, 0, Math.PI, 0); c.fill();
    for (let l = 0; l < 4; l++) { const la = t * 2 + l * 1.57; c.fillStyle = a.col; c.globalAlpha = al * (.2 + Math.sin(la) * .12); c.beginPath(); c.arc(x + Math.cos(la) * 6, y + Math.sin(la) * 2.4, .8, 0, 6.28); c.fill(); }
    if (Math.sin(t * .35 + a.bk) > .8) { c.fillStyle = a.col; c.globalAlpha = al * .02; c.beginPath(); c.moveTo(x - 3.5, y + 3); c.lineTo(x + 3.5, y + 3); c.lineTo(p.x + 8, p.y); c.lineTo(p.x - 8, p.y); c.closePath(); c.fill(); }
    c.globalAlpha = 1;
  } else if (a.tp === 'heli') {
    a.orA += .006; a.gx = GR / 2 + Math.cos(a.orA) * a.orR; a.gy = GR / 2 + Math.sin(a.orA) * a.orR;
    const p = iso(a.gx - G2, a.gy - G2, W, H); const alt = a.alt; const x = p.x, y = p.y - alt;
    const al = Math.min(1, fade * 1.5); if (al < .02) return;
    c.fillStyle = 'rgba(0,0,0,.03)'; c.globalAlpha = al; c.beginPath(); c.ellipse(p.x, p.y, 4, 1.8, 0, 0, 6.28); c.fill();
    c.globalAlpha = al * .35; c.fillStyle = 'rgba(160,160,100,1)'; c.fillRect(x - 3, y, 6, 2); c.fillRect(x + 3, y + .2, 4.5, 1);
    const rA = t * 16; c.strokeStyle = `rgba(255,255,255,${.12 * al})`; c.lineWidth = .35; c.beginPath(); c.moveTo(x - 7 * Math.cos(rA), y - 1.2); c.lineTo(x + 7 * Math.cos(rA), y - 1.2); c.stroke();
    if (Math.sin(t * 4) > .3) { c.fillStyle = '#FF3366'; c.globalAlpha = al; c.beginPath(); c.arc(x, y + 2, .6, 0, 6.28); c.fill(); }
    c.globalAlpha = 1;
  } else if (a.tp === 'drone') {
    a.gx = a.ogx + Math.sin(t * .4 + a.bk) * 3;
    a.gy = a.ogy + Math.cos(t * .3 + a.bk * 1.5) * 3;
    const p = iso(a.gx - G2, a.gy - G2, W, H); const alt = a.alt;
    const x = p.x, y = p.y - alt + Math.sin(t * 2 + a.bk) * 1.5;
    const al = Math.min(1, fade * 1.5); if (al < .02) return;
    c.globalAlpha = al * .45;
    // Body + arms
    c.fillStyle = '#333355'; c.fillRect(x - 4, y - .25, 8, .5); c.fillRect(x - .25, y - 2.5, .5, 5);
    c.fillStyle = '#222244'; c.fillRect(x - 1.5, y - .5, 3, 1.2);
    // LED
    c.fillStyle = a.col; c.globalAlpha = al * .4;
    c.fillRect(x - .5, y + 1, 1, 1);
    c.globalAlpha = 1;
  } else if (a.tp === 'blimp') {
    a.gx += a.dx; if (a.gx > GR + 10) a.gx = -10;
    const p = iso(a.gx - G2, a.gy - G2, W, H); const alt = a.alt; const bob = Math.sin(t * .2 + a.bk) * 5;
    const x = p.x, y = p.y - alt + bob; const al = Math.min(1, fade * 2); if (al < .01) return;
    // Shadow on ground — bigger
    c.fillStyle = 'rgba(0,0,0,.07)'; c.globalAlpha = al; c.beginPath(); c.ellipse(p.x, p.y, 60, 18, 0, 0, 6.28); c.fill();
    // Outer glow — bigger
    c.fillStyle = 'rgba(131,110,249,.04)'; c.globalAlpha = al; c.beginPath(); c.ellipse(x, y, 120, 48, 0, 0, 6.28); c.fill();
    // Main body — 25% bigger (80→100)
    c.fillStyle = 'rgba(131,110,249,.3)'; c.globalAlpha = al; c.beginPath(); c.ellipse(x, y, 100, 38, 0, 0, 6.28); c.fill();
    // Body highlight
    c.fillStyle = 'rgba(180,160,255,.12)'; c.beginPath(); c.ellipse(x - 14, y - 12, 62, 18, -.12, 0, 6.28); c.fill();
    // Body border glow
    c.strokeStyle = 'rgba(131,110,249,.25)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y, 100, 38, 0, 0, 6.28); c.stroke();
    // Stripe band
    c.fillStyle = 'rgba(0,240,255,.06)'; c.fillRect(x - 95, y - 2, 190, 4);
    // Fins — bigger
    c.fillStyle = 'rgba(100,80,200,.2)'; c.beginPath();
    c.moveTo(x + 82, y - 10); c.lineTo(x + 100, y - 28); c.lineTo(x + 100, y - 2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x + 82, y + 10); c.lineTo(x + 100, y + 28); c.lineTo(x + 100, y + 2); c.closePath(); c.fill();
    // Center fin
    c.fillStyle = 'rgba(80,60,180,.15)'; c.beginPath();
    c.moveTo(x + 85, y); c.lineTo(x + 100, y - 16); c.lineTo(x + 100, y + 16); c.closePath(); c.fill();
    // Gondola — bigger
    c.fillStyle = 'rgba(100,80,180,.22)'; c.fillRect(x - 28, y + 34, 56, 12);
    c.strokeStyle = 'rgba(131,110,249,.18)'; c.lineWidth = .6; c.strokeRect(x - 28, y + 34, 56, 12);
    // Gondola windows
    for (let gw = 0; gw < 6; gw++) {
      c.fillStyle = 'rgba(0,240,255,.15)'; c.fillRect(x - 24 + gw * 9, y + 36, 5, 3);
    }
    // Cables
    c.strokeStyle = 'rgba(131,110,249,.15)'; c.lineWidth = .5;
    c.beginPath(); c.moveTo(x - 24, y + 34); c.lineTo(x - 38, y + 15); c.stroke();
    c.beginPath(); c.moveTo(x + 24, y + 34); c.lineTo(x + 38, y + 15); c.stroke();
    c.beginPath(); c.moveTo(x - 8, y + 34); c.lineTo(x - 12, y + 22); c.stroke();
    c.beginPath(); c.moveTo(x + 8, y + 34); c.lineTo(x + 12, y + 22); c.stroke();
    // MEGAAD text - big and glowing
    c.fillStyle = `rgba(220,200,255,${.7 * al})`; c.shadowColor = '#836EF9'; c.shadowBlur = 18;
    c.font = 'bold 22px Orbitron,monospace'; c.textAlign = 'center'; c.fillText('MEGAETH', x, y + 7);
    // Subtitle
    c.font = 'bold 9px Orbitron,monospace'; c.fillStyle = `rgba(0,240,255,${.55 * al})`; c.shadowColor = '#00F0FF'; c.shadowBlur = 10;
    c.fillText('10,000 TPS', x, y + 18);
    c.shadowBlur = 0; c.textAlign = 'start';
    // Running lights along body — 12 lights
    for (let li = 0; li < 12; li++) {
      const la = t * 1.8 + li * .524; const lx = x + Math.cos(la) * 78, ly = y + Math.sin(la) * 28;
      c.fillStyle = '#836EF9'; c.globalAlpha = al * (.2 + Math.sin(la + t) * .15);
      c.beginPath(); c.arc(lx, ly, 1.8, 0, 6.28); c.fill();
    }
    // Nav lights — bigger
    c.fillStyle = '#FF3366'; c.globalAlpha = al * (.45 + Math.sin(t * 2) * .25);
    c.shadowColor = '#FF3366'; c.shadowBlur = 6;
    c.beginPath(); c.arc(x - 92, y, 3, 0, 6.28); c.fill();
    c.beginPath(); c.arc(x + 92, y, 3, 0, 6.28); c.fill();
    c.fillStyle = '#00FF88'; c.shadowColor = '#00FF88';
    c.beginPath(); c.arc(x, y - 36, 2.5, 0, 6.28); c.fill();
    c.shadowBlur = 0;
    // Spotlight beam — wider
    if (Math.sin(t * .3) > -.3) {
      c.fillStyle = 'rgba(131,110,249,.02)'; c.globalAlpha = al;
      c.beginPath(); c.moveTo(x - 10, y + 46); c.lineTo(x + 10, y + 46);
      c.lineTo(p.x + 28, p.y); c.lineTo(p.x - 28, p.y); c.closePath(); c.fill();
    }
    c.globalAlpha = 1;
  } else if (a.tp === 'sat') {
    a.gx += a.dx; a.gy += a.dy;
    if (a.gx > GR + 2) a.gx = -2; if (a.gx < -2) a.gx = GR + 2;
    if (a.gy > GR + 2) a.gy = -2; if (a.gy < -2) a.gy = GR + 2;
    const p = iso(a.gx - G2, a.gy - G2, W, H); const alt = a.alt;
    const x = p.x, y = p.y - alt + Math.sin(t * .8 + a.bk) * 2;
    const al = Math.min(1, fade * 1.5); if (al < .02) return;
    c.globalAlpha = al * .4;
    c.fillStyle = '#4488FF'; c.fillRect(x - 6, y - .5, 4, 1); c.fillRect(x + 2, y - .5, 4, 1);
    c.fillStyle = '#AABBCC'; c.fillRect(x - 1.5, y - 1, 3, 2);
    if (Math.sin(t * 5 + a.bk) > .5) { c.fillStyle = '#FF3366'; c.beginPath(); c.arc(x, y, 1, 0, 6.28); c.fill(); }
    c.globalAlpha = 1;
  }
}

function dGround(c, t, W, H, layout) {
  const cTop = iso(-G2, -G2, W, H), cRight = iso(G2, -G2, W, H), cBot = iso(G2, G2, W, H), cLeft = iso(-G2, G2, W, H);
  const wPad = 35;
  c.fillStyle = '#020810'; c.beginPath();
  c.moveTo(cTop.x, cTop.y - wPad); c.lineTo(cRight.x + wPad, cRight.y);
  c.lineTo(cBot.x, cBot.y + wPad); c.lineTo(cLeft.x - wPad, cLeft.y);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,240,255,.025)'; c.lineWidth = 1.5; c.beginPath();
  c.moveTo(cTop.x, cTop.y - 4); c.lineTo(cRight.x + 4, cRight.y);
  c.lineTo(cBot.x, cBot.y + 4); c.lineTo(cLeft.x - 4, cLeft.y); c.closePath(); c.stroke();
  for (let gy = 0; gy < GR; gy++) for (let gx = 0; gx < GR; gx++) {
    const ti = layout[gy]?.[gx];
    if (ti === 1) {
      // Roads get subtle district tint
      const rd = getDistrictAt(gx, gy);
      const rc = rd === 'nft' ? '#0C081A' : rd === 'yield' ? '#080C0A' : rd === 'perps' ? '#0C080A' : '#0A0A14';
      const rb = rd === 'nft' ? 'rgba(255,51,102,.012)' : rd === 'yield' ? 'rgba(0,255,136,.012)'
        : rd === 'perps' ? 'rgba(255,51,102,.012)' : rd === 'bridge' ? 'rgba(0,255,204,.012)'
        : 'rgba(131,110,249,.015)';
      dTile(c, gx, gy, rc, rb, W, H);
      const p = iso(gx - G2, gy - G2, W, H);
      // District-colored lane markings
      const lc = rd === 'defi' ? 'rgba(0,240,255,.06)' : rd === 'nft' ? 'rgba(255,51,102,.06)'
        : rd === 'yield' ? 'rgba(0,255,136,.06)' : rd === 'derivatives' ? 'rgba(255,159,28,.06)'
        : rd === 'perps' ? 'rgba(255,51,102,.06)' : rd === 'bridge' ? 'rgba(0,255,204,.06)'
        : rd === 'lending' ? 'rgba(255,224,102,.06)' : rd === 'parallel' ? 'rgba(184,169,255,.06)'
        : 'rgba(255,224,102,.04)';
      if ((gx + gy) % 2 === 0) { c.fillStyle = lc; c.fillRect(p.x - .6, p.y - .3, 1.2, .6); }
      if (gx % 4 === 0 && gy % 4 === 0) { c.fillStyle = lc; for (let s = -2; s <= 2; s++) c.fillRect(p.x + s * 2, p.y - .6, 1.2, .4); }
    } else if (ti === 2) {
      dTile(c, gx, gy, `rgb(8,${30 + Math.floor(Math.sin(t * .3 + gx + gy) * 6)},14)`, 'rgba(0,255,136,.03)', W, H);
    } else if (ti === 3) {
      dTile(c, gx, gy, '#0C051A', 'rgba(131,110,249,.04)', W, H);
      const p = iso(gx - G2, gy - G2, W, H), pl = Math.sin(t * 1.4) * .3 + .7;
      c.fillStyle = `rgba(131,110,249,${.04 * pl})`; c.beginPath(); c.ellipse(p.x, p.y, 5, 2.5, 0, 0, 6.28); c.fill();
      c.fillStyle = `rgba(0,240,255,${.08 * pl})`; c.beginPath(); c.ellipse(p.x, p.y, 2.5, 1.2, 0, 0, 6.28); c.fill();
    } else if (ti === 4) {
      const sh = Math.sin(t * .8 + gx * 3 + gy * 2) * .15 + .85;
      dTile(c, gx, gy, `rgb(0,${Math.floor(20 * sh)},${Math.floor(42 * sh)})`, 'rgba(0,240,255,.04)', W, H);
    } else {
      // District-themed ground color
      const d = getDistrictAt(gx, gy);
      const gc = d === 'defi' ? '#060A1E' : d === 'nft' ? '#0A061E' : d === 'yield' ? '#060E0A'
        : d === 'derivatives' ? '#0E0806' : d === 'infra' ? '#06061E' : d === 'perps' ? '#0E060A'
        : d === 'bridge' ? '#060E0E' : d === 'lending' ? '#0A0A06' : d === 'parallel' ? '#08041E'
        : '#06061A';
      const gb = d === 'defi' ? 'rgba(0,240,255,.015)' : d === 'nft' ? 'rgba(255,51,102,.015)'
        : d === 'yield' ? 'rgba(0,255,136,.015)' : d === 'derivatives' ? 'rgba(255,159,28,.015)'
        : d === 'infra' ? 'rgba(131,110,249,.015)' : d === 'perps' ? 'rgba(255,51,102,.015)'
        : d === 'bridge' ? 'rgba(0,255,204,.015)' : d === 'lending' ? 'rgba(255,224,102,.015)'
        : d === 'parallel' ? 'rgba(184,169,255,.015)' : 'rgba(131,110,249,.012)';
      dTile(c, gx, gy, gc, gb, W, H);
      // District ground accents (every few tiles)
      if ((gx + gy * 3) % 7 === 0) {
        const dp = iso(gx - G2, gy - G2, W, H);
        if (d === 'nft') {
          // Small art installation dots
          c.fillStyle = '#FF3366'; c.globalAlpha = .04;
          c.beginPath(); c.arc(dp.x, dp.y, 1.5, 0, 6.28); c.fill(); c.globalAlpha = 1;
        } else if (d === 'yield') {
          // Tiny garden patch
          c.fillStyle = '#0A5020'; c.globalAlpha = .08;
          c.beginPath(); c.ellipse(dp.x, dp.y, 2, 1, 0, 0, 6.28); c.fill(); c.globalAlpha = 1;
        } else if (d === 'bridge') {
          // Portal glow on ground
          c.fillStyle = '#00FFCC'; c.globalAlpha = .03;
          c.beginPath(); c.ellipse(dp.x, dp.y, 2.5, 1.2, 0, 0, 6.28); c.fill(); c.globalAlpha = 1;
        } else if (d === 'parallel') {
          // Speed streak
          c.strokeStyle = '#836EF9'; c.globalAlpha = .04; c.lineWidth = .3;
          c.beginPath(); c.moveTo(dp.x - 3, dp.y); c.lineTo(dp.x + 3, dp.y); c.stroke(); c.globalAlpha = 1;
        }
      }
    }
  }
}

function dWeather(w, cW, t, W, H, particles) {
  w.clearRect(0, 0, W, H);
  const { drops, sfl } = particles;
  if (cW.snow) {
    const intensity = cW.n === 'BLIZZARD' ? 1.5 : 1;
    for (let i = 0; i < Math.min(180 * intensity, sfl.length); i++) {
      const s = sfl[i]; s.y += s.spd * intensity; s.x += Math.sin(t * .35 + s.dr) * .8 + (cW.wind || 0) * intensity;
      if (s.y > H) { s.y = -6; s.x = Math.random() * W; } if (s.x > W + 10) s.x = -10;
      w.fillStyle = `rgba(210,215,245,${s.a * intensity})`; w.beginPath(); w.arc(s.x, s.y, s.sz * .35 * intensity, 0, 6.28); w.fill();
    }
    if (cW.n === 'BLIZZARD') { w.fillStyle = 'rgba(200,210,240,.03)'; w.fillRect(0, 0, W, H); }
    return;
  }
  if (cW.aurora) {
    for (let i = 0; i < 3; i++) {
      const ay = 30 + i * 22 + Math.sin(t * .22 + i) * 10;
      const ag = w.createLinearGradient(0, ay - 15, 0, ay + 15);
      ag.addColorStop(0, 'transparent'); ag.addColorStop(.3, `rgba(0,255,136,${.025 - i * .006})`);
      ag.addColorStop(.5, `rgba(131,110,249,${.03 - i * .006})`); ag.addColorStop(.7, `rgba(0,240,255,${.025 - i * .006})`);
      ag.addColorStop(1, 'transparent'); w.fillStyle = ag; w.beginPath();
      for (let x = 0; x <= W; x += 6) { const y2 = ay + Math.sin(x * .003 + t * .35 + i) * 15; if (x === 0) w.moveTo(x, y2); else w.lineTo(x, y2); }
      for (let x = W; x >= 0; x -= 6) w.lineTo(x, ay + 30 + Math.sin(x * .002 + t * .2 + i) * 7);
      w.closePath(); w.fill();
    }
    return;
  }
  if (cW.golden) {
    const g = w.createRadialGradient(W / 2, H * .3, 0, W / 2, H * .3, W * .5);
    g.addColorStop(0, 'rgba(255,200,50,.04)'); g.addColorStop(.5, 'rgba(255,180,30,.015)'); g.addColorStop(1, 'transparent');
    w.fillStyle = g; w.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) { const sx = W * .2 + Math.sin(t * .3 + i * 1.1) * W * .3, sy = H * .15 + Math.cos(t * .2 + i) * H * .1; w.fillStyle = `rgba(255,220,80,${.02 + Math.sin(t + i) * .01})`; w.beginPath(); w.arc(sx, sy, 15 + Math.sin(t * .5 + i) * 5, 0, 6.28); w.fill(); }
    return;
  }
  if (cW.stars) {
    for (let i = 0; i < 80; i++) { const sx = (i * 97 + t * 2) % W, sy = (i * 67) % (H * .5); const tw = Math.sin(t * 3 + i * 1.3); if (tw > .0) { w.fillStyle = `rgba(220,200,255,${.15 + tw * .15})`; w.beginPath(); w.arc(sx, sy, tw * .8 + .3, 0, 6.28); w.fill(); if (tw > .6) { w.fillStyle = `rgba(220,200,255,${tw * .05})`; w.beginPath(); w.arc(sx, sy, tw * 3, 0, 6.28); w.fill(); } } }
    return;
  }
  if (cW.sunrise) {
    const g = w.createLinearGradient(0, 0, 0, H * .4);
    g.addColorStop(0, 'rgba(255,120,50,.03)'); g.addColorStop(.3, 'rgba(255,180,80,.02)');
    g.addColorStop(.6, 'rgba(255,220,150,.01)'); g.addColorStop(1, 'transparent');
    w.fillStyle = g; w.fillRect(0, 0, W, H * .4);
    const sx = W * .5 + Math.sin(t * .1) * W * .1, sy = H * .08;
    w.fillStyle = 'rgba(255,200,100,.04)'; w.beginPath(); w.arc(sx, sy, 30, 0, 6.28); w.fill();
    w.fillStyle = 'rgba(255,180,80,.02)'; w.beginPath(); w.arc(sx, sy, 60, 0, 6.28); w.fill();
    return;
  }
  // Rain
  const int = cW.r; if (int <= 0) return;
  const cnt = Math.floor(500 * int);
  const rainColor = cW.acid ? `rgba(120,255,80,${.1 * int})` : `rgba(150,170,220,${.08 * int})`;
  w.strokeStyle = rainColor; w.lineWidth = cW.acid ? .6 : .45;
  for (let i = 0; i < Math.min(cnt, drops.length); i++) {
    const d = drops[i]; d.y += d.spd * int; d.x -= cW.wind * int;
    if (d.y > H) { d.y = -12; d.x = Math.random() * W; } if (d.x < -12) d.x = W + 12;
    w.globalAlpha = d.a * int; w.beginPath(); w.moveTo(d.x, d.y); w.lineTo(d.x - cW.wind * int, d.y + d.len); w.stroke();
  }
  w.globalAlpha = 1;
  if (cW.acid) { w.fillStyle = 'rgba(80,255,50,.015)'; w.fillRect(0, 0, W, H); }
  if (cW.fog > 0) {
    const fg = w.createLinearGradient(0, H * .6, 0, H);
    fg.addColorStop(0, 'transparent'); fg.addColorStop(1, `rgba(10,6,22,${.22 * cW.fog})`);
    w.fillStyle = fg; w.fillRect(0, H * .6, W, H * .4);
  }
  for (let i = 0; i < 5; i++) { const cx2 = (i * W / 4 + t * 3.5 * (i * .1 + .25)) % (W + 400) - 200; w.fillStyle = `rgba(12,8,25,${.3 * int})`; w.beginPath(); w.ellipse(cx2, 18 + i * 8, 120 + i * 18, 14 + i * 4, 0, 0, 6.28); w.fill(); }
}

function dParticles(c, t, W, H, pts) {
  pts.forEach(p => {
    p.y -= p.spd; p.x += Math.sin(t * .25 + p.y * .005) * .15;
    if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
    c.fillStyle = p.co; c.globalAlpha = p.a * (.5 + Math.sin(t * 1.5 + p.x) * .5);
    c.fillRect(p.x, p.y, p.sz, p.sz); c.globalAlpha = 1;
  });
}

/* ══════════ MAIN COMPONENT ══════════ */
export default function MonadCity() {
  const data = useMonadCityData();
  const cityRef = useRef(null);
  const weatherRef = useRef(null);
  const flashRef = useRef(null);
  const animRef = useRef(0);
  const frameRef = useRef(null);
  const entitiesRef = useRef(null);
  const particlesRef = useRef(null);
  const sizeRef = useRef({ W: 800, H: 600 });

  // Simulation state
  const [simState, setSimState] = useState(() => {
    const txH = []; for (let i = 0; i < 14; i++) txH.push(8 + Math.floor(Math.random() * 45));
    const ev = []; for (let i = 0; i < 6; i++) ev.push(EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]);
    return { lp: 38, txH, ev, weather: pickWeather(38) };
  });
  const simRef = useRef(simState);
  simRef.current = simState;

  // UI state
  const [openMenu, setOpenMenu] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showPanels, setShowPanels] = useState(true);
  const [showTicker, setShowTicker] = useState(true);
  const [highQuality, setHighQuality] = useState(() => {
    try { return localStorage.getItem('mc-quality') !== 'low'; } catch { return true; }
  });
  const [activeDistrict, setActiveDistrict] = useState(null);
  const [districtLabel, setDistrictLabel] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [tickerHtml, setTickerHtml] = useState('');
  const districtTimerRef = useRef(null);

  // Init entities once
  const layout = useMemo(() => generateLayout(), []);
  useEffect(() => {
    entitiesRef.current = {
      bldgs: generateBuildings(layout),
      trees: generateTrees(layout),
      cars: generateCars(highQuality ? 120 : 50),
      peds: generatePeds(highQuality ? 150 : 60, layout),
      lamps: generateLamps(layout),
      air: highQuality ? generateAircraft() : [],
    };
    particlesRef.current = generateWeatherParticles();
  }, [layout, highQuality]);

  // Build ticker
  const buildTicker = useCallback(() => {
    let h = '';
    for (let i = 0; i < 30; i++) {
      const p = PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)];
      const tc = Math.floor(3 + Math.random() * 60);
      const r = Math.random();
      if (r < .08) h += `<span style="color:rgba(131,110,249,.25);margin:0 6px">///</span><span style="color:#FF3366">♥ BIG</span> <span style="color:#B8A9FF">${(Math.random() * 500 + 10).toFixed(0)} ETH</span>`;
      else if (r < .14) h += `<span style="color:rgba(131,110,249,.25);margin:0 6px">///</span><span style="color:#FF9F1C">WHALE</span> <span style="color:#B8A9FF">${(Math.random() * 1e5 + 5e3).toFixed(0)} ETH</span>`;
      else h += `<span style="color:rgba(131,110,249,.25);margin:0 6px">///</span><span style="color:#00F0FF">${p}</span> <span style="color:#B8A9FF">${tc} TXs</span>`;
    }
    setTickerHtml(h);
  }, []);

  useEffect(() => { buildTicker(); const iv = setInterval(buildTicker, 30000); return () => clearInterval(iv); }, [buildTicker]);

  // Data simulation
  useEffect(() => {
    const iv = setInterval(() => {
      setSimState(prev => {
        let lp = Math.max(25, Math.min(50, prev.lp + (Math.random() - .48) * 1.5));
        const txH = [...prev.txH, Math.floor(3 + Math.random() * 55)];
        if (txH.length > 14) txH.shift();
        let weather = prev.weather;
        if (Math.random() < .05) weather = pickWeather(lp);
        const ev = [...prev.ev];
        if (Math.random() < .4) { ev.unshift(EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]); if (ev.length > 7) ev.pop(); }
        return { lp, txH, ev, weather };
      });
    }, 2500);
    return () => clearInterval(iv);
  }, []);

  // Canvas resize
  useEffect(() => {
    const root = cityRef.current?.parentElement;
    if (!root) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        const W = Math.floor(width), H = Math.floor(height);
        sizeRef.current = { W, H };
        if (cityRef.current) { cityRef.current.width = W; cityRef.current.height = H; }
        if (weatherRef.current) { weatherRef.current.width = W; weatherRef.current.height = H; }
        if (flashRef.current) { flashRef.current.width = W; flashRef.current.height = H; }
      }
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  // Pre-sorted static entities (buildings, trees, lamps don't move)
  const staticEntsRef = useRef(null);
  useEffect(() => {
    const ents = entitiesRef.current;
    if (!ents) return;
    const statics = [];
    ents.bldgs.forEach(b => statics.push({ tp: 'b', d: b.gx + b.gy, o: b }));
    ents.trees.forEach(tr => statics.push({ tp: 't', d: tr.gx + tr.gy + .1, o: tr }));
    ents.lamps.forEach(lm => statics.push({ tp: 'l', d: lm.gx + lm.gy + .02, o: lm }));
    statics.sort((a, b) => a.d - b.d);
    staticEntsRef.current = statics;
  }, [layout, highQuality]);

  // Cached contexts
  const ctxRef = useRef(null);
  const wctxRef = useRef(null);
  // Cached background gradient
  const bgRef = useRef({ W: 0, H: 0, grad: null });

  // Render loop
  useEffect(() => {
    let running = true;
    let frameCount = 0;
    function render() {
      if (!running) return;
      const ents = entitiesRef.current;
      const parts = particlesRef.current;
      const statics = staticEntsRef.current;
      if (!ents || !parts || !statics) { frameRef.current = requestAnimationFrame(render); return; }
      const { W, H } = sizeRef.current;
      const cv = cityRef.current; const wc = weatherRef.current;
      if (!cv || !wc) { frameRef.current = requestAnimationFrame(render); return; }
      // Cache contexts
      if (!ctxRef.current || ctxRef.current.canvas !== cv) ctxRef.current = cv.getContext('2d');
      if (!wctxRef.current || wctxRef.current.canvas !== wc) wctxRef.current = wc.getContext('2d');
      const c = ctxRef.current; const w = wctxRef.current;
      frameCount++;
      animRef.current += 1 / 60;
      const t = animRef.current;
      c.clearRect(0, 0, W, H);
      // Cache background gradient
      if (bgRef.current.W !== W || bgRef.current.H !== H) {
        const bg = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * .68);
        bg.addColorStop(0, '#0C0422'); bg.addColorStop(.5, '#07040F'); bg.addColorStop(1, '#030208');
        bgRef.current = { W, H, grad: bg };
      }
      c.fillStyle = bgRef.current.grad; c.fillRect(0, 0, W, H);
      // Stars (fewer)
      for (let i = 0; i < 30; i++) {
        const sx = (i * 121 + t * .1) % W, sy = (i * 79) % (H * .28);
        if (Math.sin(t * 1.3 + i) > .5) { c.fillStyle = 'rgba(200,180,255,.15)'; c.fillRect(sx, sy, .8, .8); }
      }
      dParticles(c, t, W, H, parts.pts);
      dGround(c, t, W, H, layout);
      // Update cars + peds
      const { cars, peds, air } = ents;
      for (let i = 0; i < cars.length; i++) {
        const cr = cars[i];
        cr.gx += cr.dx; cr.gy += cr.dy;
        if (cr.dx !== 0) { if (cr.dx > 0 && cr.gx > GR - 1) cr.gx = 1; if (cr.dx < 0 && cr.gx < 1) cr.gx = GR - 1; }
        else { if (cr.dy > 0 && cr.gy > GR - 1) cr.gy = 1; if (cr.dy < 0 && cr.gy < 1) cr.gy = GR - 1; }
      }
      // Update peds every other frame
      if (frameCount % 2 === 0) {
        for (let i = 0; i < peds.length; i++) {
          const pd = peds[i];
          pd.gx += pd.dx * 2; pd.gy += pd.dy * 2; pd.tt -= 2;
          if (pd.tt <= 0) { const a2 = Math.random() * 6.28, sp = .002 + Math.random() * .005; pd.dx = Math.cos(a2) * sp; pd.dy = Math.sin(a2) * sp; pd.tt = 50 + Math.random() * 180; }
          if (pd.gx < 1) { pd.gx = 1; pd.dx = Math.abs(pd.dx); } if (pd.gx > GR - 1) { pd.gx = GR - 1; pd.dx = -Math.abs(pd.dx); }
          if (pd.gy < 1) { pd.gy = 1; pd.dy = Math.abs(pd.dy); } if (pd.gy > GR - 1) { pd.gy = GR - 1; pd.dy = -Math.abs(pd.dy); }
        }
      }
      // Merge dynamic entities into sorted statics using insertion
      const ad = activeDistrict;
      const distInfo = ad ? DISTRICTS.find(d => d.id === ad) : null;
      // Render statics, inserting dynamic entities at correct depth
      let ci = 0, pi = 0;
      // Build sorted dynamic arrays (cars/peds move, so must sort)
      const sortedCars = cars.slice().sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
      const sortedPeds = peds.slice().sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
      let si = 0;
      while (si < statics.length || ci < sortedCars.length || pi < sortedPeds.length) {
        const sd = si < statics.length ? statics[si].d : Infinity;
        const cd = ci < sortedCars.length ? sortedCars[ci].gx + sortedCars[ci].gy + .05 : Infinity;
        const pd2 = pi < sortedPeds.length ? sortedPeds[pi].gx + sortedPeds[pi].gy + .03 : Infinity;
        if (sd <= cd && sd <= pd2) {
          const e = statics[si]; si++;
          if (e.tp === 'b') {
            const hl = distInfo && distInfo.gxRange && e.o.gx >= distInfo.gxRange[0] && e.o.gx <= distInfo.gxRange[1] && e.o.gy >= distInfo.gyRange[0] && e.o.gy <= distInfo.gyRange[1];
            dBldg(c, e.o, t, W, H, hl);
          }
          else if (e.tp === 't') dTree(c, e.o, t, W, H);
          else if (e.tp === 'l') dLamp(c, e.o, t, W, H);
        } else if (cd <= pd2) {
          dCar(c, sortedCars[ci], t, W, H); ci++;
        } else {
          dPed(c, sortedPeds[pi], t, W, H); pi++;
        }
      }
      for (let i = 0; i < air.length; i++) dAir(c, air[i], t, W, H);
      // Weather
      const cW = simRef.current.weather;
      if (cW && highQuality) dWeather(w, cW, t, W, H, parts);
      else w.clearRect(0, 0, W, H);
      frameRef.current = requestAnimationFrame(render);
    }
    frameRef.current = requestAnimationFrame(render);
    return () => { running = false; cancelAnimationFrame(frameRef.current); };
  }, [layout, highQuality, activeDistrict]);

  // Mouse move for building tooltips
  const handleMouseMove = useCallback((e) => {
    const ents = entitiesRef.current;
    if (!ents) return;
    const rect = cityRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const { W, H } = sizeRef.current;
    for (let i = ents.bldgs.length - 1; i >= 0; i--) {
      const b = ents.bldgs[i];
      const p = iso(b.gx - G2, b.gy - G2, W, H);
      const hw = TW / 2 - 2;
      if (mx >= p.x - hw && mx <= p.x + hw && my >= p.y - b.h && my <= p.y + TH / 2) {
        setTooltip({ x: e.clientX - rect.left + 10, y: e.clientY - rect.top - 10, proto: b.proto, type: b.tp, dist: b.dist });
        return;
      }
    }
    setTooltip(null);
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // District click
  const handleDistrictClick = useCallback((id) => {
    if (id === 'map') { setActiveDistrict(null); setDistrictLabel(null); return; }
    setActiveDistrict(id);
    const d = DISTRICTS.find(x => x.id === id);
    if (d) setDistrictLabel(d.label);
    clearTimeout(districtTimerRef.current);
    districtTimerRef.current = setTimeout(() => { setActiveDistrict(null); setDistrictLabel(null); }, 3000);
  }, []);

  // Event click -> flash random building
  const handleEventClick = useCallback((ev) => {
    const fc = flashRef.current;
    if (!fc || !entitiesRef.current) return;
    const ctx = fc.getContext('2d');
    const { W, H } = sizeRef.current;
    const bldgs = entitiesRef.current.bldgs;
    const b = bldgs[Math.floor(Math.random() * bldgs.length)];
    const p = iso(b.gx - G2, b.gy - G2, W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = ev.c || '#836EF9'; ctx.globalAlpha = .3;
    ctx.shadowColor = ev.c || '#836EF9'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(p.x, p.y - b.h / 2, 15, 0, 6.28); ctx.fill();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    setTimeout(() => ctx.clearRect(0, 0, W, H), 500);
  }, []);

  // Quality toggle
  const toggleQuality = useCallback(() => {
    setHighQuality(prev => {
      const next = !prev;
      try { localStorage.setItem('mc-quality', next ? 'high' : 'low'); } catch {}
      return next;
    });
  }, []);

  // Close menus on click outside
  useEffect(() => {
    if (!openMenu) return;
    const handler = () => setOpenMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [openMenu]);

  // Derived values
  const blockNumber = data.blockNumber;
  const tps = data.tps;
  const gasPrice = data.gasPrice;
  const price = data.price;
  const weather = simState.weather;
  const lp = Math.round(simState.lp);
  const txH = simState.txH;
  const events = simState.ev;

  return (
    <div className="mc-root">
      {/* Win98 Menu Bar */}
      <div className="mc-menubar" onClick={e => e.stopPropagation()}>
        <div className="mc-menu-item" onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}>
          File
          {openMenu === 'file' && (
            <div className="mc-dropdown">
              <div className="mc-dropdown-item" onClick={() => setOpenMenu(null)}>Exit</div>
            </div>
          )}
        </div>
        <div className="mc-menu-item" onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')}>
          View
          {openMenu === 'view' && (
            <div className="mc-dropdown">
              <div className={`mc-dropdown-item ${highQuality ? 'mc-checked' : ''}`} onClick={toggleQuality}>High Quality</div>
              <div className="mc-dropdown-sep" />
              <div className={`mc-dropdown-item ${showPanels ? 'mc-checked' : ''}`} onClick={() => setShowPanels(v => !v)}>Panels</div>
              <div className={`mc-dropdown-item ${showTicker ? 'mc-checked' : ''}`} onClick={() => setShowTicker(v => !v)}>Ticker</div>
            </div>
          )}
        </div>
        <div className="mc-menu-item" onClick={() => setOpenMenu(openMenu === 'dist' ? null : 'dist')}>
          Districts
          {openMenu === 'dist' && (
            <div className="mc-dropdown">
              {DISTRICTS.map(d => (
                <div key={d.id} className="mc-dropdown-item" onClick={() => { handleDistrictClick(d.id); setOpenMenu(null); }}>{d.label}</div>
              ))}
            </div>
          )}
        </div>
        <div className="mc-menu-item" onClick={() => setOpenMenu(openMenu === 'help' ? null : 'help')}>
          Help
          {openMenu === 'help' && (
            <div className="mc-dropdown">
              <div className="mc-dropdown-item" onClick={() => { setShowAbout(true); setOpenMenu(null); }}>About MEGAAD_CITY.exe</div>
            </div>
          )}
        </div>
      </div>

      {/* Canvas layers */}
      <canvas ref={cityRef} className="mc-city-canvas" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} />
      <canvas ref={weatherRef} className="mc-weather-canvas" />
      <canvas ref={flashRef} className="mc-flash-overlay" />
      <div className="mc-scanlines" />

      {/* Building tooltip */}
      {tooltip && (
        <div className="mc-building-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="mc-tt-proto">{tooltip.proto}</div>
          <div className="mc-tt-type">{tooltip.type.toUpperCase()}</div>
          {tooltip.dist && <div className="mc-tt-dist">{DISTRICTS.find(d => d.id === tooltip.dist)?.label || tooltip.dist}</div>}
        </div>
      )}

      {/* District label */}
      {districtLabel && <div className="mc-district-label" key={districtLabel}>{districtLabel}</div>}

      {showPanels && (
        <>
          {/* Price Panel */}
          <div className="mc-panel mc-price-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <div className="mc-label">ETH / USD</div>
              <span className="mc-testnet-badge">MAINNET</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span className="mc-price">{price.usd != null ? `$${price.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</span>
            </div>
            <div className="mc-gas-row">
              <div className="mc-label">GAS</div>
              <div className="mc-gas-dot" />
              <span className="mc-gas-val">{gasPrice}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <div><div className="mc-label">BLOCK</div><span className="mc-block-num">#{blockNumber.toLocaleString()}</span></div>
            </div>
            <div className="mc-meta">MEGAETH &middot; CHAIN 4326</div>
          </div>

          {/* Block Stats Panel */}
          <div className="mc-panel mc-block-panel">
            <div className="mc-label">BLOCK TXS</div>
            <div className="mc-block-txs">{txH[txH.length - 1] || 0}</div>
            <canvas className="mc-block-chart" ref={el => {
              if (!el) return;
              const x = el.getContext('2d'); if (!x) return;
              el.width = el.offsetWidth; el.height = el.offsetHeight;
              x.clearRect(0, 0, el.width, el.height);
              const bw = el.width / txH.length - 1.2, mx = Math.max(...txH, 1);
              txH.forEach((v, i) => {
                const h2 = Math.max(1.5, v / mx * el.height * .78);
                const px = i * (bw + 1.2), py = el.height - h2;
                const g = x.createLinearGradient(px, py, px, el.height);
                g.addColorStop(0, '#836EF9'); g.addColorStop(1, '#0E0520');
                x.fillStyle = g; x.fillRect(px, py, bw, h2);
                x.fillStyle = 'rgba(131,110,249,.45)'; x.fillRect(px, py, bw, .8);
              });
            }} />
            <div className="mc-block-cols">
              <div><div className="mc-label">PENDING</div><span className="mc-bv mc-bv-p">{lp}%</span></div>
              <div><div className="mc-label">CONFIRMED</div><span className="mc-bv mc-bv-c">{100 - lp}%</span></div>
            </div>
          </div>

          {/* Sentiment Panel */}
          <div className="mc-panel mc-sent-panel">
            <div className="mc-label">SENTIMENT</div>
            <div className="mc-sent-bar">
              <div className="mc-sent-long" style={{ width: `${lp}%` }} />
              <div className="mc-sent-short" style={{ width: `${100 - lp}%` }} />
            </div>
            <div className="mc-sent-labels">
              <span style={{ color: '#00FF88' }}>{lp}% LONG</span>
              <span style={{ color: '#FF3366' }}>{100 - lp}% SHORT</span>
            </div>
            <div className="mc-weather-row">
              <div className="mc-label">WEATHER</div>
              <span className="mc-weather-val">{weather?.i} {weather?.n}</span>
            </div>
          </div>

          {/* Events Panel */}
          <div className="mc-panel mc-events-panel">
            <div className="mc-label">EVENTS</div>
            {events.map((ev, i) => (
              <div key={i} className="mc-event-item" onClick={() => handleEventClick(ev)} style={{ animationDelay: `${i * .02}s` }}>
                <div className="mc-event-dot" style={{ background: ev.c }} />
                <span style={{ color: ev.c }}>{ev.t}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* TPS Bar */}
      <div className="mc-tps-bar">
        TPS <b>{tps}</b> &middot; RES <b>{lp}</b> &middot; BLOCK <b>#{blockNumber.toLocaleString()}</b>
      </div>

      {/* District Bar */}
      <div className="mc-district-bar">
        {DISTRICTS.map(d => (
          <div key={d.id} className={`mc-dt ${d.cls} ${activeDistrict === d.id ? 'active' : ''}`}
            onClick={() => handleDistrictClick(d.id)}>{d.label}</div>
        ))}
      </div>

      {/* Ticker */}
      {showTicker && (
        <div className="mc-ticker">
          <div className="mc-ticker-live"><div className="mc-live-dot" /><span style={{ color: '#00FF88', fontSize: 7 }}>LIVE</span></div>
          <div className="mc-ticker-block">Block #{blockNumber.toLocaleString()}</div>
          <div className="mc-ticker-scroll">
            <div className="mc-ticker-content" dangerouslySetInnerHTML={{ __html: tickerHtml }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mc-footer">
        <span className="mc-footer-label">POWERED BY</span>
        {FOOTER_BRANDS.map(b => (
          <span key={b.name} className="mc-footer-brand" style={{ color: b.color }}>{b.name}</span>
        ))}
      </div>

      {/* About Dialog */}
      {showAbout && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', zIndex: 9999,
        }} onClick={() => setShowAbout(false)}>
          <div className="win-raised" onClick={e => e.stopPropagation()} style={{
            width: 340, padding: 0, background: '#c0c0c0', fontFamily: "'VT323', monospace",
          }}>
            <div style={{ background: 'linear-gradient(90deg, #000080, #1084d0)', color: '#fff', padding: '3px 6px', fontSize: '13px', fontWeight: 'bold' }}>
              About MEGAAD_CITY.exe
            </div>
            <div style={{ padding: '20px 24px', textAlign: 'center', lineHeight: 1.8 }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#000' }}>NX Terminal: Protocol Wars</div>
              <div style={{ fontSize: '13px', color: '#333', marginTop: 8 }}>Running on MegaETH — The First Real-Time Blockchain</div>
              <div style={{ fontSize: '12px', color: '#555', marginTop: 4 }}>10ms blocks | 100K TPS | Chain ID 4326</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: 12 }}>Powered by Ember Labs</div>
              <div style={{ marginTop: 16 }}>
                <button className="win-btn" onClick={() => setShowAbout(false)} style={{ padding: '3px 24px', fontWeight: 'bold' }}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
