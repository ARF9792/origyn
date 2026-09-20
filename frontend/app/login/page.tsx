'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'aws-amplify/auth';
import { Icon } from '@/components/ui/Icon';
import '@/styles/workspace.css'; // ensure workspace CSS is loaded for UI elements if needed, or global

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { isSignedIn, nextStep } = await signIn({ username: email, password });
      
      if (isSignedIn) {
        router.push('/workspace');
      } else {
        // Handle next steps like MFA if necessary
        console.log('Login next step:', nextStep);
        if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
          router.push(`/signup/verify?email=${encodeURIComponent(email)}`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-layout" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="product-window" style={{ width: '100%', maxWidth: '420px', padding: '40px', background: 'linear-gradient(130deg, #191a1d, #111214 65%)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" className="brand" style={{ justifyContent: 'center', marginBottom: '16px', display: 'flex' }}>
            <span className="brand-symbol" /> Origyn
          </Link>
          <h2 style={{ fontSize: '24px', fontWeight: 500, margin: '0' }}>Welcome back</h2>
          <p style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '14px' }}>Sign in to access your workspace</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: '#0b0c0d',
                color: 'var(--text)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: '#0b0c0d',
                color: 'var(--text)',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{ padding: '12px', background: 'rgba(207, 128, 128, 0.1)', border: '1px solid rgba(207, 128, 128, 0.2)', borderRadius: '8px', color: '#d5a5a5', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="button primary"
            disabled={isLoading}
            style={{ marginTop: '8px', width: '100%', justifyContent: 'center', padding: '14px', background: '#fff', color: '#111' }}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>
          Don't have an account? <Link href="/signup" style={{ color: '#fff' }}>Sign up</Link>
        </div>
      </div>
    </div>
  );
}
