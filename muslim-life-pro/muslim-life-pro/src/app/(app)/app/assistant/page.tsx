import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageSquare, ShieldCheck, Sparkles } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AssistantChat, type ChatMessage } from '@/modules/assistant/assistant-chat'
import { requireActor } from '@/server/auth/actor'
import {
  getConversation,
  listConversations,
} from '@/server/modules/assistant/conversation.service'
import { getUsage } from '@/server/modules/assistant/usage.service'
import { isLiveProvider } from '@/server/integrations/ai'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Assistant',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const actor = await requireActor()
  const params = await searchParams

  const conversationId = typeof params.c === 'string' ? params.c : undefined

  const [conversations, usage] = await Promise.all([listConversations(actor), getUsage(actor)])

  let messages: ChatMessage[] = []
  let activeId: string | null = null

  if (conversationId) {
    try {
      const conversation = await getConversation(actor, conversationId)
      activeId = conversation.id
      messages = conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        isDemoProvider: message.isDemoProvider,
      }))
    } catch {
      // A stale or foreign id just starts a fresh conversation.
      activeId = null
    }
  }

  await track(actor.userId, ANALYTICS_EVENTS.AI_ASSISTANT_OPENED, {
    conversationCount: conversations.length,
    messagesRemaining: usage.messagesRemaining,
  })

  const live = isLiveProvider()

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('nav.assistant')}
        description="Turn what's coming up into a plan you can actually follow."
        action={
          conversations.length > 0 ? (
            <Button variant="secondary" size="sm" asChild>
              <Link href="/app/assistant">New chat</Link>
            </Button>
          ) : null
        }
      />

      {usage.generatorsRemaining <= 0 && usage.generatorLimit <= 0 ? (
        <Card variant="flat" className="border-accent/30 bg-accent-subtle p-4">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-accent-subtle-foreground">
            <Sparkles className="mt-px size-4 shrink-0" aria-hidden />
            <span>
              <span className="font-medium">Plan generators are a Premium feature.</span> You can
              still chat with the assistant on the free plan.
            </span>
          </p>
          <Button size="sm" className="mt-3" asChild>
            <Link href="/pricing">See Premium</Link>
          </Button>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_16rem]">
        <div className="min-w-0">
          <AssistantChat
            conversationId={activeId}
            initialMessages={messages}
            messagesRemaining={usage.messagesRemaining}
            generatorsRemaining={usage.generatorsRemaining}
            isDemoProvider={!live}
          />
        </div>

        <aside className="space-y-4 lg:order-last">
          {conversations.length > 0 ? (
            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <MessageSquare className="size-3.5" aria-hidden />
                Recent
              </h2>
              <ul className="mt-3 space-y-1">
                {conversations.slice(0, 8).map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      href={`/app/assistant?c=${conversation.id}`}
                      className={`block truncate rounded-lg px-2 py-2 text-xs transition-colors hover:bg-muted ${
                        conversation.id === activeId
                          ? 'bg-primary-subtle text-primary-subtle-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {conversation.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="p-4">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              This month
            </h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Messages</dt>
                <dd className="tabular-nums">
                  {usage.messageCount} / {usage.messageLimit}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Plans</dt>
                <dd className="tabular-nums">
                  {usage.generatorCount} / {usage.generatorLimit}
                </dd>
              </div>
            </dl>
            {actor.plan === 'FREE' ? (
              <Badge variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/pricing">Upgrade for more</Link>
              </Badge>
            ) : null}
          </Card>

          <Card variant="sunken" className="p-4">
            <p className="flex items-start gap-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                Muslim Life Assistant helps you organise your life. It is not a scholar and does not
                issue religious rulings. Nothing it suggests is added to your planner without your
                confirmation.
              </span>
            </p>
          </Card>
        </aside>
      </div>
    </div>
  )
}
