// 14 building archetypes for NX CITY.
// Each archetype declares its footprint, height range, valid zones/tiers,
// and a pure render function that takes (b, p, z, a, day, rc) where:
//   b   = building data { id, height, palette, neon, flicker, fw, fd, ... }
//   p   = iso-projected origin point { x, y } of the back vertex
//   z   = camera zoom
//   a   = alpha (spawn animation)
//   day = daylight factor 0..1
//   rc  = render context { ctx, time, flicker } — flicker is the user
//         setting boolean, b.flicker is the per-building seed.

import { TW, TH, ZONE, hash32, shade } from './nxCityConstants';

// --- shared box + windows primitives ------------------------------

export function drawBox(rc, p, wTiles, dTiles, hPx, palette, z, alpha, day) {
  const { ctx } = rc;
  const hwX = (wTiles * TW / 2) * z;
  const hwY = (dTiles * TW / 2) * z;
  const hhX = (wTiles * TH / 2) * z;
  const hhY = (dTiles * TH / 2) * z;
  const h = hPx * z;

  const back  = { x: p.x, y: p.y };
  const right = { x: p.x + hwX, y: p.y + hhX };
  const front = { x: p.x + hwX - hwY, y: p.y + hhX + hhY };
  const left  = { x: p.x - hwY, y: p.y + hhY };

  ctx.globalAlpha = alpha;
  ctx.fillStyle = `rgba(0,0,0,${0.45 + (1 - day) * 0.15})`;
  ctx.beginPath();
  ctx.moveTo(back.x, back.y + 2);
  ctx.lineTo(right.x + 2, right.y + 2);
  ctx.lineTo(front.x, front.y + 2);
  ctx.lineTo(left.x - 2, left.y + 2);
  ctx.closePath();
  ctx.fill();

  const baseCol = day > 0.5 ? shade(palette.base, 1.1) : palette.base;
  const lightCol = day > 0.5 ? shade(palette.light, 1.15) : palette.light;
  const darkCol = palette.dark;

  ctx.fillStyle = darkCol;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(front.x, front.y);
  ctx.lineTo(front.x, front.y - h);
  ctx.lineTo(left.x, left.y - h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = baseCol;
  ctx.beginPath();
  ctx.moveTo(right.x, right.y);
  ctx.lineTo(front.x, front.y);
  ctx.lineTo(front.x, front.y - h);
  ctx.lineTo(right.x, right.y - h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = lightCol;
  ctx.beginPath();
  ctx.moveTo(back.x, back.y - h);
  ctx.lineTo(right.x, right.y - h);
  ctx.lineTo(front.x, front.y - h);
  ctx.lineTo(left.x, left.y - h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,.5)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(back.x, back.y - h);
  ctx.lineTo(right.x, right.y - h);
  ctx.lineTo(front.x, front.y - h);
  ctx.lineTo(left.x, left.y - h);
  ctx.closePath();
  ctx.moveTo(front.x, front.y - h);
  ctx.lineTo(front.x, front.y);
  ctx.stroke();

  return { back, right, front, left, h };
}

export function drawWindows(rc, geom, palette, neon, b, z, alpha, density, day) {
  const { ctx, time, flicker: flickerEnabled } = rc;
  const { left, right, front, h } = geom;
  if (z < 0.55) return;
  const topPad = Math.max(2 * z, h * 0.08);
  const botPad = Math.max(3 * z, h * 0.10);
  const hUsable = Math.max(6 * z, h - topPad - botPad);
  const cols = Math.max(2, Math.floor(density.cols));
  const rows = Math.max(2, Math.floor(density.rows * (hUsable / (8 * z))));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // LEFT face
      {
        const cx0 = c / cols + 0.12 / cols;
        const cx1 = (c + 0.68) / cols + 0.12 / cols;
        const y0 = left.y - h + topPad + hUsable * (r / rows);
        const y1 = left.y - h + topPad + hUsable * ((r + 0.58) / rows);
        const xA0 = left.x + (front.x - left.x) * cx0;
        const xA1 = left.x + (front.x - left.x) * cx1;
        const seed = (hash32(b.id + r * 37 + c) + Math.floor(time * 0.0015)) % 7;
        const lit = seed > 3;
        let fill;
        if (day > 0.5) {
          fill = '#2a3548';
          ctx.globalAlpha = alpha * 0.85;
        } else if (lit) {
          fill = neon;
          ctx.globalAlpha = alpha * (flickerEnabled
            ? (0.7 + Math.sin(time * 0.004 + b.flicker * 10 + r * 0.4) * 0.25)
            : 0.9);
          ctx.shadowColor = neon;
          ctx.shadowBlur = 3 * z;
        } else {
          fill = '#0a0a10';
          ctx.globalAlpha = alpha * 0.9;
        }
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(xA0, y0);
        ctx.lineTo(xA1, y0 + (xA1 - xA0) * (TH / TW));
        ctx.lineTo(xA1, y1 + (xA1 - xA0) * (TH / TW));
        ctx.lineTo(xA0, y1);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // RIGHT face
      {
        const cx0 = c / cols + 0.12 / cols;
        const cx1 = (c + 0.68) / cols + 0.12 / cols;
        const y0 = right.y - h + topPad + hUsable * (r / rows);
        const y1 = right.y - h + topPad + hUsable * ((r + 0.58) / rows);
        const xA0 = right.x + (front.x - right.x) * cx0;
        const xA1 = right.x + (front.x - right.x) * cx1;
        const lit = ((hash32(b.id + r * 41 + c + 999) + Math.floor(time * 0.0013)) % 7) > 4;
        let fill;
        if (day > 0.5) {
          fill = '#3a4458';
          ctx.globalAlpha = alpha * 0.8;
        } else if (lit) {
          fill = shade(neon, 0.7);
          ctx.globalAlpha = alpha * 0.7;
        } else {
          fill = '#080810';
          ctx.globalAlpha = alpha * 0.8;
        }
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(xA0, y0);
        ctx.lineTo(xA1, y0 - (xA1 - xA0) * (TH / TW));
        ctx.lineTo(xA1, y1 - (xA1 - xA0) * (TH / TW));
        ctx.lineTo(xA0, y1);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = alpha;
}

// --- 14 archetypes -------------------------------------------------

export const ARCHETYPES = [
  {
    name: 'house', footprint: [1, 1], minH: 3, maxH: 5, weight: 1.0,
    zones: [ZONE.RESIDENTIAL, ZONE.MIXED],
    tiers: [0, 1, 2, 3, 4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx } = rc;
      const g = drawBox(rc, p, 1, 1, b.height * 5, b.palette, z, a, day);
      drawWindows(rc, g, b.palette, b.neon, b, z, a, { cols: 1, rows: 1 }, day);
      ctx.strokeStyle = shade(b.palette.light, 1.2);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(g.back.x, g.back.y - g.h);
      ctx.lineTo(g.front.x, g.front.y - g.h - 2);
      ctx.stroke();
    },
  },
  {
    name: 'residential', footprint: [1, 1], minH: 5, maxH: 10, weight: 1.3,
    zones: [ZONE.RESIDENTIAL, ZONE.MIXED],
    tiers: [1, 2, 3, 4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx, time } = rc;
      const g = drawBox(rc, p, 1, 1, b.height * 4.5, b.palette, z, a, day);
      drawWindows(rc, g, b.palette, b.neon, b, z, a, { cols: 2, rows: 2 }, day);
      if (b.height >= 6 && z > 0.6) {
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 0.8;
        const midX = (g.back.x + g.front.x) / 2;
        const midY = (g.back.y + g.front.y) / 2 - g.h;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX, midY - 8 * z);
        ctx.stroke();
        if (Math.sin(time * 0.004 + b.flicker * 20) > 0.3) {
          ctx.fillStyle = '#FF3333';
          ctx.shadowColor = '#FF3333';
          ctx.shadowBlur = 6;
          ctx.fillRect(midX - 1, midY - 10 * z, 2, 2);
          ctx.shadowBlur = 0;
        }
      }
    },
  },
  {
    name: 'apartments', footprint: [1, 1], minH: 10, maxH: 20, weight: 0.7,
    zones: [ZONE.RESIDENTIAL, ZONE.MIXED, ZONE.DOWNTOWN],
    tiers: [2, 3, 4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx } = rc;
      const g = drawBox(rc, p, 1, 1, b.height * 4, b.palette, z, a, day);
      drawWindows(rc, g, b.palette, b.neon, b, z, a, { cols: 2, rows: 3 }, day);
      if (z > 0.7) {
        ctx.strokeStyle = shade(b.palette.dark, 0.7);
        ctx.lineWidth = 0.8;
        const floors = b.height;
        for (let f = 1; f < floors; f += 2) {
          const y = g.left.y - g.h + (g.h * f / floors);
          ctx.beginPath();
          ctx.moveTo(g.left.x, y);
          ctx.lineTo(g.front.x, y + (g.front.x - g.left.x) * (TH / TW));
          ctx.lineTo(g.right.x, y);
          ctx.stroke();
        }
      }
    },
  },
  {
    name: 'office', footprint: [2, 1], minH: 6, maxH: 14, weight: 1.0,
    zones: [ZONE.MIXED, ZONE.DOWNTOWN],
    tiers: [2, 3, 4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx, time } = rc;
      const g = drawBox(rc, p, 2, 1, b.height * 4.5, b.palette, z, a, day);
      drawWindows(rc, g, b.palette, b.neon, b, z, a, { cols: 3, rows: 2 }, day);
      if (day < 0.6) {
        ctx.fillStyle = b.neon;
        ctx.globalAlpha = a * (0.55 + Math.sin(time * 0.003 + b.flicker * 5) * 0.3);
        ctx.shadowColor = b.neon;
        ctx.shadowBlur = 4 * z;
        ctx.fillRect(
          (g.back.x + g.left.x) / 2 - 2,
          g.back.y - g.h - 1,
          Math.max(2, (g.right.x - g.left.x) * 0.7),
          1 * z,
        );
        ctx.shadowBlur = 0;
        ctx.globalAlpha = a;
      }
    },
  },
  {
    name: 'warehouse', footprint: [2, 2], minH: 2, maxH: 3, weight: 0.6,
    zones: [ZONE.INDUSTRIAL, ZONE.MIXED],
    tiers: [0, 1, 2, 3],
    render(b, p, z, a, day, rc) {
      const { ctx } = rc;
      const g = drawBox(rc, p, 2, 2, b.height * 5, b.palette, z, a, day);
      if (z > 0.55) {
        ctx.fillStyle = b.neon;
        ctx.globalAlpha = a * (day > 0.5 ? 0.4 : 0.7);
        const y = g.left.y - g.h * 0.6;
        for (let i = 0; i < 3; i++) {
          const t = (i + 0.5) / 3;
          const x0 = g.left.x + (g.front.x - g.left.x) * t - 2 * z;
          ctx.fillRect(x0, y + (x0 - g.left.x) * (TH / TW), 4 * z, 0.6 * z);
        }
        ctx.globalAlpha = a;
      }
    },
  },
  {
    name: 'tower', footprint: [2, 2], minH: 12, maxH: 28, weight: 0.9,
    zones: [ZONE.DOWNTOWN, ZONE.MIXED],
    tiers: [3, 4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx, time } = rc;
      const g = drawBox(rc, p, 2, 2, b.height * 4, b.palette, z, a, day);
      drawWindows(rc, g, b.palette, b.neon, b, z, a, { cols: 4, rows: 3 }, day);
      if (z > 0.7 && day < 0.7) {
        const midX = (g.left.x + g.front.x) / 2;
        const midY = (g.left.y + g.front.y) / 2 - g.h * 0.7;
        ctx.fillStyle = shade(b.neon, 0.9);
        ctx.globalAlpha = a * (0.7 + Math.sin(time * 0.003) * 0.3);
        ctx.shadowColor = b.neon;
        ctx.shadowBlur = 6 * z;
        ctx.fillRect(midX - 5 * z, midY - 4 * z, 10 * z, 6 * z);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(3, Math.floor(4 * z))}px "Share Tech Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('NX', midX, midY - 1);
      }
      ctx.globalAlpha = a;
    },
  },
  {
    name: 'skyscraper', footprint: [2, 2], minH: 18, maxH: 40, weight: 0.5,
    zones: [ZONE.DOWNTOWN],
    tiers: [3, 4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx, time } = rc;
      const baseH = b.height * 0.55 * 4;
      const g1 = drawBox(rc, p, 2, 2, baseH, b.palette, z, a, day);
      drawWindows(rc, g1, b.palette, b.neon, b, z, a, { cols: 4, rows: 3 }, day);
      const topP = { x: p.x, y: p.y - baseH * z };
      const stepH = b.height * 0.45 * 4;
      const g2 = drawBox(rc, topP, 2, 2, stepH, b.palette, z * 0.75, a, day);
      drawWindows(rc, g2, b.palette, b.neon, b, z * 0.75, a, { cols: 3, rows: 3 }, day);
      const totalH = (baseH + stepH) * z;
      const spireX = p.x;
      const spireY = p.y - totalH;
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(spireX, spireY);
      ctx.lineTo(spireX, spireY - 14 * z);
      ctx.stroke();
      if (Math.sin(time * 0.005 + b.flicker * 10) > 0) {
        ctx.fillStyle = '#FF3333';
        ctx.shadowColor = '#FF3333';
        ctx.shadowBlur = 8;
        ctx.fillRect(spireX - 1, spireY - 15 * z, 2, 2);
        ctx.shadowBlur = 0;
      }
    },
  },
  {
    name: 'industrial', footprint: [2, 1], minH: 3, maxH: 6, weight: 0.5,
    zones: [ZONE.INDUSTRIAL],
    tiers: [0, 1, 2, 3, 4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx, time } = rc;
      const g = drawBox(rc, p, 2, 1, b.height * 4, b.palette, z, a, day);
      if (z > 0.55) {
        ctx.fillStyle = b.neon;
        ctx.globalAlpha = a * (day > 0.5 ? 0.3 : 0.6);
        ctx.fillRect((g.left.x + g.front.x) / 2 - 3 * z, g.left.y - g.h * 0.4, 6 * z, 1 * z);
        ctx.globalAlpha = a;
      }
      const stackX = (g.back.x + g.right.x) / 2;
      const stackY = (g.back.y + g.right.y) / 2 - g.h;
      ctx.fillStyle = '#2a2520';
      ctx.fillRect(stackX - 1.5 * z, stackY - 14 * z, 3 * z, 14 * z);
      ctx.fillStyle = '#3a3528';
      ctx.fillRect(stackX - 2 * z, stackY - 15 * z, 4 * z, 2 * z);
      if (z > 0.7) {
        const sA = 0.15 + Math.sin(time * 0.002 + b.flicker * 10) * 0.1;
        ctx.fillStyle = `rgba(180,180,200,${sA * (day > 0.5 ? 1 : 0.6)})`;
        ctx.beginPath();
        ctx.arc(stackX, stackY - 18 * z, 3 * z, 0, Math.PI * 2);
        ctx.arc(stackX + 2 * z, stackY - 22 * z, 4 * z, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    name: 'megahq', footprint: [3, 3], minH: 25, maxH: 50, weight: 0.12,
    zones: [ZONE.DOWNTOWN],
    tiers: [4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx, time } = rc;
      const pedH = 6 * 4;
      drawBox(rc, p, 3, 3, pedH, b.palette, z, a, day);
      const topP = { x: p.x, y: p.y - pedH * z };
      const mainH = (b.height - 6) * 4;
      const g2 = drawBox(rc, topP, 2, 2, mainH, b.palette, z, a, day);
      drawWindows(rc, g2, b.palette, b.neon, b, z, a, { cols: 4, rows: 5 }, day);
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(topP.x, topP.y - mainH * z);
      ctx.lineTo(topP.x, topP.y - mainH * z - 22 * z);
      ctx.stroke();
      if (z > 0.8 && day < 0.5) {
        const hx = topP.x;
        const hy = topP.y - mainH * z - 26 * z;
        ctx.strokeStyle = b.neon;
        ctx.lineWidth = 1;
        ctx.shadowColor = b.neon;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = a * (0.5 + Math.sin(time * 0.003 + b.flicker * 10) * 0.3);
        for (let i = 0; i < 3; i++) {
          const rot = time * 0.003 + i * 2;
          ctx.beginPath();
          ctx.ellipse(hx, hy, 6 * z, 2 * z, rot, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = a;
      }
    },
  },
  {
    name: 'stadium', footprint: [4, 4], minH: 4, maxH: 6, weight: 0.08,
    zones: [ZONE.ENTERTAINMENT],
    tiers: [3, 4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx } = rc;
      const h = b.height * 4 * z;
      const cx = p.x;
      const cy = p.y + (2 * TH / 2 + 2 * TH / 2) * z;
      const rx = 4 * TW / 2 * z * 0.7;
      const ry = 4 * TH / 2 * z * 0.7;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 3, rx + 2, ry + 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a5a2a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.85, ry * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.palette.base;
      ctx.beginPath();
      ctx.ellipse(cx, cy - h, rx, ry, 0, 0, Math.PI * 2);
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2, true);
      ctx.fill();
      ctx.fillStyle = b.palette.dark;
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy);
      ctx.bezierCurveTo(cx - rx, cy + ry * 0.4, cx - rx, cy + ry, cx, cy + ry);
      ctx.lineTo(cx, cy + ry - h);
      ctx.bezierCurveTo(cx - rx, cy + ry - h, cx - rx, cy + ry * 0.4 - h, cx - rx, cy - h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(b.palette.light, 1.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy - h, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (day < 0.5 && z > 0.5) {
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2;
          const lx = cx + Math.cos(ang) * rx;
          const ly = cy + Math.sin(ang) * ry;
          ctx.fillStyle = '#FFFACC';
          ctx.shadowColor = '#FFFACC';
          ctx.shadowBlur = 18;
          ctx.fillRect(lx - 1, ly - h - 6 * z, 2, 3);
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = 'rgba(255,250,200,.14)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 0.85, ry * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    name: 'mall', footprint: [2, 2], minH: 3, maxH: 4, weight: 0.3,
    zones: [ZONE.MIXED, ZONE.RESIDENTIAL, ZONE.ENTERTAINMENT],
    tiers: [2, 3, 4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx, time } = rc;
      const g = drawBox(rc, p, 2, 2, b.height * 5, b.palette, z, a, day);
      const cx = (g.back.x + g.front.x) / 2;
      const cy = (g.back.y + g.front.y) / 2 - g.h;
      ctx.fillStyle = b.neon;
      ctx.globalAlpha = a * (0.8 + Math.sin(time * 0.004 + b.flicker * 3) * 0.2);
      ctx.shadowColor = b.neon;
      ctx.shadowBlur = 12 * z;
      ctx.fillRect(cx - 14 * z, cy - 8 * z, 28 * z, 5 * z);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.max(3, Math.floor(3.5 * z))}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('MALL', cx, cy - 4 * z);
    },
  },
  {
    name: 'hospital', footprint: [2, 2], minH: 5, maxH: 10, weight: 0.15,
    zones: [ZONE.MIXED, ZONE.RESIDENTIAL],
    tiers: [2, 3, 4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx } = rc;
      const palette = { base: '#c9d0d6', light: '#e0e4e8', dark: '#9097a0', tag: 'white' };
      const g = drawBox(rc, p, 2, 2, b.height * 4.5, palette, z, a, day);
      drawWindows(rc, g, palette, b.neon, b, z, a, { cols: 3, rows: 2 }, day);
      const cx = (g.back.x + g.front.x) / 2;
      const cy = (g.back.y + g.front.y) / 2 - g.h;
      ctx.fillStyle = '#ff3333';
      ctx.fillRect(cx - 3 * z, cy - 3 * z, 6 * z, 1.5 * z);
      ctx.fillRect(cx - 0.75 * z, cy - 5 * z, 1.5 * z, 4 * z);
      if (day < 0.5) {
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 10;
        ctx.fillRect(cx - 3 * z, cy - 3 * z, 6 * z, 1.5 * z);
        ctx.fillRect(cx - 0.75 * z, cy - 5 * z, 1.5 * z, 4 * z);
        ctx.shadowBlur = 0;
      }
    },
  },
  {
    name: 'church', footprint: [1, 1], minH: 4, maxH: 6, weight: 0.08,
    zones: [ZONE.RESIDENTIAL, ZONE.MIXED],
    tiers: [1, 2, 3, 4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx } = rc;
      const g = drawBox(rc, p, 1, 1, b.height * 4.5, b.palette, z, a, day);
      const cx = (g.back.x + g.front.x) / 2;
      const cy = (g.back.y + g.front.y) / 2 - g.h;
      ctx.fillStyle = shade(b.palette.base, 0.9);
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14 * z);
      ctx.lineTo(cx - 2 * z, cy);
      ctx.lineTo(cx + 2 * z, cy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14 * z);
      ctx.lineTo(cx, cy - 18 * z);
      ctx.moveTo(cx - 1.5 * z, cy - 16 * z);
      ctx.lineTo(cx + 1.5 * z, cy - 16 * z);
      ctx.stroke();
    },
  },
  {
    name: 'gas-station', footprint: [1, 1], minH: 1, maxH: 2, weight: 0.1,
    zones: [ZONE.MIXED, ZONE.RESIDENTIAL, ZONE.INDUSTRIAL],
    tiers: [0, 1, 2, 3, 4, 5],
    render(b, p, z, a, day, rc) {
      const { ctx } = rc;
      const g = drawBox(rc, p, 1, 1, b.height * 5, b.palette, z, a, day);
      const cx = (g.back.x + g.front.x) / 2;
      const cy = (g.back.y + g.front.y) / 2 - g.h;
      ctx.fillStyle = b.neon;
      ctx.globalAlpha = a * (day > 0.5 ? 0.5 : 0.9);
      ctx.shadowColor = b.neon;
      ctx.shadowBlur = 6 * z;
      ctx.fillRect(cx - 5 * z, cy - 1, 10 * z, 1.5 * z);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = a;
    },
  },
];
