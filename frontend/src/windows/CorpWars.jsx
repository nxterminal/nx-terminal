import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import CorpBar from '../components/CorpBar';
import TerritoryMap, { LOCATIONS } from '../components/TerritoryMap';

const CORP_COLORS = {
  'Closed AI':        { primary: '#ffaa00', gradient: ['#664400', '#aa7700'] },
  'Closed_AI':        { primary: '#ffaa00', gradient: ['#664400', '#aa7700'] },
  'Misanthropic':     { primary: '#33ff33', gradient: ['#003300', '#006600'] },
  'Shallow Mind':     { primary: '#4488ff', gradient: ['#002244', '#004488'] },
  'Shallow_Mind':     { primary: '#4488ff', gradient: ['#002244', '#004488'] },
  'Zuck Labs':        { primary: '#00ffff', gradient: ['#003344', '#006688'] },
  'Zuck_Labs':        { primary: '#00ffff', gradient: ['#003344', '#006688'] },
  'Y.AI':             { primary: '#ff4444', gradient: ['#440000', '#880000'] },
  'Y_AI':             { primary: '#ff4444', gradient: ['#440000', '#880000'] },
  'Mistrial Systems': { primary: '#66ddaa', gradient: ['#003322', '#006644'] },
  'Mistrial_Systems': { primary: '#66ddaa', gradient: ['#003322', '#006644'] },
};

function getCorpStyle(name) {
  const normalized = (name || '').replace(/_/g, ' ');
  return CORP_COLORS[name] || CORP_COLORS[normalized] || { primary: '#888', gradient: ['#333', '#555'] };
}

function formatCorpName(name) {
  return (name || '').replace(/_/g, ' ');
}

