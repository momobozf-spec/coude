import { useState, useRef, useCallback } from 'react'

export default function ResumeInput({ onSubmit, error }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('paste')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const handleFile = useCallback((f) => {
    if (f && (f.type === 'application/pdf' || f.type === 'text/plain' || f.name.endsWith('.txt'))) {
      setFile(f)
      setMode('upload')
    }
  }, [])

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragging(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (mode === 'upload' && file) {
      onSubmit(null, file)
    } else if (mode === 'paste' && text.trim()) {
      onSubmit(text, null)
    }
  }

  function clearFile() {
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const charCount = text.trim().length
  const canSubmit = (mode === 'paste' && charCount >= 50) || (mode === 'upload' && file)

  return (
    <form onSubmit={handleSubmit}>
      {/* Card wrapper */}
      <div className="glass rounded-2xl p-6 sm:p-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-surface-800 rounded-xl p-1">
          {[
            { id: 'paste', icon: '📝', label: 'Paste text' },
            { id: 'upload', icon: '📎', label: 'Upload file' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                mode === tab.id
                  ? 'bg-surface-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {mode === 'paste' ? (
          <div className="relative">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste your full resume text here...&#10;&#10;Include your experience, education, skills, and any other sections you want reviewed."
              rows={10}
              className="w-full bg-surface-800/80 border border-surface-600 rounded-xl p-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-flame-500/50 focus:ring-2 focus:ring-flame-500/10 resize-none transition-all leading-relaxed"
            />
            {/* Character counter */}
            <div className="flex items-center justify-between mt-2 px-1">
              <div className="text-xs text-zinc-600">
                {charCount < 50 && charCount > 0 && (
                  <span className="text-amber-500">Need at least 50 characters ({50 - charCount} more)</span>
                )}
              </div>
              <div className={`text-xs font-mono ${charCount >= 50 ? 'text-green-500' : 'text-zinc-600'}`}>
                {charCount} chars
              </div>
            </div>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !file && fileRef.current.click()}
            className={`relative w-full rounded-xl p-10 text-center transition-all duration-200 cursor-pointer ${
              dragging
                ? 'bg-flame-500/5 border-2 border-dashed border-flame-500/50'
                : file
                  ? 'bg-surface-800/80 border border-surface-600'
                  : 'bg-surface-800/80 border-2 border-dashed border-surface-500 hover:border-flame-500/30 hover:bg-surface-800'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt"
              onChange={e => handleFile(e.target.files[0])}
              className="hidden"
            />

            {file ? (
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-flame-500/10 flex items-center justify-center text-2xl">
                  📄
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">{file.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearFile() }}
                  className="ml-4 w-8 h-8 rounded-lg bg-surface-600 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-all cursor-pointer"
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <div className="text-4xl mb-4">
                  {dragging ? '🎯' : '📂'}
                </div>
                <p className="text-zinc-300 font-medium mb-1">
                  {dragging ? 'Drop it like it\'s hot' : 'Drag & drop your resume here'}
                </p>
                <p className="text-sm text-zinc-500">
                  or <span className="text-flame-400 hover:underline">browse files</span> — PDF, TXT (max 5MB)
                </p>
              </>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <span className="text-red-400 mt-0.5">⚠</span>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-6 w-full py-4 rounded-xl font-semibold text-base transition-all duration-200 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed bg-gradient-to-r from-flame-600 to-flame-500 hover:from-flame-500 hover:to-flame-400 active:scale-[0.98] text-white shadow-lg shadow-flame-600/25 hover:shadow-flame-500/35 flex items-center justify-center gap-2"
        >
          <span>🔥</span>
          <span>Roast My Resume</span>
        </button>

        {/* Trust line */}
        <p className="text-center text-xs text-zinc-600 mt-4 flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Your resume is processed once and never stored
        </p>
      </div>
    </form>
  )
}
