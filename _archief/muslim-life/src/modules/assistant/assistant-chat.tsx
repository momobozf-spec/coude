'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowUp, RotateCcw, Sparkles, Square } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { Markdown } from '@/modules/assistant/markdown'
import { PlanPreview } from '@/modules/assistant/plan-preview'
import { generatePlanAction } from '@/modules/assistant/actions'
import type { PlanView } from '@/server/modules/assistant/plan-generator.service'
import { cn } from '@/lib/utils'

export interface ChatMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  isDemoProvider?: boolean
}

/** Drawn from the shared allowlist — never a model-chosen name. */
const QUICK_ACTIONS = [
  { action: 'CREATE_WEEKLY_PLAN', label: 'Plan my week', type: 'WEEKLY' as const },
  { action: 'CREATE_RAMADAN_PLAN', label: 'Ramadan plan', type: 'RAMADAN' as const },
  { action: 'CREATE_TRAVEL_PLAN', label: 'Travel plan', type: 'TRAVEL' as const },
] as const

interface AssistantChatProps {
  conversationId: string | null
  initialMessages: ChatMessage[]
  messagesRemaining: number
  generatorsRemaining: number
  isDemoProvider: boolean
}

export function AssistantChat({
  conversationId: initialConversationId,
  initialMessages,
  messagesRemaining,
  generatorsRemaining,
  isDemoProvider,
}: AssistantChatProps) {
  const router = useRouter()

  const [conversationId, setConversationId] = useState(initialConversationId)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<PlanView | null>(null)
  const [generating, setGenerating] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    // Follow the stream without hijacking the page — the container scrolls,
    // not the window.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  async function send(text: string) {
    const content = text.trim()
    if (content.length === 0 || streaming) return

    setError(null)
    setDraft('')
    setStreamedText('')
    setStreaming(true)

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'USER',
      content,
    }
    setMessages((current) => [...current, optimistic])
    scrollToBottom()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/assistant/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: conversationId ?? undefined, message: content }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error?.message ?? 'The assistant is unavailable right now.')
      }

      if (!response.body) throw new Error('The assistant returned no response.')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        let boundary = buffer.indexOf('\n\n')
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          boundary = buffer.indexOf('\n\n')

          if (!frame.startsWith('data:')) continue

          let event: Record<string, unknown>
          try {
            event = JSON.parse(frame.slice(5).trim())
          } catch {
            continue
          }

          if (event.type === 'start' && typeof event.conversationId === 'string') {
            setConversationId(event.conversationId)
          }

          if (event.type === 'delta' && typeof event.text === 'string') {
            accumulated += event.text
            setStreamedText(accumulated)
            scrollToBottom()
          }

          if (event.type === 'done' && typeof event.content === 'string') {
            // The server's final text is authoritative — it carries the
            // disclaimer, which is applied after generation.
            setMessages((current) => [
              ...current,
              {
                id: `assistant-${Date.now()}`,
                role: 'ASSISTANT',
                content: event.content as string,
                isDemoProvider: Boolean(event.isDemoProvider),
              },
            ])
            setStreamedText('')
          }

          if (event.type === 'error' && typeof event.message === 'string') {
            setError(event.message)
            setStreamedText('')
          }
        }
      }

      router.refresh()
    } catch (caught) {
      if (caught instanceof Error && caught.name === 'AbortError') {
        // Cancelled by the member. The turn is still persisted server-side.
        setStreamedText('')
      } else {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
      scrollToBottom()
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  function generate(type: (typeof QUICK_ACTIONS)[number]['type']) {
    if (generating) return

    setGenerating(true)
    setError(null)

    void (async () => {
      const payload =
        type === 'TRAVEL'
          ? { type, destination: 'my destination' }
          : type === 'RAMADAN'
            ? { type }
            : { type }

      const result = await generatePlanAction(payload)
      setGenerating(false)

      if (!result.ok) {
        toast.error(result.message)
        setError(result.message)
        return
      }

      setPlan(result.data)
      scrollToBottom()
    })()
  }

  const outOfMessages = messagesRemaining <= 0

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col gap-4">
      {isDemoProvider ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-sunken px-4 py-3">
          <Sparkles className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Demo assistant.</span> No live model is
            connected, so replies are canned. Plan generation and the planner integration below are
            real.
          </p>
        </div>
      ) : null}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="scrollbar-subtle flex-1 space-y-4 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.length === 0 && !streamedText ? (
          <Card className="px-5 py-10 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-primary-subtle">
              <Sparkles className="size-5 text-primary-subtle-foreground" aria-hidden />
            </span>
            <p className="mt-4 text-sm font-medium">What are you working on?</p>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              I can help you shape a week, prepare for a trip or get ready for Ramadan. Anything I
              suggest goes into your planner only after you review it.
            </p>
          </Card>
        ) : null}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {streamedText ? (
          <MessageBubble
            message={{ id: 'streaming', role: 'ASSISTANT', content: streamedText }}
            streaming
          />
        ) : null}

        {plan ? (
          <PlanPreview
            plan={plan}
            onApplied={() => {
              setPlan(null)
              router.refresh()
            }}
            onDismiss={() => setPlan(null)}
          />
        ) : null}

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-subtle px-3.5 py-3 text-sm text-danger"
          >
            <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p>{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1.5 h-7 px-2 text-danger"
                onClick={() => {
                  const last = [...messages].reverse().find((message) => message.role === 'USER')
                  if (last) void send(last.content)
                }}
              >
                <RotateCcw className="size-3" />
                Try again
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div className="space-y-3">
        <div className="scrollbar-subtle -mx-1 flex gap-2 overflow-x-auto px-1">
          {QUICK_ACTIONS.map((quick) => (
            <button
              key={quick.action}
              type="button"
              disabled={generating || generatorsRemaining <= 0}
              onClick={() => generate(quick.type)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-medium transition-colors',
                'hover:border-border-strong hover:text-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'text-muted-foreground',
              )}
            >
              <Sparkles className="size-3" aria-hidden />
              {quick.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void send(draft)
          }}
          className="relative"
        >
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send(draft)
              }
            }}
            placeholder={outOfMessages ? 'No messages left this month' : 'Ask Muslim Life…'}
            rows={2}
            maxLength={4000}
            disabled={streaming || outOfMessages}
            aria-label="Message the assistant"
            className="min-h-20 resize-none pe-14"
          />

          <div className="absolute bottom-2.5 end-2.5">
            {streaming ? (
              <Button type="button" size="icon" variant="secondary" onClick={stop} aria-label="Stop">
                <Square className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={draft.trim().length === 0 || outOfMessages}
                aria-label="Send"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.6875rem] text-muted-foreground">
            Not a scholar. For religious rulings, ask a qualified person.
          </p>
          <Badge variant={outOfMessages ? 'warning' : 'outline'} size="sm">
            {messagesRemaining} message{messagesRemaining === 1 ? '' : 's'} left
          </Badge>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  if (message.role === 'USER') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-ee-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-subtle">
        <Sparkles className="size-3.5 text-primary-subtle-foreground" aria-hidden />
      </div>
      <div className="min-w-0 max-w-[90%] rounded-2xl rounded-ss-md bg-muted px-4 py-3">
        <Markdown content={message.content} />
        {streaming ? (
          <span className="mt-1 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-muted-foreground align-middle" />
        ) : null}
      </div>
    </div>
  )
}
