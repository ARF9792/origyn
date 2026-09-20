'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmSignUp } from 'aws-amplify/auth';
import { Icon } from '@/components/ui/Icon';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultEmail = searchParams.get('email') || '';
  const defaultUsername = defaultEmail;

  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (defaultEmail) {
      setEmail(defaultEmail);
    }
  }, [defaultEmail]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { isSignUpComplete } = await confirmSignUp({
        username: defaultUsername,
        confirmationCode: code,
      });

      if (isSignUpComplete) {
        router.push('/login');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during verification.');
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
          <h2 style={{ fontSize: '24px', fontWeight: 500, margin: '0' }}>Verify your email</h2>
          <p style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '14px' }}>Enter the code sent to your email address.</p>
        </div>

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={!!defaultEmail}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: '#0b0c0d',
                color: 'var(--text)',
                outline: 'none',
                opacity: defaultEmail ? 0.6 : 1,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Verification code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="000000"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: '#0b0c0d',
                color: 'var(--text)',
                outline: 'none',
                letterSpacing: '4px',
                textAlign: 'center',
                fontSize: '18px',
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
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <VerifyForm />
    </Suspense>
  );
}
