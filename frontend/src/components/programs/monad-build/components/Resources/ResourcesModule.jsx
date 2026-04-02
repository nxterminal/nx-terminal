import { useState } from 'react';
import { Copy, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { MEGAETH_RPC_PROVIDERS, CANONICAL_CONTRACTS, FAUCETS, MEGAETH_MAINNET } from '../../constants/monad';
import Button from '../shared/Button';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="mb-btn mb-btn-ghost mb-btn-sm"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{ padding: '2px 6px' }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function Section({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-accordion">
      <button
        className={`mb-accordion-header ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
      >
        {title}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="mb-accordion-body mb-animate-in">
          {children}
        </div>
      )}
    </div>
  );
}

const VIEM_SNIPPET = `import { createPublicClient, http } from 'viem';

const megaeth = {
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://carrot.megaeth.com/rpc'] } },
  blockExplorers: { default: { name: 'MegaExplorer', url: 'https://megaexplorer.xyz' } },
};

const client = createPublicClient({
  chain: megaeth,
  transport: http(),
});`;

export default function ResourcesModule() {
  return (
    <div className="mb-animate-in">
      <h1 className="mb-h1 mb-mb-sm">Developer Resources</h1>
      <p className="mb-text-sm mb-mb-lg">
        Everything you need to build on MegaETH — RPCs, contracts, tools, and more.
      </p>

      <Section title="RPC Endpoints" defaultOpen>
        <table className="mb-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>URL</th>
              <th>Rate Limit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {MEGAETH_RPC_PROVIDERS.map(rpc => (
              <tr key={rpc.name}>
                <td style={{ fontWeight: 500, color: 'var(--mb-text-primary)' }}>{rpc.name}</td>
                <td>
                  <code style={{ fontFamily: 'var(--mb-font-mono)', fontSize: 12 }}>{rpc.url}</code>
                </td>
                <td className="mb-text-xs">{rpc.rateLimit}</td>
                <td><CopyButton text={rpc.url} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Block Explorers">
        <div className="mb-flex-col mb-gap-sm">
          {[
            { name: 'MegaExplorer', url: 'https://megaexplorer.xyz', desc: 'Block explorer' },
          ].map(e => (
            <div key={e.name} className="mb-flex mb-items-center mb-justify-between">
              <div>
                <span style={{ fontWeight: 500 }}>{e.name}</span>
                <span className="mb-text-sm" style={{ marginLeft: 8 }}>{e.desc}</span>
              </div>
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-btn mb-btn-ghost mb-btn-sm"
                style={{ textDecoration: 'none' }}
              >
                Open <ExternalLink size={12} />
              </a>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Canonical Contracts">
        <table className="mb-table">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Address</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(CANONICAL_CONTRACTS).map(([name, addr]) => (
              <tr key={name}>
                <td style={{ fontWeight: 500, color: 'var(--mb-text-primary)' }}>{name}</td>
                <td>
                  <code style={{ fontFamily: 'var(--mb-font-mono)', fontSize: 12 }}>{addr}</code>
                </td>
                <td>
                  <div className="mb-flex mb-gap-sm">
                    <CopyButton text={addr} />
                    <a
                      href={`${MEGAETH_MAINNET.explorer}/address/${addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-btn mb-btn-ghost mb-btn-sm"
                      style={{ textDecoration: 'none', padding: '2px 6px' }}
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Testnet Faucets">
        <div className="mb-grid-3">
          {FAUCETS.map(f => (
            <div key={f.name} className="mb-card">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{f.name}</div>
              <div className="mb-text-sm mb-mb-sm">{f.description}</div>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-btn mb-btn-primary mb-btn-sm"
                style={{ textDecoration: 'none' }}
              >
                Get Test ETH <ExternalLink size={12} />
              </a>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Development Tools">
        <div className="mb-flex-col mb-gap-md">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>viem / wagmi</div>
            <pre className="mb-code-block" style={{ fontSize: 12 }}>{VIEM_SNIPPET}</pre>
          </div>
          <div className="mb-flex mb-gap-sm">
            {[
              { name: 'MegaETH Docs', url: 'https://docs.megaeth.com' },
              { name: 'MegaETH GitHub', url: 'https://github.com/megaeth-labs' },
              { name: 'Bridge', url: 'https://rabbithole.megaeth.com/bridge' },
              { name: 'Discord', url: 'https://discord.gg/megaeth' },
            ].map(link => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-btn mb-btn-secondary mb-btn-sm"
                style={{ textDecoration: 'none' }}
              >
                {link.name} <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}
