import React from 'react';

export default function TopBar({ title, subtitle }) {
    return (
        <header style={{
            height: 54,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            background: 'rgba(8,8,15,0.9)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
        }}>
            {/* Left */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Graph node icon */}
                <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--red)', boxShadow: '0 0 8px var(--red)',
                }} />
                <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1)' }}>{title}</span>
                    {subtitle && (
                        <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 10 }}>
                            {subtitle}
                        </span>
                    )}
                </div>
            </div>

            {/* Right: profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Live dot */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="anim-pulse" style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: 'var(--green)', boxShadow: '0 0 6px var(--green)',
                        display: 'inline-block',
                    }} />
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--green)' }}>LIVE</span>
                </div>

                {/* Divider */}
                <div style={{ width: 1, height: 22, background: 'var(--border)' }} />

                {/* Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 30, height: 30, borderRadius: 7,
                        background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth={2}>
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </div>
                    <div style={{ lineHeight: 1.2 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Daksh</p>
                        <p style={{ fontSize: 10, color: 'var(--t3)' }}>Investigator</p>
                    </div>
                </div>
            </div>
        </header>
    );
}
