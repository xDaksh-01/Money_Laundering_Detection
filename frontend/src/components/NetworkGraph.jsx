import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

/* ══════════════════════════════════════════════════════════════
   CONSTANTS & COLOR HELPERS
══════════════════════════════════════════════════════════════ */
const COLORS = {
    cycle: '#00e5ff',   // Cyan
    smurfing: '#ffa52a',   // Amber (node base)
    fan_in: '#c77dff',   // Purple
    unknown: '#00e676',   // Green
    peelStart: '#c77dff',   // Purple (chain start)
    peelEnd: '#ff4d6d',   // Red   (chain end)
};

function patternColor(pattern) {
    return COLORS[pattern] || COLORS.unknown;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

function gradientColor(t) {
    // Purple (#c77dff) → Red (#ff4d6d)
    const [r1, g1, b1] = hexToRgb('#c77dff');
    const [r2, g2, b2] = hexToRgb('#ff4d6d');
    return `rgba(${Math.round(lerp(r1, r2, t))},${Math.round(lerp(g1, g2, t))},${Math.round(lerp(b1, b2, t))},0.8)`;
}

/* ══════════════════════════════════════════════════════════════
   GRAPH DATA BUILDER
   - Smurfing rings → PEELING CHAINS: linear paths (no wrap-around edge)
   - Cycle rings → circular topology (wrap-around included)
   - Tracks hop index for every node in every chain
══════════════════════════════════════════════════════════════ */
function buildGraph(fraudRings, suspiciousAccounts) {
    const PRIORITY = { smurfing: 3, cycle: 2, fan_in: 1 };
    const nodeMap = new Map();
    const links = [];
    const scoreMap = {};
    const hopMap = {};   // accountId → [{ chainId, hopIndex, totalHops, ringObj }]

    suspiciousAccounts?.forEach(a => { scoreMap[a.account_id] = a.suspicion_score; });

    fraudRings?.forEach(ring => {
        const pType = ring.pattern_type;
        const pPri = PRIORITY[pType] ?? 0;
        const members = ring.member_accounts || [];
        const isPeel = pType === 'smurfing';  // treat smurfing as peeling chain

        // Register nodes
        members.forEach((id, idx) => {
            const existing = nodeMap.get(id);
            if (!existing || pPri > (PRIORITY[existing.pattern] ?? 0)) {
                nodeMap.set(id, {
                    id,
                    pattern: pType,
                    score: scoreMap[id] ?? 0,
                    isPeelNode: isPeel,
                    // hop info set below
                    hopIndex: isPeel ? idx : null,
                    totalHops: isPeel ? members.length : null,
                    chainId: isPeel ? ring.ring_id : null,
                    isChainEnd: isPeel && idx === members.length - 1,
                });
            }
            // Build hop map (support multi-chain membership)
            if (!hopMap[id]) hopMap[id] = [];
            hopMap[id].push({
                chainId: ring.ring_id,
                hopIndex: idx,
                totalHops: members.length,
                isPeel,
                riskScore: ring.risk_score,
                patternType: pType,
            });
        });

        // Build edges
        if (isPeel) {
            // PEELING CHAIN → strict sequential, no wrap-around
            for (let i = 0; i < members.length - 1; i++) {
                const s = members[i], t = members[i + 1];
                const t_pos = i / Math.max(members.length - 2, 1);  // 0 → 1 along chain
                links.push({
                    source: s,
                    target: t,
                    pattern: pType,
                    ring_id: ring.ring_id,
                    isPeel: true,
                    t_pos,              // gradient position
                    hopIndex: i,
                    totalHops: members.length,
                });
            }
        } else {
            // CYCLE → circular with wrap-around
            for (let i = 0; i < members.length; i++) {
                const s = members[i], t = members[(i + 1) % members.length];
                if (s !== t) links.push({ source: s, target: t, pattern: pType, ring_id: ring.ring_id, isPeel: false });
            }
        }
    });

    return {
        nodes: Array.from(nodeMap.values()),
        links,
        hopMap,
    };
}

/* ══════════════════════════════════════════════════════════════
   DEGREE MAP — count how many links point to each node
   Used for Likely Destination heuristic
══════════════════════════════════════════════════════════════ */
function buildDegreeMap(links) {
    const inDegree = {};
    links.forEach(l => {
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        inDegree[t] = (inDegree[t] || 0) + 1;
    });
    return inDegree;
}

/* ══════════════════════════════════════════════════════════════
   LEGEND CONFIG
══════════════════════════════════════════════════════════════ */
const LEGEND_ITEMS = [
    { color: '#00e5ff', label: 'Cycle Ring' },
    { color: '#c77dff', label: 'Peeling Chain (start)' },
    { color: '#ff4d6d', label: 'Peeling Chain (end)' },
    { color: '#c77dff', label: 'Fan-In / Other' },
];

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function NetworkGraph({ fraudRings, suspiciousAccounts, onNodeSelect }) {
    const fgRef = useRef();
    const containerRef = useRef();
    const [dims, setDims] = useState({ w: 900, h: 500 });

    const { nodes, links, hopMap } = useMemo(
        () => buildGraph(fraudRings, suspiciousAccounts),
        [fraudRings, suspiciousAccounts]
    );
    const graphData = useMemo(() => ({ nodes, links }), [nodes, links]);
    const degreeMap = useMemo(() => buildDegreeMap(links), [links]);

    // Resize observer
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => {
            setDims({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Auto-fit
    useEffect(() => {
        const t = setTimeout(() => fgRef.current?.zoomToFit(500, 60), 600);
        return () => clearTimeout(t);
    }, [graphData]);

    // Node click → send hop info to parent
    const handleNodeClick = useCallback((node) => {
        const hops = hopMap[node.id] || [];
        const inDeg = degreeMap[node.id] || 0;
        // Mark as likely destination if high in-degree (≥ 5) and end of a peeling chain
        const isLikelyDest = node.isChainEnd && inDeg >= 5;
        onNodeSelect?.({
            nodeId: node.id,
            score: node.score,
            pattern: node.pattern,
            hops,
            inDegree: inDeg,
            isLikelyDest,
        });
    }, [hopMap, degreeMap, onNodeSelect]);

    // Empty state
    if (!fraudRings?.length) {
        return (
            <div style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 12, flex: 1, minHeight: 400, color: 'var(--t3)', fontSize: 13,
            }}>
                <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                No fraud rings to visualize — upload a CSV on the Dashboard first
            </div>
        );
    }

    // Pattern breakdown
    const patternCounts = {};
    fraudRings.forEach(r => { patternCounts[r.pattern_type] = (patternCounts[r.pattern_type] || 0) + 1; });
    const peelCount = patternCounts['smurfing'] || 0;
    const cycleCount = patternCounts['cycle'] || 0;

    return (
        <div ref={containerRef} style={{
            position: 'relative', background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 12,
            overflow: 'hidden', flex: 1, minHeight: 0,
        }}>

            {/* ── Top-left: pattern tags ── */}
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cycleCount > 0 && (
                    <span style={pill('#00e5ff')}>{cycleCount} cycle{cycleCount > 1 ? 's' : ''}</span>
                )}
                {peelCount > 0 && (
                    <span style={pill('#c77dff')}>{peelCount} peeling chain{peelCount > 1 ? 's' : ''}</span>
                )}
                {Object.entries(patternCounts)
                    .filter(([p]) => p !== 'cycle' && p !== 'smurfing')
                    .map(([p, n]) => <span key={p} style={pill(patternColor(p))}>{n} {p}</span>)
                }
            </div>

            {/* ── Top-right: counts ── */}
            <div style={{
                position: 'absolute', top: 12, right: 12, zIndex: 10,
                background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)',
                borderRadius: 6, padding: '4px 10px',
                fontSize: 11, fontFamily: 'monospace', color: 'var(--cyan)',
            }}>
                {nodes.length} nodes · {links.length} edges
            </div>

            {/* ── Bottom-left: legend ── */}
            <div style={{
                position: 'absolute', bottom: 32, left: 12, zIndex: 10,
                background: 'rgba(8,8,15,0.9)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 12px', backdropFilter: 'blur(10px)',
            }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: 8 }}>
                    LEGEND
                </p>
                {[
                    { color: '#00e5ff', label: 'Cycle ring node' },
                    { gradient: true, label: 'Peeling chain (purple→red)' },
                    { color: '#c77dff', label: 'Fan-In / Other' },
                ].map(({ color, gradient, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        {gradient ? (
                            <svg width={10} height={10} style={{ flexShrink: 0 }}>
                                <defs>
                                    <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#c77dff" />
                                        <stop offset="100%" stopColor="#ff4d6d" />
                                    </linearGradient>
                                </defs>
                                <circle cx="5" cy="5" r="5" fill="url(#lg)" />
                            </svg>
                        ) : (
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: 11, color: 'var(--t2)' }}>{label}</span>
                    </div>
                ))}
            </div>

            {/* ── Bottom hint ── */}
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                    Click any node to inspect · Peeling chains use purple→red gradient
                </span>
            </div>

            {/* ── Force Graph ── */}
            <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                width={dims.w}
                height={dims.h}
                backgroundColor="transparent"
                onNodeClick={handleNodeClick}

                /* Nodes */
                nodeRelSize={6}
                nodeVal={n => Math.max(1.5, (n.score / 100) * 2.5 + 1.5)}
                nodeColor={n => {
                    if (n.isPeelNode) {
                        // Gradient along chain: purple at start, red at end
                        const t = n.hopIndex != null && n.totalHops > 1
                            ? n.hopIndex / (n.totalHops - 1)
                            : 0;
                        return gradientColor(t);
                    }
                    return patternColor(n.pattern);
                }}
                nodeLabel={n => {
                    const base = `${n.id}\nPattern: ${n.pattern || 'unknown'}\nScore: ${n.score}`;
                    if (n.isPeelNode && n.hopIndex != null) {
                        return `${base}\n─ Step ${n.hopIndex + 1} of ${n.totalHops} in peeling chain`;
                    }
                    return base;
                }}

                /* Links — custom canvas for peeling gradient edges */
                linkDirectionalArrowLength={5}
                linkDirectionalArrowRelPos={1}
                linkDirectionalParticles={l => l.isPeel ? 3 : 2}
                linkDirectionalParticleWidth={l => l.isPeel ? 2.5 : 2}
                linkDirectionalParticleColor={l => l.isPeel ? gradientColor(l.t_pos ?? 0.5) : patternColor(l.pattern)}
                linkWidth={l => l.isPeel ? 2 : 1.5}

                /* Draw gradient for peeling links, solid for others */
                linkCanvasObjectMode={l => l.isPeel ? 'replace' : undefined}
                linkCanvasObject={(link, ctx) => {
                    const s = link.source, t = link.target;
                    if (typeof s !== 'object' || typeof t !== 'object') return;

                    const t0 = link.t_pos ?? 0.5;
                    const colorA = gradientColor(t0);
                    const colorB = gradientColor(Math.min(t0 + 0.15, 1));

                    const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
                    grad.addColorStop(0, colorA);
                    grad.addColorStop(1, colorB);

                    ctx.beginPath();
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(t.x, t.y);
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }}

                cooldownTicks={120}
                onEngineStop={() => fgRef.current?.zoomToFit(500, 60)}

                /* Node labels at high zoom only */
                nodeCanvasObjectMode={() => 'after'}
                nodeCanvasObject={(node, ctx, globalScale) => {
                    if (globalScale < 2.5) return;
                    const fs = Math.max(7, 9 / globalScale);
                    ctx.font = `${fs}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillStyle = 'rgba(255,255,255,0.65)';
                    ctx.fillText(node.id, node.x, node.y + 8);
                }}
            />
        </div>
    );
}

/* helper: pill badge style */
function pill(color) {
    return {
        fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
        padding: '3px 9px', borderRadius: 5,
        background: `${color}18`, border: `1px solid ${color}40`, color,
    };
}
