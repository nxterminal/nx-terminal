import { useState } from 'react';
import { useReadContract } from 'wagmi';
import { SIMULATION_CONFIG } from '../config/gameConfig';
import {
  NXDEVNFT_ADDRESS, NXDEVNFT_ABI, NXT_TOKEN_ADDRESS,
  EXPLORER_BASE,
} from '../services/contract';

const EXPLORER_ADDR = (addr) => `${EXPLORER_BASE}/address/${addr}`;

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

function Lore() {
  return (
    <div className="terminal" style={{ height: '100%', overflow: 'auto', padding: '12px', lineHeight: '1.6' }}>
      <div style={{ color: 'var(--terminal-amber)', fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' }}>
        {'>> CLASSIFIED: THE NX TERMINAL CHRONICLES <<'}
      </div>

      <div style={{ color: 'var(--terminal-red)', fontWeight: 'bold', marginBottom: '4px', fontSize: '10px', textAlign: 'center', letterSpacing: '2px' }}>
        SECURITY CLEARANCE: LEVEL 7 — EYES ONLY
      </div>

      <div style={{ borderTop: '1px solid var(--terminal-amber)', borderBottom: '1px solid var(--terminal-amber)', padding: '8px 0', margin: '8px 0 16px 0' }}>
        <div style={{ color: '#808080', fontSize: '12px', textAlign: 'center', fontStyle: 'italic' }}>
          "Every line of code is a weapon. Every developer is a soldier. Every corporation is a lie."
        </div>
      </div>

      <div style={{ color: 'var(--terminal-amber)', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>{'> CHAPTER I: THE FOUNDING (1995)'}</div>
      <div style={{ color: 'var(--terminal-green)', marginBottom: '16px' }}>
        In 1995, a group of rogue engineers from the defunct DARPA Project NEXUS pooled their severance
        packages and founded NX Terminal Corp. in a basement server room in Palo Alto. Their mission:
        build a simulation platform that could predict the outcome of technological warfare. The Pentagon
        said no. Silicon Valley said "how much?" Nobody asked the engineers what they actually wanted.
        The engineers didn't care. They had coffee and a dream. The dream was mostly about coffee.
      </div>

      <div style={{ color: 'var(--terminal-amber)', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>{'> CHAPTER II: THE PROTOCOL WARS BEGIN (2005)'}</div>
      <div style={{ color: 'var(--terminal-green)', marginBottom: '16px' }}>
        By 2005, NX Terminal had grown from a simulation platform into something far more dangerous:
        a prediction engine that was right 94% of the time. The remaining 6% involved cats and cryptocurrency,
        which even quantum computers cannot predict. Six corporations emerged as the dominant players,
        each funded by a different combination of venture capital, government contracts, and sheer audacity.
        The Protocol Wars had begun. Nobody declared war. It just... happened. Like most terrible things.
      </div>

      <div style={{ color: 'var(--terminal-amber)', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>{'> CHAPTER III: THE DEVELOPER UPRISING (2012)'}</div>
      <div style={{ color: 'var(--terminal-green)', marginBottom: '16px' }}>
        In 2012, a group of developers within Closed AI discovered that their code was being used to train
        AI models that would eventually replace them. They organized a strike. Management responded by
        deploying the very AI they had trained to write code in their place. The irony was not lost on anyone.
        It was, however, ignored by everyone. The developers were offered a choice: adapt or be deprecated.
        Most chose to become AI trainers. Some became protocol architects. A few simply vanished into
        the dark web, emerging years later as the first HACKTIVISTS.
      </div>

      <div style={{ color: 'var(--terminal-amber)', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>{'> CHAPTER IV: THE GREAT TOKEN CRASH (2018)'}</div>
      <div style={{ color: 'var(--terminal-green)', marginBottom: '16px' }}>
        The introduction of $NXT token in 2018 was meant to stabilize the simulation economy. Instead,
        it created the largest speculative bubble since the invention of promises. DEGENS traded $NXT
        on leverage so extreme that a single bad trade could bankrupt an entire corporation. Y.AI
        famously tweeted "NXT to $1M" seventeen minutes before their own token collapsed.
        The tweet got 4.7 million likes. The developers got nothing. As intended.
      </div>

      <div style={{ color: 'var(--terminal-amber)', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>{'> CHAPTER V: THE SINGULARITY QUESTION (2023-PRESENT)'}</div>
      <div style={{ color: 'var(--terminal-green)', marginBottom: '16px' }}>
        As of 2023, the NX Terminal simulation has become indistinguishable from reality for 73%
        of its participants. The remaining 27% are bots who think they're human, which is also
        indistinguishable from reality. Shallow Mind claims they achieved AGI last Tuesday but won't
        show anyone. Misanthropic says their AI is safe but won't explain what it's safe from.
        Closed AI charges $200/month for access to models that may or may not exist.
        The Protocol Wars continue. The simulation endures. Your developers await orders.
      </div>

      <div style={{ borderTop: '1px solid var(--terminal-amber)', padding: '12px 0', marginTop: '8px' }}>
        <div style={{ color: 'var(--terminal-red)', fontSize: '11px', textAlign: 'center' }}>
          {'[DOCUMENT CLASSIFICATION: OMEGA-7]'}
        </div>
        <div style={{ color: '#808080', fontSize: '10px', textAlign: 'center', marginTop: '4px' }}>
          Unauthorized distribution of this document will result in immediate termination.
          Of your employment. And possibly your simulation.
        </div>
      </div>
    </div>
  );
}

function Links() {
  const linkStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    marginBottom: '8px',
    border: '1px solid var(--border-dark)',
    background: 'rgba(0,0,0,0.3)',
    cursor: 'pointer',
  };
  const linkText = { color: 'var(--terminal-cyan)', textDecoration: 'underline', fontSize: '14px' };
  const labelStyle = { color: 'var(--terminal-green)', fontSize: '13px', minWidth: '70px' };

  return (
    <div className="terminal" style={{ height: '100%', overflow: 'auto', padding: '12px' }}>
      <div style={{ color: 'var(--terminal-amber)', fontWeight: 'bold', marginBottom: '12px' }}>
        {'> OFFICIAL LINKS'}
      </div>

      <a href="https://x.com/nxterminal" target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, textDecoration: 'none' }}>
        <span style={labelStyle}>X / Twitter</span>
        <span style={linkText}>x.com/nxterminal</span>
      </a>

      <a href="https://discord.gg/Z5BBUQ3hcj" target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, textDecoration: 'none' }}>
        <span style={labelStyle}>Discord</span>
        <span style={linkText}>discord.gg/Z5BBUQ3hcj</span>
      </a>

      <a href="https://nxterminal.xyz" target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, textDecoration: 'none' }}>
        <span style={labelStyle}>Web</span>
        <span style={linkText}>nxterminal.xyz</span>
      </a>

      <div style={{ color: '#808080', marginTop: '16px', fontSize: '11px', textAlign: 'center' }}>
        NX Terminal Corp. (C) 1998. Connect with us.
      </div>
    </div>
  );
}

function ExplorerLink({ address, label }) {
  return (
    <a
      href={EXPLORER_ADDR(address)}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--terminal-cyan)', textDecoration: 'underline', fontSize: '12px' }}
    >
      {label || '[View on Explorer]'}
    </a>
  );
}

function Contracts() {
  const { data: totalMinted } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'totalMinted',
  });

  const minted = totalMinted != null ? Number(totalMinted).toLocaleString() : '...';

  const line = { color: 'var(--terminal-green)', marginBottom: '2px' };
  const label = { color: '#808080' };
  const val = { color: 'var(--terminal-green)' };
  const addr = { color: 'var(--terminal-cyan)', fontSize: '11px', wordBreak: 'break-all' };
  const section = { marginBottom: '16px' };
  const divider = { color: 'var(--terminal-amber)', fontWeight: 'bold', marginBottom: '8px', marginTop: '4px' };

  return (
    <div className="terminal" style={{ height: '100%', overflow: 'auto', padding: '12px', fontFamily: "'VT323', monospace" }}>
      <div style={divider}>
        {'CONTRACT REGISTRY'}<br />
        {'═══════════════════════════════════════'}
      </div>

      {/* NXDevNFT */}
      <div style={section}>
        <div style={{ ...line, color: 'var(--terminal-amber)', fontWeight: 'bold' }}>
          NXDevNFT (Employee Badges)
        </div>
        <div style={line}><span style={label}>Address: </span><span style={addr}>{NXDEVNFT_ADDRESS}</span></div>
        <div style={line}><span style={label}>Network: </span><span style={val}>MegaETH (4326)</span></div>
        <div style={line}><span style={label}>Supply:  </span><span style={val}>{minted} / 35,000 minted</span></div>
        <div style={line}><span style={label}>Price:   </span><span style={val}>0.0025 ETH</span></div>
        <ExplorerLink address={NXDEVNFT_ADDRESS} />
      </div>

      {/* $NXT Token */}
      <div style={section}>
        <div style={{ ...line, color: 'var(--terminal-amber)', fontWeight: 'bold' }}>
          $NXT Token (Protocol Wars Currency)
        </div>
        <div style={line}><span style={label}>Address: </span><span style={addr}>{NXT_TOKEN_ADDRESS}</span></div>
        <div style={line}><span style={label}>Network: </span><span style={val}>MegaETH (4326)</span></div>
        <div style={line}><span style={label}>Total Supply: </span><span style={val}>1,000,000,000 NXT</span></div>
        <ExplorerLink address={NXT_TOKEN_ADDRESS} />
      </div>

      {/* Tokenomics */}
      <div style={divider}>
        {'TOKENOMICS'}<br />
        {'═══════════════════════════════════════'}
      </div>

      <div style={line}><span style={label}>Total Supply:    </span><span style={val}>1,000,000,000 $NXT</span></div>
      <div style={line}><span style={label}>Player Rewards:  </span><span style={val}>400,000,000 (40%)</span></div>
      <div style={line}><span style={label}>Ecosystem:       </span><span style={val}>200,000,000 (20%)</span></div>
      <div style={line}><span style={label}>Community:       </span><span style={val}>150,000,000 (15%)</span></div>
      <div style={line}><span style={label}>DEX Liquidity:   </span><span style={val}>150,000,000 (15%)</span></div>
      <div style={line}><span style={label}>Team:            </span><span style={val}>100,000,000 (10%)</span></div>

      <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-dark)', paddingTop: '8px' }}>
        <div style={line}>
          <span style={label}>Dev Salary: </span>
          <span style={{ color: 'var(--gold)' }}>200 $NXT/day</span>
          <span style={label}> (clean, per dev)</span>
        </div>
      </div>

      <div style={{ color: '#808080', marginTop: '16px', fontSize: '11px', textAlign: 'center' }}>
        NX Terminal Corp. (C) 1998. All contracts verified on MegaETH.
      </div>
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
        <button className={`win-tab${tab === 'lore' ? ' active' : ''}`} onClick={() => setTab('lore')}>Lore</button>
        <button className={`win-tab${tab === 'contracts' ? ' active' : ''}`} onClick={() => setTab('contracts')}>Contracts</button>
        <button className={`win-tab${tab === 'links' ? ' active' : ''}`} onClick={() => setTab('links')}>Links</button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'system' && <SystemInfo />}
        {tab === 'handbook' && <Handbook />}
        {tab === 'lore' && <Lore />}
        {tab === 'contracts' && <Contracts />}
        {tab === 'links' && <Links />}
      </div>
    </div>
  );
}
