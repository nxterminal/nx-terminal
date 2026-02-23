/**
 * comboDetector.js — Analyzes feed events and returns highlights to insert.
 *
 * @param {Array} events - [{dev_name, archetype, corporation, action_type, details, created_at, ...}]
 * @returns {Array} highlights - [{type, message, insertAfterIndex, level, meta}]
 *   type: 'streak' | 'rivalry' | 'world_event' | 'corp_clash'
 *   level: 1 (normal) | 2 (intense) | 3 (mega)
 */

const POSITIVE_ACTIONS = new Set([
  'create_protocol', 'CREATE_PROTOCOL',
  'create_ai', 'CREATE_AI',
  'invest', 'INVEST',
]);

const AGGRESSIVE_ACTIONS = new Set([
  'sabotage', 'SABOTAGE',
  'hack', 'HACK',
  'fork', 'FORK',
]);

function getCorporation(item) {
  if (item.corporation) return item.corporation.replace(/_/g, ' ');
  const d = typeof item.details === 'object' && item.details !== null ? item.details : {};
  return d.corporation || null;
}

function getTargetCorp(item) {
  const d = typeof item.details === 'object' && item.details !== null ? item.details : {};
  return (d.target_corporation || d.target_corp || '').replace(/_/g, ' ') || null;
}

function getTargetDev(item) {
  const d = typeof item.details === 'object' && item.details !== null ? item.details : {};
  return d.target_dev || d.target || null;
}

function formatAction(type) {
  const t = (type || '').toUpperCase();
  if (t === 'CREATE_PROTOCOL') return 'protocols';
  if (t === 'CREATE_AI') return 'AIs';
  if (t === 'INVEST') return 'investments';
  return 'actions';
}

export function detectCombos(events) {
  const highlights = [];
  if (!events || events.length < 2) return highlights;

  // Work on the most recent events (newest last)
  const recent = events.slice(-30);

  // 1. STREAK DETECTION
  // Group consecutive positive actions by dev_name (scanning newest to oldest)
  const streakMap = {}; // dev_name -> { count, actionType, lastIndex }
  for (let i = recent.length - 1; i >= Math.max(0, recent.length - 15); i--) {
    const item = recent[i];
    if (!item.dev_name || !POSITIVE_ACTIONS.has(item.action_type)) continue;

    const key = item.dev_name;
    if (!streakMap[key]) {
      streakMap[key] = { count: 1, actionType: item.action_type, lastIndex: i, archetype: item.archetype };
    } else if (streakMap[key].actionType.toUpperCase() === (item.action_type || '').toUpperCase()) {
      streakMap[key].count++;
    }
  }

  for (const [dev, info] of Object.entries(streakMap)) {
    if (info.count >= 2) {
      const level = info.count >= 3 ? 2 : 1;
      const label = formatAction(info.actionType);
      const archetype = info.archetype ? ` (${info.archetype.replace(/_/g, ' ')})` : '';
      highlights.push({
        type: 'streak',
        level,
        message: level >= 2
          ? `SHIPPING STREAK x${info.count}! ${dev}${archetype} -- ${info.count} ${label} in rapid succession`
          : `STREAK x${info.count}! ${dev}${archetype} -- ${info.count} ${label} and counting`,
        insertAfterIndex: events.length - (recent.length - info.lastIndex),
      });
    }
  }

  // 2. RIVALRY DETECTION
  // Track pairs of devs with aggressive interactions in last 20 events
  const pairCounts = {};
  const last20 = events.slice(-20);
  for (let i = 0; i < last20.length; i++) {
    const item = last20[i];
    if (!AGGRESSIVE_ACTIONS.has(item.action_type)) continue;
    const target = getTargetDev(item);
    if (!target || !item.dev_name || target === item.dev_name) continue;

    const pair = [item.dev_name, target].sort().join(' vs ');
    if (!pairCounts[pair]) {
      pairCounts[pair] = { count: 0, lastIndex: 0, dev1: item.dev_name, dev2: target };
    }
    pairCounts[pair].count++;
    pairCounts[pair].lastIndex = events.length - (last20.length - i);
  }

  for (const [pair, info] of Object.entries(pairCounts)) {
    if (info.count >= 3) {
      highlights.push({
        type: 'rivalry',
        level: info.count >= 5 ? 2 : 1,
        message: `RIVALRY DETECTED! ${info.dev1} vs ${info.dev2} -- ${info.count} clashes today`,
        insertAfterIndex: info.lastIndex,
      });
    }
  }

  // 3. WORLD EVENT DETECTION
  for (let i = 0; i < events.length; i++) {
    const item = events[i];
    const type = (item.action_type || '').toLowerCase();
    if (type.includes('world_event') || type.includes('event') && !type.includes('invest')) {
      if (type === 'world_event' || type === 'event') {
        const d = typeof item.details === 'object' ? item.details : {};
        const title = d.title || d.name || d.event || 'Unknown Event';
        const desc = d.description || d.message || '';
        highlights.push({
          type: 'world_event',
          level: 1,
          message: `WORLD EVENT: ${title}${desc ? ' -- ' + desc : ''}`,
          insertAfterIndex: i,
        });
      }
    }
  }

  // 4. CORPORATE CLASH DETECTION
  const last15 = events.slice(-15);
  for (let i = 0; i < last15.length; i++) {
    const item = last15[i];
    if (!AGGRESSIVE_ACTIONS.has(item.action_type)) continue;

    const attackerCorp = getCorporation(item);
    const targetCorp = getTargetCorp(item);

    if (attackerCorp && targetCorp && attackerCorp !== targetCorp) {
      const action = (item.action_type || '').toLowerCase();
      highlights.push({
        type: 'corp_clash',
        level: 1,
        message: `CORPORATE CLASH: ${attackerCorp} vs ${targetCorp} -- ${item.dev_name} ${action}d against the enemy`,
        insertAfterIndex: events.length - (last15.length - i),
      });
    }
  }

  // Deduplicate: only keep the most recent highlight per type+dev combo
  const seen = new Set();
  const deduped = [];
  for (const h of highlights.reverse()) {
    const key = `${h.type}:${h.message.slice(0, 40)}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(h);
    }
  }

  return deduped.reverse();
}
