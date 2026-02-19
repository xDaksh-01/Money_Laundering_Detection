import React, { useCallback, useState } from 'react';
import axios from 'axios';

function Icon({ d, size = 16, color = 'currentColor', strokeWidth = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// Inline SVG icons
const UploadIcon = ({ size, color }) => (
  <svg width={size || 40} height={size || 40} viewBox="0 0 24 24" fill="none"
    stroke={color || 'var(--cyan)'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

const FileIcon = ({ size, color }) => (
  <svg width={size || 28} height={size || 28} viewBox="0 0 24 24" fill="none"
    stroke={color || 'var(--green)'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="anim-spin" width={44} height={44} viewBox="0 0 24 24" fill="none"
    stroke="var(--cyan)" strokeWidth={2} strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default function FileUpload({ onSuccess, isLoading, setIsLoading, setError }) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);

  const upload = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) { setError('Only CSV files are accepted.'); return; }
    setFileName(file.name);
    setError(null);
    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/process`, fd);
      onSuccess(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Upload failed. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, setIsLoading, setError]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    upload(e.dataTransfer.files[0]);
  }, [upload]);

  return (
    <div
      className={`drop-zone${dragOver ? ' over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => !isLoading && document.getElementById('csv-file').click()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '40px 24px',
        minHeight: 220,
        textAlign: 'center',
      }}
    >
      <input id="csv-file" type="file" accept=".csv" hidden onChange={e => upload(e.target.files[0])} />

      {isLoading ? (
        <>
          <SpinnerIcon />
          <div>
            <p style={{ color: 'var(--cyan)', fontWeight: 600, fontSize: 14 }}>Analyzing…</p>
            <p style={{ color: 'var(--t2)', fontSize: 12, marginTop: 4 }}>RIFT graph engine running</p>
          </div>
        </>
      ) : fileName ? (
        <>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--green-dim)', border: '1px solid rgba(0,230,118,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileIcon />
          </div>
          <div>
            <p style={{ color: 'var(--green)', fontWeight: 600, fontSize: 14 }}>File Ready</p>
            <p style={{ color: 'var(--t2)', fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}>{fileName}</p>
            <p style={{ color: 'var(--t3)', fontSize: 11, marginTop: 6 }}>Click or drop to replace</p>
          </div>
        </>
      ) : (
        <>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: dragOver ? 'rgba(0,229,255,0.12)' : 'rgba(0,229,255,0.06)',
            border: `2px solid ${dragOver ? 'var(--cyan)' : 'rgba(0,229,255,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}>
            <UploadIcon />
          </div>
          <div>
            <p style={{ color: 'var(--cyan)', fontWeight: 700, fontSize: 15 }}>
              Drop transaction CSV here
            </p>
            <p style={{ color: 'var(--t2)', fontSize: 12, marginTop: 6 }}>
              or <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>click to browse</span>
            </p>
            <p style={{ color: 'var(--t3)', fontSize: 11, fontFamily: 'monospace', marginTop: 10 }}>
              sender_id · receiver_id · amount · timestamp · transaction_id
            </p>
          </div>
        </>
      )}
    </div>
  );
}
