'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export function TelegramLoginButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  useEffect(() => {
    // Define the callback globally
    (window as any).onTelegramAuth = async (user: any) => {
      try {
        await login(user);
        router.push('/deals');
      } catch (error) {
        console.error('Login failed:', error);
      }
    };

    // Create the Telegram widget script
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', process.env.NEXT_PUBLIC_BOT_USERNAME || '');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-radius', '8');
    script.async = true;

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [login, router]);

  return <div ref={containerRef} className="flex justify-center" />;
}
