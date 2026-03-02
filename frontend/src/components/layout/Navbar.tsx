'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';
import { Shield, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary-600">
              <Shield className="w-6 h-6" />
              My Escrow Bot
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {user ? (
              <>
                <Link href="/deals" className="text-gray-600 hover:text-primary-600 font-medium">
                  Deals
                </Link>
                <Link href="/disputes" className="text-gray-600 hover:text-primary-600 font-medium">
                  Disputes
                </Link>
                <Link href="/profile" className="text-gray-600 hover:text-primary-600 font-medium">
                  Profile
                </Link>
                {user.role === 'admin' && (
                  <Link href="/admin" className="text-orange-600 hover:text-orange-700 font-medium">
                    Admin
                  </Link>
                )}
                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
                  <span className="text-sm text-gray-600">
                    {user.username ? `@${user.username}` : user.firstName}
                  </span>
                  <button
                    onClick={logout}
                    className="text-gray-400 hover:text-red-500"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium"
              >
                Login with Telegram
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden flex items-center"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-2">
          {user ? (
            <>
              <Link href="/deals" className="block py-2 text-gray-600" onClick={() => setMobileOpen(false)}>Deals</Link>
              <Link href="/disputes" className="block py-2 text-gray-600" onClick={() => setMobileOpen(false)}>Disputes</Link>
              <Link href="/profile" className="block py-2 text-gray-600" onClick={() => setMobileOpen(false)}>Profile</Link>
              {user.role === 'admin' && (
                <Link href="/admin" className="block py-2 text-orange-600" onClick={() => setMobileOpen(false)}>Admin</Link>
              )}
              <button onClick={() => { logout(); setMobileOpen(false); }} className="block py-2 text-red-500">
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="block py-2 text-primary-600 font-medium" onClick={() => setMobileOpen(false)}>
              Login with Telegram
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