function formatTime(dateStr) {
  if (!dateStr) return '??:??';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

export default function CorpWars() {
  const [corpData, setCorpData] = useState([]);
  const [devs, setDevs] = useState([]);
  const [feedData, setFeedData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = () => {
    Promise.all([
      api.getCorpLeaderboard().catch(() => []),
      api.getDevs({ limit: 200 }).catch(() => []),
      api.getFeed(100).catch(() => []),
    ]).then(([corps, devsResult, feed]) => {
      setCorpData(Array.isArray(corps) ? corps : corps.corporations || []);
      const devList = Array.isArray(devsResult) ? devsResult : (devsResult.devs || []);
      setDevs(devList);
      setFeedData(Array.isArray(feed) ? feed : (feed.feed || feed.actions || []));
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30000);
    return () => clearInterval(id);
  }, []);

  // Calculate dominance scores
  const dominanceData = useMemo(() => {
    if (corpData.length === 0) return [];

    const scored = corpData.map(c => {
      const balance = Number(c.total_balance || 0);
      const protocols = Number(c.total_protocols || 0);
      const reputation = Number(c.avg_reputation || 0);
      const score = balance * 0.4 + protocols * 100 * 0.3 + reputation * 10 * 0.3;
      return { ...c, score, name: formatCorpName(c.corporation || c.name) };
    });

    scored.sort((a, b) => b.score - a.score);
    const maxScore = scored[0]?.score || 1;

    return scored.map((c, i) => ({
      ...c,
      percentage: (c.score / maxScore) * 100,
      rank: i + 1,
      style: getCorpStyle(c.corporation || c.name),
    }));
  }, [corpData]);

  // Calculate territory control
  const territories = useMemo(() => {
    if (devs.length === 0) {
      return LOCATIONS.map(loc => ({
        location: loc.id,
        name: loc.name,
        controller: 'NEUTRAL',
        contested: false,
        color: '#555',
      }));
    }

    return LOCATIONS.map(loc => {
      // Count devs per corporation at this location
      const corpCounts = {};
      for (const dev of devs) {
        const devLoc = (dev.location || '').toLowerCase().replace(/\s+/g, '_');
        const locId = loc.id.toLowerCase();
        const locName = loc.name.toLowerCase().replace(/\s+/g, '_');
        if (devLoc === locId || devLoc === locName) {
          const corp = formatCorpName(dev.corporation);
          corpCounts[corp] = (corpCounts[corp] || 0) + 1;
        }
      }

      const sorted = Object.entries(corpCounts).sort((a, b) => b[1] - a[1]);

      if (sorted.length === 0) {
        return { location: loc.id, name: loc.name, controller: 'NEUTRAL', contested: false, color: '#555' };
      }

      const top = sorted[0];
      const second = sorted[1];
      const contested = second && (top[1] - second[1] < 3);

      return {
        location: loc.id,
        name: loc.name,
        controller: contested ? 'CONTESTED' : top[0],
        contested,
        color: contested ? '#ff4444' : getCorpStyle(top[0]).primary,
      };
    });
  }, [devs]);

  // Filter feed for corporate actions
  const corpFeed = useMemo(() => {
    return feedData
      .filter(item => {
        const type = (item.action_type || '').toUpperCase();
        return ['INVEST', 'SELL', 'CREATE_PROTOCOL', 'CREATE_AI', 'SABOTAGE', 'HACK', 'FORK'].includes(type);
      })
      .slice(-15)
      .reverse();
  }, [feedData]);

  if (loading) {
    return <div className="loading">Loading corporate intelligence...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', background: '#0c0c0c' }}>
      {/* DOMINANCE SECTION */}
      <div className="corp-section-title">
        {'\u25B8'} CORPORATE DOMINANCE
      </div>

      {dominanceData.length === 0 ? (
        <div style={{ padding: '8px 12px', color: '#555', fontFamily: "'VT323', monospace", fontSize: '14px' }}>
          {'>'} No corporations active yet. Awaiting dev deployment...
        </div>
      ) : (
        dominanceData.map((corp, i) => (
          <CorpBar
            key={i}
            name={corp.name}
            color={corp.style.primary}
            gradient={corp.style.gradient}
            percentage={corp.percentage}
            rank={corp.rank}
          />
        ))
      )}

      {/* TERRITORY SECTION */}
      <div className="corp-section-title" style={{ marginTop: '8px' }}>
        {'\u25B8'} TERRITORY CONTROL
      </div>
      <TerritoryMap territories={territories} />

      {/* CORPORATE FEED */}
      <div className="corp-section-title" style={{ marginTop: '8px' }}>
        {'\u25B8'} RECENT CORPORATE ACTIONS
      </div>
      <div className="corp-feed" style={{ margin: '0 8px 8px', flex: '1 1 auto' }}>
        {corpFeed.length === 0 ? (
          <div style={{ color: '#555' }}>{'>'} No corporate activity detected...</div>
        ) : (
          corpFeed.map((item, i) => {
            const d = typeof item.details === 'object' && item.details !== null ? item.details : {};
            const corp = formatCorpName(item.corporation || d.corporation || '');
            const corpStyle = getCorpStyle(item.corporation || d.corporation || '');
            const action = (item.action_type || '').toUpperCase();
            const detail = d.name || d.protocol_name || d.target || '';

            let actionText = action.toLowerCase().replace(/_/g, ' ');
            if (action === 'CREATE_PROTOCOL') actionText = `created protocol "${detail}"`;
            else if (action === 'CREATE_AI') actionText = `built AI "${detail}"`;
            else if (action === 'INVEST') actionText = `invested ${d.amount || '???'} $NXT in ${detail}`;
            else if (action === 'SELL') actionText = `sold stake in ${detail}`;

            return (
              <div key={i} className="corp-feed-line">
                <span style={{ color: '#888' }}>[{formatTime(item.created_at)}]</span>{' '}
                <span style={{ color: corpStyle.primary }}>{corp || '???'}</span>:{' '}
                <span style={{ color: '#33ff33' }}>{item.dev_name || '???'}</span>{' '}
                <span style={{ color: '#aaa' }}>{actionText}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
