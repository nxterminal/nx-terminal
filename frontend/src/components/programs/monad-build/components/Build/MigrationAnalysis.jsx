import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import Badge from '../shared/Badge';

function analyzeContract(code) {
  const findings = [];
  let score = 95; // Base score — most EVM contracts are compatible

  // Check pragma
  const pragmaMatch = code.match(/pragma solidity\s+([^;]+)/);
  if (pragmaMatch) {
    const version = pragmaMatch[1];
    if (version.includes('0.8')) {
      findings.push({ severity: 'info', title: 'Solidity Version', desc: `Detected: ${version}. Recommended: ^0.8.28 for Pharos.` });
    } else {
      findings.push({ severity: 'warning', title: 'Outdated Solidity', desc: `Detected: ${version}. Upgrade to ^0.8.28 for Pharos compatibility.` });
      score -= 10;
    }
  }

  // Check for evmVersion
  if (!code.includes('prague')) {
    findings.push({ severity: 'error', title: 'Missing evmVersion', desc: 'Must set evmVersion: "prague" in compiler settings for Pharos.' });
    score -= 5;
  }

  // Count storage reads
  const mappingMatches = code.match(/mapping\s*\(/g);
  const storageReads = mappingMatches ? mappingMatches.length : 0;
  if (storageReads > 3) {
    findings.push({
      severity: 'warning',
      title: 'Multiple Storage Mappings',
      desc: `Found ${storageReads} mappings. Cold SLOAD costs 8,100 gas on Pharos (vs 2,100 on Ethereum). Cache reads in memory variables.`,
    });
    score -= 3;
  }

  // Check for external calls
  const externalCalls = (code.match(/\.call\(|\.transfer\(|\.send\(|IERC20\(|\.safeTransfer/g) || []).length;
  if (externalCalls > 0) {
    findings.push({
      severity: 'warning',
      title: 'External Calls Detected',
      desc: `Found ${externalCalls} external call(s). Cold account access costs 10,100 gas on Pharos. Ensure re-entrancy guards are in place.`,
    });
  }

  // Check for unchecked blocks
  if (!code.includes('unchecked')) {
    findings.push({
      severity: 'info',
      title: 'No unchecked Blocks',
      desc: 'Consider using unchecked blocks for safe arithmetic to save gas on Pharos.',
    });
  }

  // Check contract size (rough estimate)
  const sizeKB = new Blob([code]).size / 1024;
  findings.push({
    severity: 'info',
    title: 'Estimated Size',
    desc: `~${sizeKB.toFixed(1)} KB source. Pharos allows up to 128 KB (vs 24.5 KB on Ethereum).`,
  });

  // Check for OpenZeppelin
  if (code.includes('@openzeppelin')) {
    findings.push({
      severity: 'info',
      title: 'OpenZeppelin Detected',
      desc: 'OpenZeppelin contracts are fully compatible with Pharos. Ensure you use v5.x imports.',
    });
  }

  return { score: Math.max(0, Math.min(100, score)), findings };
}

export default function MigrationAnalysis({ code }) {
  const { score, findings } = analyzeContract(code);

  const scoreColor = score >= 90 ? 'var(--mb-accent-secondary)' : score >= 70 ? 'var(--mb-accent-warning)' : 'var(--mb-accent-error)';

  const ICONS = {
    error: AlertTriangle,
    warning: AlertTriangle,
    info: Info,
  };

  return (
    <div className="mb-animate-in">
      <div className="mb-flex mb-items-center mb-gap-lg mb-mb-lg">
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 48,
            fontWeight: 700,
            fontFamily: 'var(--mb-font-display)',
            color: scoreColor,
            lineHeight: 1,
          }}>
            {score}
          </div>
          <div className="mb-text-xs" style={{ marginTop: 4 }}>Compatibility</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
            {score >= 90 ? 'Excellent Compatibility' : score >= 70 ? 'Good with Adjustments' : 'Needs Optimization'}
          </div>
          <div className="mb-text-sm">
            {score >= 90
              ? 'Your contract is nearly ready for Pharos. Review the notes below.'
              : 'Review the findings below and apply optimizations for Pharos.'}
          </div>
        </div>
      </div>

      <h3 className="mb-h3 mb-mb-md">Findings ({findings.length})</h3>
      <div className="mb-flex-col mb-gap-sm">
        {findings.map((f, i) => {
          const Icon = ICONS[f.severity] || Info;
          const colors = {
            error: 'var(--mb-accent-error)',
            warning: 'var(--mb-accent-warning)',
            info: 'var(--mb-accent-info)',
          };
          return (
            <div key={i} className="mb-card" style={{ padding: 12 }}>
              <div className="mb-flex mb-items-center mb-gap-sm mb-mb-sm">
                <Icon size={16} style={{ color: colors[f.severity] }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{f.title}</span>
                <Badge color={f.severity === 'error' ? 'red' : f.severity === 'warning' ? 'amber' : 'blue'}>
                  {f.severity}
                </Badge>
              </div>
              <div className="mb-text-sm" style={{ paddingLeft: 28 }}>{f.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
