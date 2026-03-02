import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'My Escrow Bot',
  description: 'Secure escrow deals via Telegram',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
