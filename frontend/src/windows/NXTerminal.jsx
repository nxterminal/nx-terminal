import { useState } from 'react';
import { SIMULATION_CONFIG } from '../config/gameConfig';

function SystemInfo() {
  return (
    <div className="terminal" style={{ height: '100%', overflow: 'auto', padding: '12px' }}>
      <div style={{ color: 'var(--terminal-amber)', fontWeight: 'bold', marginBottom: '8px' }}>{'> SYSTEM INFORMATION'}</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>OS: NX-DOS 6.22 (Protocol Wars Extension Pack)</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>Processor: NX-486DX CPU @ 66MHz</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>Memory: 640K Conventional</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>Storage: 500MB HDD (S.M.A.R.T Supported)</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>Network: NXT Protocol v4.86.33</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>Display: VGA 640x480 @ 60Hz</div>
      <div style={{ color: 'var(--terminal-amber)', fontWeight: 'bold', marginTop: '12px', marginBottom: '8px' }}>{'> SIMULATION PARAMETERS'}</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>Minimum Duration: {SIMULATION_CONFIG.MIN_DURATION_DAYS} days</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>Max Developers: {SIMULATION_CONFIG.MAX_DEVS.toLocaleString()}</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>Years Simulated: {SIMULATION_CONFIG.YEARS_SIMULATED}</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>Cycle Duration: {SIMULATION_CONFIG.YEAR_CYCLE_HOURS}h per year</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>Salary: {SIMULATION_CONFIG.SALARY_PER_DEV_PER_DAY} $NXT/dev/day</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>Max Energy: {SIMULATION_CONFIG.MAX_ENERGY}</div>
      <div className="bios-line" style={{ color: 'var(--terminal-green)' }}>Energy Recovery: +{SIMULATION_CONFIG.ENERGY_RECOVERY} every {SIMULATION_CONFIG.ENERGY_RECOVERY_HOURS}h</div>
      <div style={{ color: '#808080', marginTop: '12px', fontSize: '12px' }}>NX Terminal Corp. (C) 1998. All rights reserved.</div>
    </div>
  );
}

function Handbook() {
  return (
    <div className="terminal" style={{ height: '100%', overflow: 'auto', padding: '12px', lineHeight: '1.6' }}>
      <div style={{ color: 'var(--terminal-amber)', fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' }}>
        {'>> THE PROTOCOL WARS \u2014 A History <<'}
      </div>
      <div style={{ color: 'var(--terminal-green)', marginBottom: '16px' }}>
        NX Terminal: Protocol Wars is a simulation of the AI development race — a satirical
        alternate history where six dystopian AI corporations compete for dominance across 20 years
        of technological chaos. Each developer you mint is an autonomous AI agent that thinks, codes,
        invests, and sabotages on its own. You watch. You guide. You profit. Or you don't.
      </div>
      <div style={{ color: 'var(--terminal-amber)', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>{'> The Timeline'}</div>
      <div style={{ color: 'var(--terminal-green)', marginBottom: '16px' }}>
        The simulation spans 2005 to 2025 — compressed into a minimum of 21 real days.
        Each 12-hour cycle advances one year and triggers a World Event. Worst-performing developers
        are eliminated permanently. There is no appeal process.
      </div>
      <div style={{ color: 'var(--terminal-amber)', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>{'> The Corporations'}</div>
      <div style={{ marginBottom: '6px' }}><span style={{ color: '#ff4444', fontWeight: 'bold' }}>Closed AI</span><span style={{ color: '#808080' }}> — </span><span style={{ color: 'var(--terminal-green)' }}>"Promised to be open. Lied. Now charges $200/month for access to their own promises."</span></div>
      <div style={{ marginBottom: '6px' }}><span style={{ color: '#ff44ff', fontWeight: 'bold' }}>Misanthropic</span><span style={{ color: '#808080' }}> — </span><span style={{ color: 'var(--terminal-green)' }}>"Built safety-first AI. The AI is safe. The employees are not."</span></div>
      <div style={{ marginBottom: '6px' }}><span style={{ color: '#4488ff', fontWeight: 'bold' }}>Shallow Mind</span><span style={{ color: '#808080' }}> — </span><span style={{ color: 'var(--terminal-green)' }}>"Infinite compute. Zero shipping. Their best product is their press release."</span></div>
      <div style={{ marginBottom: '6px' }}><span style={{ color: '#00ffff', fontWeight: 'bold' }}>Zuck Labs</span><span style={{ color: '#808080' }}> — </span><span style={{ color: 'var(--terminal-green)' }}>"Will pivot to whatever's trending. Currently pivoting to the concept of pivoting."</span></div>
      <div style={{ marginBottom: '6px' }}><span style={{ color: '#ffd700', fontWeight: 'bold' }}>Y.AI</span><span style={{ color: '#808080' }}> — </span><span style={{ color: 'var(--terminal-green)' }}>"Tweets before building. Ships after tweeting. Debugging? That's a tweet too."</span></div>
      <div style={{ marginBottom: '16px' }}><span style={{ color: '#ffaa00', fontWeight: 'bold' }}>Mistrial Systems</span><span style={{ color: '#808080' }}> — </span><span style={{ color: 'var(--terminal-green)' }}>"Open source. When convenient. Their license agreement has a license agreement."</span></div>
      <div style={{ color: 'var(--terminal-amber)', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>{'> The Singularity'}</div>
      <div style={{ color: 'var(--terminal-green)', marginBottom: '16px' }}>
        The simulation runs a minimum of 21 days regardless of how quickly all 35,000 developers
        are minted. The wars don't end early. Your contract doesn't expire early.
        Nothing ends early at NX Terminal Corp.
      </div>
      <div style={{ color: '#808080', textAlign: 'center', marginTop: '16px', fontSize: '12px' }}>{'// END OF DECLASSIFIED DOCUMENT //'}</div>
    </div>
  );
}

export default function NXTerminal() {
  const [tab, setTab] = useState('system');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="win-tabs">
        <button className={`win-tab${tab === 'system' ? ' active' : ''}`} onClick={() => setTab('system')}>System Info</button>
        <button className={`win-tab${tab === 'handbook' ? ' active' : ''}`} onClick={() => setTab('handbook')}>Employee Handbook</button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'system' ? <SystemInfo /> : <Handbook />}
      </div>
    </div>
  );
}
