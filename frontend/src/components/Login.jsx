import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000';

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Reset form fields when component mounts (e.g., after logout)
  useEffect(() => {
    setUsername('');
    setPassword('');
    setError(null);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/api/login`, {
        username: username.trim(),
        password,
      });
      if (data?.success && data?.user) {
        localStorage.setItem('rift_user', data.user);
        setLoading(false);
        setRedirecting(true);
        // Reset form fields immediately after successful login
        setUsername('');
        setPassword('');
        setError(null);
        // Small delay ensures "Redirecting..." renders before state change
        setTimeout(() => {
          onSuccess(data.user);
        }, 100);
      } else {
        setError('Invalid response from server.');
        setLoading(false);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Login failed. Is the backend running?');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      animation: 'appFadeIn 0.25s ease-out',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        padding: 32,
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'var(--bg2)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--t1)',
            marginBottom: 6,
          }}>
            Crypto Forensics
          </h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>
            Money Laundering Detection
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--t3)',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}>
              USERNAME
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoComplete="username"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--t1)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--t3)',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--t1)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(255,77,109,0.1)',
              border: '1px solid rgba(255,77,109,0.3)',
              color: 'var(--red)',
              fontSize: 12,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || redirecting}
            style={{
              padding: '12px 20px',
              borderRadius: 8,
              border: '1px solid var(--cyan-border)',
              background: 'rgba(0,229,255,0.12)',
              color: 'var(--cyan)',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading || redirecting ? 'not-allowed' : 'pointer',
              opacity: loading || redirecting ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {redirecting ? 'Redirecting…' : loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{
          marginTop: 20,
          fontSize: 11,
          color: 'var(--t3)',
          textAlign: 'center',
        }}>
          Authorized users only
        </p>
      </div>
    </div>
  );
}
