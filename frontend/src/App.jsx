import { useState, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import FileUpload from './components/FileUpload';
import SummaryCards from './components/SummaryCards';
import FraudTable from './components/FraudTable';
import NetworkGraph from './components/NetworkGraph';
import './App.css';

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const typeColor = (t) =>
  t === 'cycle' ? 'var(--cyan)' : t === 'smurfing' ? 'var(--amber)' : 'var(--purple)';

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function gradientHex(t) {
  // Purple #c77dff → Red #ff4d6d
  return `rgb(${lerp(199, 255, t)},${lerp(125, 77, t)},${lerp(255, 109, t)})`;
}

/* ══════════════════════════════════════════════════════════════
   NODE INSPECTOR PANEL (replaces empty-state in AuditPanel)
   Shown when a node in the graph is clicked
══════════════════════════════════════════════════════════════ */
function NodeInspector({ selection, onClose }) {
  if (!selection) return null;
  const { nodeId, score, pattern, hops, inDegree, isLikelyDest } = selection;

  // Primary peeling chain hop (if any)
  const peelHop = hops.find(h => h.isPeel);

  return (
    <div style={{
      margin: '0 14px 14px',
      borderRadius: 10,
      border: '1px solid rgba(0,229,255,0.25)',
      background: 'rgba(0,229,255,0.04)',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Inspector header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid rgba(0,229,255,0.12)',
        background: 'rgba(0,229,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: typeColor(pattern), boxShadow: `0 0 6px ${typeColor(pattern)}`,
          }} />
          <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>
            {nodeId}
          </span>
        </div>
        <button onClick={onClose} style={{ color: 'var(--t3)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      <div style={{ padding: '12px' }}>
        {/* Score row */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
          <div>
            <p style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: '0.06em', marginBottom: 2 }}>SUSPICION SCORE</p>
            <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: score >= 75 ? 'var(--red)' : score >= 60 ? 'var(--amber)' : 'var(--green)' }}>
              {score.toFixed(1)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: '0.06em', marginBottom: 2 }}>PATTERN</p>
            <p style={{
              fontFamily: 'monospace', fontSize: 12, fontWeight: 700, padding: '2px 7px',
              borderRadius: 4, background: `${typeColor(pattern)}18`,
              border: `1px solid ${typeColor(pattern)}40`, color: typeColor(pattern),
              display: 'inline-block',
            }}>
              {pattern}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: '0.06em', marginBottom: 2 }}>IN-DEGREE</p>
            <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: 'var(--t1)' }}>{inDegree}</p>
          </div>
        </div>

        {/* Peeling chain hop info */}
        {peelHop && (
          <div style={{
            padding: '8px 10px', borderRadius: 7,
            border: '1px solid rgba(199,125,255,0.3)',
            background: 'rgba(199,125,255,0.06)',
            marginBottom: 10,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#c77dff', marginBottom: 6, letterSpacing: '0.06em' }}>
              PEELING CHAIN POSITION
            </p>
            {/* Hop progress bar */}
            <div style={{ position: 'relative', height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.07)', marginBottom: 6 }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4,
                width: `${((peelHop.hopIndex + 1) / peelHop.totalHops) * 100}%`,
                background: `linear-gradient(90deg, #c77dff, ${gradientHex((peelHop.hopIndex) / Math.max(peelHop.totalHops - 1, 1))})`,
              }} />
            </div>
            <p style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>
              Step {peelHop.hopIndex + 1}{' '}
              <span style={{ color: 'var(--t3)', fontWeight: 400 }}>of</span>{' '}
              {peelHop.totalHops}{' '}
              <span style={{ fontSize: 11, color: '#c77dff' }}>in Peeling Chain</span>
            </p>
            <p style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4, fontFamily: 'monospace' }}>
              Chain: {peelHop.chainId}
            </p>
          </div>
        )}

        {/* Likely Destination warning */}
        {isLikelyDest && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            padding: '8px 10px', borderRadius: 7,
            border: '1px solid rgba(255,165,42,0.35)',
            background: 'rgba(255,165,42,0.07)',
          }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 3 }}>
                ⚠ Likely Destination — Exchange Cash-Out
              </p>
              <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.4 }}>
                Terminal node with high in-degree ({inDegree} incoming txns). Consistent with a mixing service or exchange wallet collecting layered funds.
              </p>
            </div>
          </div>
        )}

        {/* All chain memberships */}
        {hops.length > 1 && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: '0.06em', marginBottom: 6 }}>
              MULTI-CHAIN MEMBER ({hops.length} rings)
            </p>
            {hops.slice(0, 4).map((h, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, alignItems: 'center',
                fontSize: 11, color: 'var(--t2)', marginBottom: 3, fontFamily: 'monospace',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: h.isPeel ? '#c77dff' : 'var(--cyan)', flexShrink: 0,
                }} />
                {h.chainId} — hop {h.hopIndex + 1}/{h.totalHops}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FORENSIC FORECAST
══════════════════════════════════════════════════════════════ */
function ForensicForecast({ summary, likelyExitCount }) {
  if (!summary) return null;
  const nodes = summary.total_accounts_analyzed ?? 0;
  const timeSec = summary.processing_time_seconds ?? Infinity;
  const isHighPerf = nodes >= 20000 && timeSec < 1;
  const throughput = nodes > 0 && timeSec > 0 ? Math.round(nodes / timeSec).toLocaleString() : null;

  return (
    <div style={{
      margin: '0 14px 10px',
      padding: '10px 12px', borderRadius: 9, flexShrink: 0,
      border: `1px solid ${isHighPerf ? 'rgba(0,230,118,0.35)' : 'rgba(0,229,255,0.2)'}`,
      background: isHighPerf ? 'rgba(0,230,118,0.07)' : 'rgba(0,229,255,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
          stroke={isHighPerf ? 'var(--green)' : 'var(--cyan)'} strokeWidth={2}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: isHighPerf ? 'var(--green)' : 'var(--cyan)' }}>
          FORENSIC FORECAST
        </span>
        {isHighPerf && (
          <span style={{
            marginLeft: 'auto', fontSize: 9, fontWeight: 700,
            padding: '2px 7px', borderRadius: 20,
            background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)',
            color: 'var(--green)', letterSpacing: '0.06em',
          }}>
            ⚡ HIGH-PERFORMANCE MODE: ACTIVE
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'THROUGHPUT', value: throughput ? `${throughput}/s` : '—', color: isHighPerf ? 'var(--green)' : 'var(--cyan)' },
          { label: 'PROC. TIME', value: `${timeSec}s`, color: 'var(--amber)' },
          { label: 'LIKELY EXITS', value: likelyExitCount ?? 0, color: likelyExitCount > 0 ? 'var(--red)' : 'var(--green)' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 2, letterSpacing: '0.06em' }}>{label}</p>
            <p style={{ fontSize: 15, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUDIT PANEL (right column)
══════════════════════════════════════════════════════════════ */
function AuditPanel({ data, nodeSelection, onCloseNode, likelyExitCount }) {
  // All rings — zero filtering
  const rings = data?.fraud_rings || [];
  const sum = data?.summary;

  return (
    <div style={{
      width: 360, minWidth: 360, height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(8,8,15,0.97)',
      borderLeft: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>Audit Dashboard</span>
        </div>
        <div style={{
          width: 26, height: 26, borderRadius: 6, background: 'var(--surface)',
          border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth={2}>
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
        </div>
      </div>

      {/* Stat cards */}
      {sum && (
        <div style={{ padding: '14px 14px 10px', flexShrink: 0 }}>
          <SummaryCards summary={sum} />
        </div>
      )}

      {/* Forensic Forecast */}
      {sum && <ForensicForecast summary={sum} likelyExitCount={likelyExitCount} />}

      {/* Node Inspector — appears when a graph node is clicked */}
      {nodeSelection && (
        <NodeInspector selection={nodeSelection} onClose={onCloseNode} />
      )}

      {/* Rings list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column' }}>
        {rings.length > 0 ? (
          <>
            <p style={{
              fontSize: 10, fontWeight: 700, color: 'var(--t3)',
              letterSpacing: '0.1em', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth={2}>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              DETECTED LAUNDERING CHAINS ({rings.length})
            </p>
            {rings.map((ring, i) => {
              const isPeel = ring.pattern_type === 'smurfing';
              const color = isPeel ? '#c77dff' : typeColor(ring.pattern_type);
              return (
                <div key={ring.ring_id} className="ring-item anim-slide"
                  style={{ animationDelay: `${i * 0.04}s`, opacity: 0, borderColor: `${color}20` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Ring type badge */}
                    {isPeel && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 9, fontWeight: 700,
                        padding: '1px 6px', borderRadius: 3, marginBottom: 4,
                        background: 'rgba(199,125,255,0.12)', border: '1px solid rgba(199,125,255,0.3)',
                        color: '#c77dff', letterSpacing: '0.06em',
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#c77dff' }} />
                        PEELING CHAIN
                      </div>
                    )}
                    <div style={{
                      fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                      color, marginBottom: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {ring.ring_id}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--t2)' }}>
                        {isPeel ? '→' : '🔗'} {ring.member_accounts?.length ?? 0} {isPeel ? 'hops' : 'wallets'}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                        fontFamily: 'monospace',
                        background: `${color}18`, border: `1px solid ${color}30`, color,
                      }}>
                        {isPeel ? 'peeling_chain' : ring.pattern_type}
                      </span>
                      {ring.risk_score != null && (
                        <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'monospace' }}>
                          risk: {ring.risk_score.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth={2}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              );
            })}
          </>
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--t3)', fontSize: 12, gap: 8, textAlign: 'center',
          }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            {data ? 'No fraud rings detected in dataset' : 'Upload a CSV to begin analysis'}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ERROR BANNER
══════════════════════════════════════════════════════════════ */
function ErrorBanner({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', margin: '12px 14px 0',
      background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
      borderRadius: 8, flexShrink: 0,
    }}>
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p style={{ flex: 1, fontSize: 12, color: 'rgba(255,120,140,0.9)' }}>{msg}</p>
      <button onClick={onClose} style={{ color: 'var(--t3)', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}>×</button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   APP ROOT
══════════════════════════════════════════════════════════════ */
export default function App() {
  const [transactionsData, setTransactionsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [active, setActive] = useState('dashboard');
  const [nodeSelection, setNodeSelection] = useState(null);

  const handleSuccess = useCallback((data) => {
    setTransactionsData(data);
    setNodeSelection(null);
    setError(null);
  }, []);

  const handleNodeSelect = useCallback((info) => {
    setNodeSelection(info);
  }, []);

  const hasData = !!transactionsData;

  // Build hopMap for FraudTable augmentation
  // Map: accountId → [{ chainId, hopIndex, totalHops, isPeel, ... }]
  const hopMap = useMemo(() => {
    const map = {};
    transactionsData?.fraud_rings?.forEach(ring => {
      const isPeel = ring.pattern_type === 'smurfing';
      ring.member_accounts?.forEach((id, idx) => {
        if (!map[id]) map[id] = [];
        map[id].push({
          chainId: ring.ring_id,
          hopIndex: idx,
          totalHops: ring.member_accounts.length,
          isPeel,
          patternType: ring.pattern_type,
          riskScore: ring.risk_score,
        });
      });
    });
    return map;
  }, [transactionsData]);

  // Forecast: Likely Exit Points (terminal nodes of peeling chains with high in-degree)
  const likelyExitCount = useMemo(() => {
    if (!transactionsData?.fraud_rings) return 0;
    // Calculate degree map across all rings
    const inDegree = {};
    transactionsData.fraud_rings.forEach(ring => {
      ring.member_accounts?.forEach((id, idx) => {
        if (idx > 0) inDegree[id] = (inDegree[id] || 0) + 1;
      });
    });
    // Find terminal nodes of peeling chains
    let count = 0;
    transactionsData.fraud_rings.forEach(ring => {
      if (ring.pattern_type === 'smurfing' && ring.member_accounts?.length > 0) {
        const terminalId = ring.member_accounts[ring.member_accounts.length - 1];
        if (inDegree[terminalId] >= 5) count++;
      }
    });
    return count;
  }, [transactionsData]);

  const VIEW_TITLE = {
    'dashboard': ['The Smurfing Hunter', 'Forensics Dashboard'],
    'forensic-map': ['Forensic Map', 'Fraud Ring & Peeling Chain Visualization'],
    'audit-logs': ['Audit Logs', 'Investigation History'],
  };
  const [title, subtitle] = VIEW_TITLE[active];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar active={active} setActive={setActive} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar title={title} subtitle={subtitle} />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* ── Dashboard ── */}
          {active === 'dashboard' && (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <ErrorBanner msg={error} onClose={() => setError(null)} />
                <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <section>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.1em', marginBottom: 8 }}>DATA SOURCE</p>
                    <FileUpload onSuccess={handleSuccess} isLoading={isLoading} setIsLoading={setIsLoading} setError={setError} />
                  </section>
                  {hasData && (
                    <section>
                      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.1em', marginBottom: 8 }}>FLAGGED ACCOUNTS</p>
                      <FraudTable accounts={transactionsData.suspicious_accounts} hopMap={hopMap} />
                    </section>
                  )}
                </div>
              </div>
              <AuditPanel data={transactionsData} nodeSelection={nodeSelection} onCloseNode={() => setNodeSelection(null)} likelyExitCount={likelyExitCount} />
            </>
          )}

          {/* ── Forensic Map ── */}
          {active === 'forensic-map' && (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 14, minWidth: 0 }}>
                {hasData ? (
                  <>
                    {/* Filter bar */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0, alignItems: 'center' }}>
                      {['Overview', 'Filter'].map(tab => (
                        <button key={tab} style={{
                          padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          background: tab === 'Overview' ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${tab === 'Overview' ? 'rgba(0,229,255,0.3)' : 'var(--border)'}`,
                          color: tab === 'Overview' ? 'var(--cyan)' : 'var(--t2)',
                        }}>{tab}</button>
                      ))}
                      {/* Ring count breakdown */}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: 11, color: 'var(--t3)', alignItems: 'center' }}>
                        {Object.entries(
                          transactionsData.fraud_rings?.reduce((acc, r) => {
                            acc[r.pattern_type] = (acc[r.pattern_type] || 0) + 1; return acc;
                          }, {}) || {}
                        ).map(([p, n]) => (
                          <span key={p} style={{ color: p === 'smurfing' ? '#c77dff' : p === 'cycle' ? 'var(--cyan)' : 'var(--purple)' }}>
                            {n} {p === 'smurfing' ? 'peeling chain' : p}{n > 1 ? 's' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                      <NetworkGraph
                        fraudRings={transactionsData.fraud_rings}
                        suspiciousAccounts={transactionsData.suspicious_accounts}
                        onNodeSelect={handleNodeSelect}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--t3)', fontSize: 13 }}>
                    <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    Upload a CSV on the Dashboard to visualize fraud rings
                  </div>
                )}
              </div>
              <AuditPanel data={transactionsData} nodeSelection={nodeSelection} onCloseNode={() => setNodeSelection(null)} likelyExitCount={likelyExitCount} />
            </>
          )}

          {/* ── Audit Logs ── */}
          {active === 'audit-logs' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <div style={{ background: 'rgba(10,10,18,0.95)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, maxWidth: 860 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth={2}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>Session Audit Log</span>
                </div>

                {hasData ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: 'CSV file uploaded and validated by Daksh', status: 'success' },
                      { label: `Graph constructed — ${transactionsData.summary?.total_accounts_analyzed?.toLocaleString()} accounts analyzed`, status: 'success' },
                      { label: `${transactionsData.summary?.suspicious_accounts_flagged} suspicious accounts flagged`, status: 'warn' },
                      { label: `${transactionsData.fraud_rings?.filter(r => r.pattern_type === 'smurfing').length || 0} peeling chain(s) detected`, status: 'critical' },
                      { label: `${transactionsData.fraud_rings?.filter(r => r.pattern_type === 'cycle').length || 0} cycle ring(s) detected`, status: 'critical' },
                      { label: `Analysis complete in ${transactionsData.summary?.processing_time_seconds}s`, status: 'success' },
                      ...(transactionsData.summary?.processing_time_seconds < 1 && transactionsData.summary?.total_accounts_analyzed >= 20000
                        ? [{ label: '⚡ High-Performance Mode active — throughput exceeds 20k nodes/sec', status: 'success' }]
                        : []),
                    ].map((log, i) => {
                      const c = log.status === 'success' ? 'var(--green)' : log.status === 'warn' ? 'var(--amber)' : 'var(--red)';
                      return (
                        <div key={i} className="anim-slide" style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 7, animationDelay: `${i * 0.07}s`, opacity: 0,
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}`, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--t1)' }}>{log.label}</span>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--t3)' }}>
                            {new Date().toLocaleTimeString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: 'var(--t2)', fontSize: 13 }}>
                    No log entries yet. Upload a transaction CSV to begin analysis.
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
