import React from 'react';

const NAV = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
        ),
    },
    {
        id: 'forensic-map',
        label: 'Forensic Map',
        icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
        ),
    },
    {
        id: 'audit-logs',
        label: 'Audit Logs',
        icon: (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
        ),
    },
];

export default function Sidebar({ active, setActive }) {
    return (
        <aside style={{
            width: 220,
            minWidth: 220,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(8,8,15,0.95)',
            borderRight: '1px solid var(--border)',
        }}>
            {/* Brand */}
            <div style={{
                padding: '18px 16px 14px',
                borderBottom: '1px solid var(--border)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 8,
                        background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth={2}>
                            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--cyan)', letterSpacing: '0.04em' }}>
                            Crypto Forensics
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>
                            Money Laundering Detection
                        </div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.1em', padding: '4px 6px 8px' }}>
                    NAVIGATION
                </p>
                {NAV.map(({ id, label, icon }) => (
                    <button
                        key={id}
                        className={`nav-item${active === id ? ' active' : ''}`}
                        onClick={() => setActive(id)}
                    >
                        {icon}
                        {label}
                    </button>
                ))}
            </nav>

            {/* Footer */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'monospace' }}>RIFT v2.6.0-alpha</p>
            </div>
        </aside>
    );
}
