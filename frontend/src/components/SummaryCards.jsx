import React from 'react';

const CARDS = [
    {
        key: 'total_accounts_analyzed',
        label: 'NODES',
        icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="5" r="2" />
                <circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
                <path d="M12 9 19 7M12 9 5 7M12 15 5 17M12 15 19 17" />
            </svg>
        ),
        color: 'var(--cyan)',
    },
    {
        key: 'fraud_rings_detected',
        label: 'CHAINS',
        icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth={2}>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
        ),
        color: 'var(--purple)',
    },
    {
        key: 'suspicious_accounts_flagged',
        label: 'ILLICIT',
        icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth={2}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        ),
        color: 'var(--red)',
    },
    {
        key: 'processing_time_seconds',
        label: 'PROC. TIME',
        icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth={2}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
        ),
        color: 'var(--amber)',
        format: (v) => `${v}s`,
    },
];

export default function SummaryCards({ summary }) {
    if (!summary) return null;
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
        }}>
            {CARDS.map(({ key, label, icon, color, format }) => {
                const val = summary[key] ?? 0;
                return (
                    <div key={key} className="stat-card anim-slide">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            {icon}
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--t3)' }}>
                                {label}
                            </span>
                        </div>
                        <p style={{
                            fontSize: 28,
                            fontWeight: 800,
                            color,
                            fontFamily: "'JetBrains Mono', monospace",
                            lineHeight: 1,
                        }}>
                            {format ? format(val) : val.toLocaleString()}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}
