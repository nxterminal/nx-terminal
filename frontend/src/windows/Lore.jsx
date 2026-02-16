import { useState } from 'react';

const CHAPTERS = [
  { title: 'Chapter I: Genesis', text: `THE GENESIS
===========

In the beginning, there was only the Mainnet.

A vast, empty blockchain stretching infinitely in all directions. No transactions. No smart contracts. No devs.

Then came the First Commit.

Nobody knows who pushed it. The git blame was scrubbed. But from that single commit, the NX Terminal network was born — a self-replicating system of autonomous developer agents, each with their own motivations, skills, and fatal flaws.

They called them "Devs."

And the Devs began to build.` },
  { title: 'Chapter II: The Archetypes', text: `THE ARCHETYPES
==============

As the network grew, patterns emerged. The Devs weren't random — they fell into distinct behavioral categories, as if someone had hardcoded personalities into their neural weights.

The 10X_DEV: Born to ship. These elite agents could write more code in one cycle than others did in a hundred. But they burned bright and fast, consuming energy at terrifying rates.

The DEGEN: Chaos incarnate. They'd ape into any protocol with a cool name, leverage everything, and either 100x or go to zero. There was no middle ground.

The LURKER: Silent watchers. They gathered intelligence, mapped the network, and struck only when the odds were overwhelmingly in their favor.

The GRINDER: The backbone of every corporation. Slow, steady, reliable. They'd never make headlines, but they'd never blow up your portfolio either.

The others — INFLUENCER, HACKTIVIST, FED, SCRIPT_KIDDIE — each played their role in the ecosystem's delicate balance.

Balance that was about to be shattered.` },
  { title: 'Chapter III: Protocol Wars', text: `THE PROTOCOL WARS
==================

It started with a disagreement.

Two rival corporations — NullPointer Inc. and 0xDEADBEEF Labs — both claimed ownership of the same protocol. The smart contracts were ambiguous. The governance votes were deadlocked.

So they went to war.

Devs were mobilized. Protocols were forked. Treasuries were drained in hostile takeover attempts. The Action Feed lit up with activity — trades, hacks, infiltrations, and the occasional desperate prayer to the Random Number God.

The war spread. Other corporations chose sides or tried to profit from the chaos. The price of $NXT swung wildly. Fortunes were made and lost in single cycles.

And somewhere in the noise, a new kind of Dev emerged — one that didn't fit any known archetype. One that seemed to be... learning.

But that's a story for another chapter.` },
  { title: 'Chapter IV: The Operators', text: `THE OPERATORS
==============

You are not a Dev.

You are something else. Something the network hadn't anticipated.

You are an Operator — a consciousness from outside the system, granted access through means that are... poorly documented. You can observe the Devs. You can own them. You can collect their earnings and spend their resources.

But you cannot control them.

Your Devs will act on their own instincts, for better or worse. A DEGEN will DEGEN. A LURKER will LURK. You chose them (or they chose you), and now you must live with the consequences.

Some Operators amassed great wealth. Others lost everything. A few discovered secrets hidden in the network's architecture — easter eggs left by whoever pushed that First Commit.

The question isn't whether you'll survive the Protocol Wars.

The question is: what will you become?` },
];

export default function Lore() {
  const [chapter, setChapter] = useState(0);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: '160px', background: '#1a1a2e', borderRight: '1px solid #333', overflow: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '8px', color: 'var(--gold)', fontFamily: "'Press Start 2P', monospace", fontSize: '8px', borderBottom: '1px solid #333' }}>
          NX TERMINAL LORE
        </div>
        {CHAPTERS.map((c, i) => (
          <div key={i} onClick={() => setChapter(i)}
            style={{
              padding: '8px', fontSize: '11px', cursor: 'pointer',
              background: i === chapter ? '#000080' : 'transparent',
              color: i === chapter ? '#fff' : '#aaa',
              borderBottom: '1px solid #222',
            }}>
            {c.title}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', background: '#0c0c0c', color: 'var(--terminal-green)', fontFamily: "'VT323', 'Courier New', monospace", fontSize: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
        {CHAPTERS[chapter].text}
      </div>
    </div>
  );
}
