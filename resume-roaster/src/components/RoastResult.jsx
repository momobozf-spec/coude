import { useState } from 'react'

/* ── Score Ring ── */
function ScoreRing({ score, size = 140 }) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  function getColor(s) {
    if (s >= 80) return ['#22c55e', '#4ade80']
    if (s >= 60) return ['#f97316', '#fb923c']
    if (s >= 40) return ['#eab308', '#facc15']
    return ['#ef4444', '#f87171']
  }

  const [c1, c2] = getColor(score)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="transform -rotate-90" width={size} height={size}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#27272a" strokeWidth="6" />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="score-ring"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-black text-white font-mono">{score}</span>
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">score</span>
      </div>
    </div>
  )
}

/* ── Section Bar ── */
function SectionCard({ name, score, comment, index }) {
  const labels = {
    experience: { icon: '💼', label: 'Experience' },
    skills: { icon: '🛠', label: 'Skills' },
    education: { icon: '🎓', label: 'Education' },
    formatting: { icon: '📐', label: 'Formatting' },
    impact: { icon: '💥', label: 'Impact' },
  }

  function getBarColor(s) {
    if (s >= 80) return 'from-green-500 to-green-400'
    if (s >= 60) return 'from-flame-500 to-flame-400'
    if (s >= 40) return 'from-yellow-500 to-yellow-400'
    return 'from-red-500 to-red-400'
  }

  const { icon, label } = labels[name] || { icon: '📋', label: name }

  return (
    <div className={`glass-light rounded-xl p-5 hover:bg-surface-700/50 transition-all duration-300 slide-up stagger-${index + 3}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-semibold text-zinc-200">{label}</span>
        </div>
        <span className="text-sm font-bold text-white font-mono">{score}</span>
      </div>
      <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getBarColor(score)} transition-all duration-1000 ease-out`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">{comment}</p>
    </div>
  )
}

/* ── Copy Button ── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700 hover:bg-surface-600 text-xs text-zinc-400 hover:text-white transition-all cursor-pointer"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

/* ── Main Result ── */
export default function RoastResult({ data, onReset }) {
  function getGradeColor(grade) {
    if (grade === 'A') return 'text-green-400 bg-green-500/10 border-green-500/20'
    if (grade === 'B') return 'text-flame-400 bg-flame-500/10 border-flame-500/20'
    if (grade === 'C') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
    return 'text-red-400 bg-red-500/10 border-red-500/20'
  }

  const shareText = `🔥 My resume just got roasted!\n\nScore: ${data.overallScore}/100 (${data.grade})\n"${data.oneLiner}"\n\nTry it: Resume Roaster`

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero score card */}
      <div className="glass rounded-2xl p-8 sm:p-10 mb-8 text-center slide-up stagger-1">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
          <ScoreRing score={data.overallScore} />
          <div className="sm:text-left">
            <div className={`inline-flex items-center px-4 py-1.5 rounded-lg border text-3xl font-black ${getGradeColor(data.grade)}`}>
              Grade: {data.grade}
            </div>
            {data.oneLiner && (
              <p className="text-base text-zinc-400 mt-4 italic max-w-sm">
                "{data.oneLiner}"
              </p>
            )}
          </div>
        </div>

        {/* Share bar */}
        <div className="flex items-center justify-center gap-3 mt-8 pt-6 border-t border-surface-700">
          <CopyButton text={shareText} />
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-flame-500/10 hover:bg-flame-500/20 text-xs text-flame-400 hover:text-flame-300 transition-all cursor-pointer"
          >
            🔥 Roast another
          </button>
        </div>
      </div>

      {/* The Roast */}
      <div className="relative glass rounded-2xl p-6 sm:p-8 mb-8 overflow-hidden slide-up stagger-2">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-flame-600 via-red-500 to-flame-600" />
        <h3 className="text-base font-bold text-flame-400 mb-4 flex items-center gap-2">
          <span className="text-xl">🔥</span>
          The Roast
        </h3>
        <p className="text-zinc-200 leading-relaxed text-base">{data.roast}</p>
      </div>

      {/* Section Breakdown */}
      <div className="mb-8 slide-up stagger-3">
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-4 px-1">
          Section Breakdown
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(data.sections).map(([key, val], i) => (
            <SectionCard key={key} name={key} score={val.score} comment={val.comment} index={i} />
          ))}
        </div>
      </div>

      {/* Top Fixes */}
      <div className="glass rounded-2xl p-6 sm:p-8 mb-8 slide-up stagger-6">
        <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
          <span className="text-xl">🩹</span>
          Top 3 Critical Fixes
        </h3>
        <div className="space-y-4">
          {data.topFixes.map((fix, i) => (
            <div key={i} className="flex gap-4 items-start group">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-flame-500/10 group-hover:bg-flame-500/20 text-flame-400 flex items-center justify-center text-sm font-bold font-mono transition-colors">
                {i + 1}
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed pt-1.5">{fix}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Genuine Compliment */}
      <div className="relative glass rounded-2xl p-6 sm:p-8 overflow-hidden slide-up stagger-7">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-600 via-emerald-500 to-green-600" />
        <h3 className="text-base font-bold text-green-400 mb-3 flex items-center gap-2">
          <span className="text-xl">💚</span>
          Genuine Compliment
        </h3>
        <p className="text-zinc-200 leading-relaxed">{data.genuineCompliment}</p>
      </div>

      {/* Bottom CTA */}
      <div className="text-center mt-12 mb-8 slide-up stagger-8">
        <p className="text-sm text-zinc-500 mb-4">Ready to level up?</p>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-flame-600 to-flame-500 hover:from-flame-500 hover:to-flame-400 text-white font-semibold shadow-lg shadow-flame-600/20 transition-all active:scale-[0.98] cursor-pointer"
        >
          🔥 Roast Another Resume
        </button>
      </div>
    </div>
  )
}
