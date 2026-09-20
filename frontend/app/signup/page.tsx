'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUp } from 'aws-amplify/auth';
import { Icon } from '@/components/ui/Icon';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { isSignUpComplete, nextStep } = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
          },
        },
      });

      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        router.push(`/signup/verify?email=${encodeURIComponent(email)}`);
      } else if (isSignUpComplete) {
        router.push('/login');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up.');
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
          <h2 style={{ fontSize: '24px', fontWeight: 500, margin: '0' }}>Create an account</h2>
          <p style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '14px' }}>Start tracking evidence in your workspace</p>
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>
          Already have an account? <Link href="/login" style={{ color: '#fff' }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
