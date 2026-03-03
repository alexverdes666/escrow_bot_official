'use client';

import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton';
import { useAuthStore } from '@/lib/auth';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Shield, Loader2 } from 'lucide-react';

function LoginContent() {
  const { user, isLoading } = useAuthStore();
  const login = useAuthStore((s) => s.login);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [botLoginStatus, setBotLoginStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/deals');
    }
  }, [user, isLoading, router]);

  // Handle bot-based login token
  useEffect(() => {
    const token = searchParams.get('token');
    if (!token || botLoginStatus !== 'idle') return;

    setBotLoginStatus('loading');

    api.post('/auth/bot-login', { token })
      .then(({ data }) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        useAuthStore.setState({ user: data.user, token: data.token, isLoading: false });
        router.push('/deals');
      })
      .catch(() => {
        setBotLoginStatus('error');
      });
  }, [searchParams, router, botLoginStatus]);

  if (botLoginStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary-600 animate-spin" />
          <h1 className="text-2xl font-bold mb-2">Logging you in...</h1>
          <p className="text-gray-500">Please wait.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-primary-600" />
        <h1 className="text-2xl font-bold mb-2">Login to Escrow Dashboard</h1>
        <p className="text-gray-500 mb-8">
          Sign in with your Telegram account to view and manage your deals.
        </p>

        {botLoginStatus === 'error' && (
          <div className="bg-red-50 text-red-600 rounded-lg p-3 mb-6 text-sm">
            Login link expired or already used. Use <code>/login</code> in the bot to get a new one.
          </div>
        )}

        <TelegramLoginButton />

        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-gray-500 mb-2">Widget not loading?</p>
          <p className="text-sm text-gray-600">
            Send <code className="bg-gray-100 px-2 py-0.5 rounded">/login</code> to{' '}
            <a
              href={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}`}
              target="_blank"
              className="text-primary-600 font-medium hover:underline"
            >
              @{process.env.NEXT_PUBLIC_BOT_USERNAME}
            </a>{' '}
            on Telegram for a direct login link.
          </p>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          By logging in, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
