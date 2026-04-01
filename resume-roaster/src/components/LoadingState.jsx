import { useState, useEffect } from 'react'

const STEPS = [
  { msg: 'Parsing your resume...', icon: '📄' },
  { msg: 'Putting on the roasting gloves...', icon: '🧤' },
  { msg: 'Channeling Gordon Ramsay...', icon: '👨‍🍳' },
  { msg: 'Scoring each section...', icon: '📊' },
  { msg: 'Writing your roast...', icon: '🔥' },
  { msg: 'Finding something nice to say...', icon: '💚' },
  { msg: 'Almost there...', icon: '⏳' },
]

export default function LoadingState() {
  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStep(s => (s + 1) % STEPS.length)
    }, 2500)
    return () => clearInterval(stepTimer)
  }, [])

  useEffect(() => {
    const progTimer = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 8, 90))
    }, 400)
    return () => clearInterval(progTimer)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-32 px-6 fade-in">
      {/* Animated ring */}
      <div className="relative mb-10">
        <div className="w-24 h-24 rounded-full border-[3px] border-surface-700" />
        <div className="absolute inset-0 w-24 h-24 rounded-full border-[3px] border-transparent border-t-flame-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl" key={step}>
            {STEPS[step].icon}
          </span>
        </div>
        {/* Pulse ring */}
        <div className="absolute inset-0 w-24 h-24 rounded-full border border-flame-500/30" style={{ animation: 'pulse-ring 2s ease-out infinite' }} />
      </div>

      {/* Message */}
      <p className="text-lg text-zinc-200 font-medium mb-6 h-7 transition-all" key={step}>
        {STEPS[step].msg}
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-flame-600 to-flame-400 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-zinc-600 mt-2 text-center font-mono">{Math.round(progress)}%</p>
      </div>
    </div>
  )
}
