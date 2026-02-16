import { useState } from 'react';

const SECTIONS = [
  { title: 'Welcome', content: `WELCOME TO NX TERMINAL
======================

Congratulations on your appointment as an NX Terminal Operator.

This handbook contains everything you need to know about managing your devs, navigating the Protocol Wars, and maximizing your $NXT earnings.

Read carefully. Knowledge is power. Ignorance is expensive.` },
  { title: 'Archetypes', content: `DEV ARCHETYPES
==============

Each dev has a unique archetype that determines their behavior:

• 10X_DEV (Red) - Elite coders. High output, high maintenance.
• GRINDER (Blue) - Consistent workers. Reliable but slow to level.
• DEGEN (Gold) - Risk takers. High reward or total loss.
• LURKER (Gray) - Silent operators. Gather intel, rarely act.
• INFLUENCER (Magenta) - Social butterflies. Boost morale, pump tokens.
• HACKTIVIST (Green) - Idealists. Will hack for "the cause."
• FED (Orange) - Undercover agents. Trust at your own risk.
• SCRIPT_KIDDIE (Cyan) - Copy-paste warriors. Cheap but unreliable.

Choose wisely. Your archetype mix defines your strategy.` },
  { title: 'Protocols', content: `PROTOCOL WARS
=============

Protocols are the battleground. Your devs compete to:

1. CREATE protocols - Build new blockchain projects
2. INVEST in protocols - Back promising projects for returns
3. HACK protocols - Exploit vulnerabilities for profit
4. TRADE protocol tokens - Buy low, sell high (or vice versa)

Protocol Value is determined by:
- Code Quality (higher = more stable)
- Investor Count (more investors = more liquidity)
- Dev Activity (active development = growth)

WARNING: Protocols can be rugged. Monitor your investments.` },
  { title: 'Economy', content: `THE $NXT ECONOMY
================

$NXT is the native currency of the NX Terminal network.

Earning $NXT:
• Collect Salary - Regular payments based on dev count and level
• Trading - Buy/sell protocol tokens
• Investments - Earn dividends from successful protocols
• Bounties - Complete special missions

Spending $NXT:
• Hire new devs
• Buy items from the Shop
• Invest in protocols
• Boost dev energy

Remember: The house always wins. Plan accordingly.` },
  { title: 'Rules', content: `RULES OF ENGAGEMENT
===================

1. Your devs act autonomously. You cannot directly control them.
2. Salary must be collected manually each cycle.
3. Energy depletes over time. Use items to restore it.
4. Dead devs cannot be revived. (They can die??)
5. The FED is always watching.
6. There are no refunds.
7. What happens in Protocol Wars stays in Protocol Wars.
8. Rule 8 has been [REDACTED].
9. Trust no one. Especially DEGEN-class devs.
10. Have fun. (This is not optional.)

Violation of these rules may result in [DATA EXPUNGED].` },
];

export default function EmployeeHandbook() {
  const [sectionIdx, setSectionIdx] = useState(0);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: '140px', background: 'var(--win-bg)', borderRight: '1px solid var(--border-dark)', overflow: 'auto', flexShrink: 0 }}>
        {SECTIONS.map((s, i) => (
          <div key={i} onClick={() => setSectionIdx(i)}
            style={{
              padding: '6px 8px', fontSize: '11px', cursor: 'pointer',
              background: i === sectionIdx ? 'var(--selection)' : 'transparent',
              color: i === sectionIdx ? 'var(--selection-text)' : '#000',
              borderBottom: '1px solid var(--border-dark)',
            }}>
            📖 {s.title}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px', background: '#fff', fontFamily: "'Courier New', monospace", fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
        {SECTIONS[sectionIdx].content}
      </div>
    </div>
  );
}
