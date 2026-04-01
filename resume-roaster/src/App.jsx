import { useState } from 'react'
import ResumeInput from './components/ResumeInput'
import RoastResult from './components/RoastResult'
import LoadingState from './components/LoadingState'

const FEATURES = [
  { icon: '🎯', title: 'Section Scores', desc: 'Detailed breakdown of every resume section' },
  { icon: '🔥', title: 'Savage Roast', desc: 'Brutally honest feedback you actually need' },
  { icon: '🩹', title: 'Actionable Fixes', desc: 'Top 3 things to fix right now' },
  { icon: '💚', title: 'Real Compliment', desc: "We'll find something nice to say. Probably." },
]

const STATS = [
  { value: '10K+', label: 'Resumes Roasted' },
  { value: '< 15s', label: 'Average Response' },
  { value: '4.8/5', label: 'User Rating' },
]

export default function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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

      const data = await res.json()
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
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener"
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.02 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {!result && !loading && (
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

                {/* Social proof */}
                <div className="flex items-center justify-center gap-8 sm:gap-12 mb-16 fade-in stagger-3">
                  {STATS.map(s => (
                    <div key={s.label} className="text-center">
                      <div className="text-2xl font-extrabold text-white">{s.value}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
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
            <span>Your data is never stored</span>
          </div>
          <div className="text-sm text-zinc-600">
            Built with Claude AI by passionate developers
          </div>
        </div>
      </footer>
    </div>
  )
}
