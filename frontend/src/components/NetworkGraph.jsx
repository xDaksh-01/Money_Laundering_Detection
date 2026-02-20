import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

/* ══════════════════════════════════════════════════════════════
   GREEN / RED only — no yellow
   Green  = source node (first in ring / backend role==='source')
   Red    = all other suspicious nodes
══════════════════════════════════════════════════════════════ */
const GREEN = '#00FF00';
const RED = '#FF2222';
const EDGE_COLOR = '#00E5FF';   // Electric Blue particles

/** True when this node is the origin/source of a fraud chain */
function isSource(n) {
    if (n.role === 'source') return true;   // backend role wins
    if (n.role && n.role !== 'source') return false;  // explicit non-source
    return n.hopIndex === 0;                                  // structural: first in chain
}

function nodeColorFn(n) {
    return isSource(n) ? GREEN : RED;
}


/* ══════════════════════════════════════════════════════════════
   GRAPH DATA BUILDER
══════════════════════════════════════════════════════════════ */
function buildGraph(fraudRings, suspiciousAccounts) {
    const PRIORITY = { consolidation: 4, shell: 3, smurfing: 2, cycle: 1 };
    const nodeMap = new Map();
    const links = [];
    const scoreMap = {};
    const roleMap = {};
    const hopMap = {};

    // Index scores and roles from backend accounts list
    suspiciousAccounts?.forEach(a => {
        scoreMap[a.account_id] = a.suspicion_score ?? 0;
        if (a.role) roleMap[a.account_id] = a.role;
    });

    fraudRings?.forEach(ring => {
        const pType = ring.pattern_type;
        const pPri = PRIORITY[pType] ?? 0;
        const members = ring.member_accounts || [];
        const isChain = pType === 'smurfing' || pType === 'shell';

        members.forEach((id, idx) => {
            const existing = nodeMap.get(id);
            if (!existing || pPri > (PRIORITY[existing.pattern] ?? 0)) {
                nodeMap.set(id, {
                    id,
                    pattern: pType,
                    score: scoreMap[id] ?? 0,
                    role: roleMap[id] || null,   // null → fallback to score
                    isPeelNode: isChain,
                    hopIndex: isChain ? idx : null,
                    totalHops: isChain ? members.length : null,
                    chainId: isChain ? ring.ring_id : null,
                    isChainEnd: isChain && idx === members.length - 1,
                });
            }
            if (!hopMap[id]) hopMap[id] = [];
            hopMap[id].push({
                chainId: ring.ring_id,
                hopIndex: idx,
                totalHops: members.length,
                isPeel: isChain,
                riskScore: ring.risk_score,
                patternType: pType,
            });
        });

        // Edges: chains are sequential, cycles are circular
        if (isChain) {
            for (let i = 0; i < members.length - 1; i++) {
                links.push({
                    source: members[i], target: members[i + 1],
                    pattern: pType, ring_id: ring.ring_id, isPeel: true,
                    hopIndex: i, totalHops: members.length,
                });
            }
        } else {
            for (let i = 0; i < members.length; i++) {
                const s = members[i], t = members[(i + 1) % members.length];
                if (s !== t) links.push({ source: s, target: t, pattern: pType, ring_id: ring.ring_id, isPeel: false });
            }
        }
    });

    return { nodes: Array.from(nodeMap.values()), links, hopMap };
}

