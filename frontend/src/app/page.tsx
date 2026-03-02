import Link from 'next/link';
import { Shield, Handshake, Scale, CheckCircle } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';

export default function LandingPage() {
  const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME;

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20">
          <div className="max-w-5xl mx-auto px-4 text-center">
            <Shield className="w-16 h-16 mx-auto mb-6 opacity-90" />
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Secure Escrow Deals on Telegram
            </h1>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Create safe deals between buyers and sellers with escrow protection.
              Funds are held until both parties agree — no scams, no disputes left unresolved.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a
                href={`https://t.me/${BOT_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-primary-700 px-8 py-3 rounded-lg font-bold text-lg hover:bg-primary-50 transition"
              >
                Open Bot on Telegram
              </a>
              <Link
                href="/login"
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-white/10 transition"
              >
                Login to Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Handshake className="w-10 h-10 text-primary-600" />,
                  title: '1. Create a Deal',
                  desc: 'Use the Telegram bot to set deal terms — amount, delivery deadline, payment type. Both parties agree.',
                },
                {
                  icon: <Shield className="w-10 h-10 text-primary-600" />,
                  title: '2. Secure Payment',
                  desc: 'Payment is tracked by the escrow system. Funds are frozen until delivery is confirmed.',
                },
                {
                  icon: <CheckCircle className="w-10 h-10 text-primary-600" />,
                  title: '3. Complete or Dispute',
                  desc: 'Buyer confirms delivery and funds are released. If issues arise, admin resolves the dispute fairly.',
                },
              ].map((step) => (
                <div key={step.title} className="text-center p-6 rounded-xl border border-gray-100 hover:shadow-lg transition">
                  <div className="flex justify-center mb-4">{step.icon}</div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-gray-600">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { title: 'Multiple Deal Types', desc: 'Full prepay, partial prepay, milestone-based, or custom terms.' },
                { title: 'Private & Group Support', desc: 'Start deals in private chat or in Telegram groups.' },
                { title: 'Dispute Resolution', desc: 'Admin reviews evidence and makes fair decisions on disputes.' },
                { title: 'Reputation System', desc: 'Build trust with a reputation score based on completed deals.' },
                { title: 'Auto-Release', desc: 'Funds auto-release after the dispute window if no issues reported.' },
                { title: 'Full Transparency', desc: 'Track every deal on the web dashboard with complete history.' },
              ].map((f) => (
                <div key={f.title} className="bg-white p-6 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
                  <p className="text-gray-600 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-primary-700 text-white text-center">
          <div className="max-w-3xl mx-auto px-4">
            <Scale className="w-12 h-12 mx-auto mb-4 opacity-80" />
            <h2 className="text-3xl font-bold mb-4">Ready to Make Safe Deals?</h2>
            <p className="text-primary-100 mb-6">Start using the escrow bot today and protect your transactions.</p>
            <a
              href={`https://t.me/${BOT_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-primary-700 px-8 py-3 rounded-lg font-bold text-lg hover:bg-primary-50 transition"
            >
              Start on Telegram
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
          <p>My Escrow Bot &copy; {new Date().getFullYear()}. All rights reserved.</p>
        </footer>
      </main>
    </>
  );
}
