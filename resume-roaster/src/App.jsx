import { useState } from 'react'
import ResumeInput from './components/ResumeInput'
import RoastResult from './components/RoastResult'
import LoadingState from './components/LoadingState'
import LegalPage from './components/LegalPage'
import { LEGAL } from './legal/config'

const FEATURES = [
  { icon: '🎯', title: 'Section Scores', desc: 'Detailed breakdown of every resume section' },
  { icon: '🔥', title: 'Savage Roast', desc: 'Brutally honest feedback you actually need' },
  { icon: '🩹', title: 'Actionable Fixes', desc: 'Top 3 things to fix right now' },
  { icon: '💚', title: 'Real Compliment', desc: "We'll find something nice to say. Probably." },
]

const LEGAL_PAGES = { '/privacy': 'privacy', '/terms': 'terms' }

export default function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const legalPage = LEGAL_PAGES[window.location.pathname.replace(/\/+$/, '')] || null

  async function handleSubmit(text, file) {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let res
      if (file) {
        const formData = new FormData()
        formData.append('file', file)
        res = await fetch('/api/roast', { method: 'POST', body: formData })
      } else {
        res = await fetch('/api/roast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        })
      }

      let data
      try {
        data = await res.json()
      } catch {
        throw new Error(res.status === 413 ? 'File or text too large.' : 'Something went wrong')
      }
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setResult(data)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setResult(null)
    setError(null)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-flame-600/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-flame-500/3 rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <header className="glass sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <span className="text-2xl transition-transform group-hover:scale-110 group-hover:rotate-12">🔥</span>
            <span className="text-lg font-bold tracking-tight">
              <span className="text-flame-400">Resume</span>
              <span className="text-white">Roaster</span>
            </span>
          </a>

          <nav className="flex items-center gap-6">
            {result && (
              <button
                onClick={handleReset}
                className="text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New roast
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {legalPage && <LegalPage page={legalPage} />}

        {!legalPage && !result && !loading && (
          <>
            {/* Hero Section */}
            <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
              <div className="text-center max-w-3xl mx-auto">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-flame-500/10 border border-flame-500/20 text-flame-400 text-sm font-medium mb-8 fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-flame-400 animate-pulse" />
                  Powered by Claude AI
                </div>

                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6 fade-in stagger-1">
                  <span className="text-white">Get your resume</span>
                  <br />
                  <span className="flame-glow text-transparent bg-clip-text gradient-bg">
                    brutally roasted
                  </span>
                </h1>

                <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto mb-12 fade-in stagger-2">
                  Upload your resume and receive instant AI-powered feedback.
                  Part Gordon Ramsay, part senior Google recruiter — scores,
                  savage roasts, and the fixes that actually matter.
                </p>

                <p className="text-xs text-zinc-500 mb-12 fade-in stagger-3">
                  Feedback is AI-generated and may be wrong. For self-review only.
                </p>
              </div>

              {/* Input Card */}
              <div className="max-w-2xl mx-auto fade-in stagger-4">
                <ResumeInput onSubmit={handleSubmit} error={error} />
              </div>
            </section>

            {/* Features */}
            <section className="max-w-6xl mx-auto px-6 py-20 border-t border-zinc-800/50">
              <h2 className="text-center text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-10">
                What you get
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {FEATURES.map((f, i) => (
                  <div
                    key={f.title}
                    className={`glass-light rounded-2xl p-6 hover:bg-surface-700/40 transition-all duration-300 group fade-in stagger-${i + 4}`}
                  >
                    <span className="text-3xl mb-4 block transition-transform group-hover:scale-110">{f.icon}</span>
                    <h3 className="font-semibold text-white mb-1">{f.title}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* How it works */}
            <section className="max-w-6xl mx-auto px-6 py-20 border-t border-zinc-800/50">
              <h2 className="text-center text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-12">
                How it works
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                {[
                  { step: '01', title: 'Paste or Upload', desc: 'Drop your resume as text or upload a PDF — we handle the rest.' },
                  { step: '02', title: 'AI Analysis', desc: 'Claude reads every line and evaluates experience, skills, impact, and formatting.' },
                  { step: '03', title: 'Get Results', desc: 'Receive your score, section breakdown, roast, and actionable fixes in seconds.' },
                ].map((item, i) => (
                  <div key={item.step} className={`text-center fade-in stagger-${i + 3}`}>
                    <div className="text-4xl font-black text-flame-500/20 mb-3 font-mono">{item.step}</div>
                    <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {loading && <LoadingState />}

        {result && (
          <section className="max-w-6xl mx-auto px-6 py-12">
            <RoastResult data={result} onReset={handleReset} />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/50 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>🔥</span>
            <span>Resume Roaster</span>
            <span className="text-zinc-700">·</span>
            <span>We don&apos;t store your resume</span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-zinc-500">
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/terms" className="hover:text-white">Terms</a>
            <a href={`mailto:${LEGAL.email}`} className="hover:text-white">Contact</a>
          </nav>
          <div className="text-xs text-zinc-600 text-center sm:text-right">
            &copy; {new Date().getFullYear()} {LEGAL.name} &middot; {LEGAL.companyNumber}
          </div>
        </div>
      </footer>
    </div>
  )
}