function buildDegreeMap(links) {
    const inDegree = {};
    links.forEach(l => {
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        inDegree[t] = (inDegree[t] || 0) + 1;
    });
    return inDegree;
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
const NODE_LIMIT = 500;

export default function NetworkGraph({ fraudRings, suspiciousAccounts, onNodeSelect, highlightRing }) {
    const fgRef = useRef();
    const containerRef = useRef();
    const [dims, setDims] = useState({ w: 900, h: 500 });
    const [selectedNodeId, setSelectedNodeId] = useState(null);

    // Set of highlighted node IDs (from selected ring)
    const highlightedIds = useMemo(() => {
        if (!highlightRing) return null;
        return new Set(highlightRing.member_accounts?.map(String) ?? []);
    }, [highlightRing]);

    const { nodes: allNodes, links: allLinks, hopMap } = useMemo(
        () => buildGraph(fraudRings, suspiciousAccounts),
        [fraudRings, suspiciousAccounts]
    );

    // Cap nodes to prevent browser freeze on large datasets
    const truncated = allNodes.length > NODE_LIMIT;
    const nodes = truncated ? allNodes.slice(0, NODE_LIMIT) : allNodes;
    const nodeIdSet = useMemo(() => new Set(nodes.map(n => n.id)), [nodes]);
    const links = truncated
        ? allLinks.filter(l => {
            const s = typeof l.source === 'object' ? l.source.id : l.source;
            const t = typeof l.target === 'object' ? l.target.id : l.target;
            return nodeIdSet.has(s) && nodeIdSet.has(t);
          })
        : allLinks;

    const graphData = useMemo(() => ({ nodes, links }), [nodes, links]);
    const degreeMap = useMemo(() => buildDegreeMap(links), [links]);

    /* ── Responsive sizing ── */
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => {
            setDims({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    /* ── Auto-fit — smaller padding = nodes appear bigger ── */
    useEffect(() => {
        const t = setTimeout(() => fgRef.current?.zoomToFit(400, 30), 600);
        return () => clearTimeout(t);
    }, [graphData]);

    /* ── Zoom to highlighted ring when selection changes ── */
    useEffect(() => {
        if (!highlightedIds || highlightedIds.size === 0 || !fgRef.current) return;
        // Wait one tick for graph to settle
        const t = setTimeout(() => {
            const fg = fgRef.current;
            const graphNodes = fg.graphData().nodes;
            const selected = graphNodes.filter(n => highlightedIds.has(String(n.id)) && isFinite(n.x) && isFinite(n.y));
            if (selected.length === 0) return;

            // Compute centroid
            const cx = selected.reduce((s, n) => s + n.x, 0) / selected.length;
            const cy = selected.reduce((s, n) => s + n.y, 0) / selected.length;

            // Compute bounding box to set appropriate zoom
            const xs = selected.map(n => n.x);
            const ys = selected.map(n => n.y);
            const spanX = Math.max(...xs) - Math.min(...xs) || 100;
            const spanY = Math.max(...ys) - Math.min(...ys) || 100;
            const fitZoom = Math.min(6, Math.max(1.5, Math.min(dims.w, dims.h) / (Math.max(spanX, spanY) + 80)));

            fg.centerAt(cx, cy, 700);
            fg.zoom(fitZoom, 700);
        }, 900);
        return () => clearTimeout(t);
    }, [highlightedIds, dims]);

    /* ── Clear node selection when ring focus changes ── */
    useEffect(() => {
        setSelectedNodeId(null);
    }, [highlightedIds]);

    /* ── Node click → highlight + zoom ── */
    const handleNodeClick = useCallback((node) => {
        const hops = hopMap[node.id] || [];
        const inDeg = degreeMap[node.id] || 0;
        const isLikelyDest = node.isChainEnd && inDeg >= 5;
        onNodeSelect?.({ nodeId: node.id, score: node.score, pattern: node.pattern, hops, inDegree: inDeg, isLikelyDest });

        setSelectedNodeId(node.id);
        if (fgRef.current && isFinite(node.x) && isFinite(node.y)) {
            fgRef.current.centerAt(node.x, node.y, 600);
            fgRef.current.zoom(5, 600);
        }
    }, [hopMap, degreeMap, onNodeSelect]);

    /* ── Empty state ── */
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

    /* ── Pattern breakdown for pills ── */
    const patternCounts = {};
    fraudRings.forEach(r => { patternCounts[r.pattern_type] = (patternCounts[r.pattern_type] || 0) + 1; });

    return (
        <div ref={containerRef} style={{
            position: 'relative', background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 12,
            overflow: 'hidden', flex: 1, minHeight: 0,
        }}>
            {/* ── Top-left: pattern pills (non-interactive) ── */}
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 6, flexWrap: 'wrap', pointerEvents: 'none' }}>
                {Object.entries(patternCounts).map(([p, n]) => (
                    <span key={p} style={pill('#00E5FF')}>{n} {p}{n > 1 ? 's' : ''}</span>
                ))}
            </div>

            {/* ── Top-right: node/edge count + truncation warning ── */}
            <div style={{
                position: 'absolute', top: 12, right: 12, zIndex: 10,
                background: 'rgba(0,229,255,0.08)', border: `1px solid ${truncated ? 'rgba(255,165,42,0.5)' : 'rgba(0,229,255,0.2)'}`,
                borderRadius: 6, padding: '4px 10px',
                fontSize: 11, fontFamily: 'monospace', color: truncated ? 'var(--amber)' : '#00E5FF',
                pointerEvents: 'none',
            }}>
                {nodes.length} nodes · {links.length} edges
                {truncated && ` (capped from ${allNodes.length})`}
            </div>

            {/* ── Bottom-left: TRAFFIC LIGHT legend (non-interactive) ── */}
            <div style={{
                position: 'absolute', bottom: 32, left: 12, zIndex: 10,
                background: 'rgba(8,8,15,0.9)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 12px', backdropFilter: 'blur(10px)',
                pointerEvents: 'none',
            }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: 8 }}>
                    LEGEND
                </p>
                {[
                    { color: GREEN, label: 'Source (origin)' },
                    { color: RED, label: 'Suspicious node' },
                ].map(({ color, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--t2)' }}>{label}</span>
                    </div>
                ))}
            </div>

            {/* ── Bottom hint (non-interactive) ── */}
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', zIndex: 10, pointerEvents: 'none' }}>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                    Click any node to inspect · Green→Yellow→Red = money flow path
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

                /* ── Nodes: Green = source origin, Red = suspicious ── */
                nodeRelSize={8}
                nodeVal={n => isSource(n) ? 1.2 : 1.5}
                nodeColor={n => {
                    const base = nodeColorFn(n);
                    // Node selected: highlight it, dim everything else
                    if (selectedNodeId) {
                        return String(n.id) === String(selectedNodeId) ? base : base + '28';
                    }
                    // Ring selected: highlight ring members, dim rest
                    if (highlightedIds) {
                        return highlightedIds.has(String(n.id)) ? base : base + '30';
                    }
                    return base;
                }}
                nodeLabel={n => {
                    const roleName = isSource(n) ? '🟢 Source (origin)' : '🔴 Suspicious';
                    const base = `${n.id}\n${roleName}\nPattern: ${n.pattern || 'unknown'}\nScore: ${n.score}`;
                    return (n.isPeelNode && n.hopIndex != null)
                        ? `${base}\n─ Step ${n.hopIndex + 1} of ${n.totalHops}`
                        : base;
                }}

                /* ── Links: fade non-ring edges when ring is selected ── */
                linkColor={link => {
                    if (!highlightedIds) return `${EDGE_COLOR}70`;
                    const srcIn = highlightedIds.has(String(link.source?.id ?? link.source));
                    const tgtIn = highlightedIds.has(String(link.target?.id ?? link.target));
                    return srcIn && tgtIn ? `${EDGE_COLOR}CC` : `${EDGE_COLOR}18`;
                }}
                linkWidth={link => {
                    if (!highlightedIds) return 1.5;
                    const srcIn = highlightedIds.has(String(link.source?.id ?? link.source));
                    const tgtIn = highlightedIds.has(String(link.target?.id ?? link.target));
                    return srcIn && tgtIn ? 2.5 : 0.6;
                }}
                linkDirectionalParticles={link => {
                    if (!highlightedIds) return 1;  // always show 1 particle — visible flow at all times
                    const srcIn = highlightedIds.has(String(link.source?.id ?? link.source));
                    const tgtIn = highlightedIds.has(String(link.target?.id ?? link.target));
                    return srcIn && tgtIn ? 4 : 0;
                }}
                linkDirectionalParticleWidth={2.5}
                linkDirectionalParticleColor={() => EDGE_COLOR}
                linkDirectionalParticleSpeed={0.006}

                cooldownTicks={120}
                onEngineStop={() => !highlightedIds && fgRef.current?.zoomToFit(400, 30)}
                onBackgroundClick={() => {
                    setSelectedNodeId(null);
                    onNodeSelect?.(null);
                }}

                /* ── Node canvas: glow for highlighted nodes + labels ── */
                nodeCanvasObjectMode={() => 'before'}
                nodeCanvasObject={(node, ctx, globalScale) => {
                    if (!isFinite(node.x) || !isFinite(node.y)) return;
                    const color = nodeColorFn(node);
                    const isHighlighted = highlightedIds?.has(String(node.id));
                    const isSelected = String(node.id) === String(selectedNodeId);
                    const radius = 10;

                    /* ── White selection ring for clicked node ── */
                    if (isSelected) {
                        // Outer white glow
                        const grd = ctx.createRadialGradient(node.x, node.y, radius * 0.8, node.x, node.y, radius * 4);
                        grd.addColorStop(0, 'rgba(255,255,255,0.35)');
                        grd.addColorStop(0.5, 'rgba(255,255,255,0.10)');
                        grd.addColorStop(1, 'rgba(255,255,255,0)');
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius * 4, 0, Math.PI * 2);
                        ctx.fillStyle = grd;
                        ctx.fill();

                        // Solid white ring
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius * 1.9, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
                        ctx.lineWidth = 2.2;
                        ctx.stroke();

                        // Second inner ring in node color
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius * 1.45, 0, Math.PI * 2);
                        ctx.strokeStyle = color + 'CC';
                        ctx.lineWidth = 1.2;
                        ctx.stroke();
                    }

                    /* ── Glow halo for highlighted ring nodes ── */
                    if (isHighlighted && !isSelected) {
                        // Outer soft glow
                        const grd = ctx.createRadialGradient(node.x, node.y, radius * 0.5, node.x, node.y, radius * 3);
                        grd.addColorStop(0, color + 'CC');
                        grd.addColorStop(0.4, color + '55');
                        grd.addColorStop(1, color + '00');
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2);
                        ctx.fillStyle = grd;
                        ctx.fill();

                        // Sharp inner ring
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius * 1.4, 0, Math.PI * 2);
                        ctx.strokeStyle = color + 'DD';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }

                    /* ── Labels at high zoom, always for selected/highlighted ── */
                    if (globalScale >= 2.0 || isHighlighted || isSelected) {
                        const fs = Math.max(6, 9 / globalScale);
                        ctx.font = `${isSelected ? 'bold' : 'bold'} ${fs}px monospace`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'top';
                        ctx.fillStyle = isSelected
                            ? 'rgba(255,255,255,1.0)'
                            : isHighlighted
                                ? 'rgba(255,255,255,0.9)'
                                : 'rgba(255,255,255,0.55)';
                        ctx.fillText(node.id, node.x, node.y + 10);
                    }
                }}
            />

        </div>
    );
}

/* Pill badge helper */
function pill(color) {
    return {
        fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
        padding: '3px 9px', borderRadius: 5,
        background: `${color}18`, border: `1px solid ${color}40`, color,
        pointerEvents: 'none',
    };
}
