import { Fragment } from 'react'

/**
 * A deliberately small markdown renderer.
 *
 * Model output is untrusted. Rather than parsing it into HTML and then trying to
 * sanitise the result, this converts a restricted subset directly into React
 * elements — so there is no `dangerouslySetInnerHTML` anywhere, and raw HTML in
 * the model's output renders as literal text because React escapes it.
 *
 * Supported: headings, bullet and numbered lists, bold, italic, inline code,
 * fenced code, links, horizontal rules. Everything else is plain text.
 */

type Inline = { type: 'text' | 'bold' | 'italic' | 'code'; value: string } | { type: 'link'; value: string; href: string }

/** Only these schemes may become a link. `javascript:` and `data:` cannot. */
function safeHref(href: string): string | null {
  const trimmed = href.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^mailto:/i.test(trimmed)) return trimmed
  return null
}

function parseInline(text: string): Inline[] {
  const tokens: Inline[] = []
  // Order matters: code first, so `**` inside a code span is not treated as bold.
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g

  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      tokens.push({ type: 'text', value: text.slice(cursor, match.index) })
    }

    const token = match[0]

    if (token.startsWith('`')) {
      tokens.push({ type: 'code', value: token.slice(1, -1) })
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
      const href = linkMatch ? safeHref(linkMatch[2] ?? '') : null

      if (linkMatch && href) {
        tokens.push({ type: 'link', value: linkMatch[1] ?? '', href })
      } else {
        // Unsafe scheme: keep the label, drop the link entirely.
        tokens.push({ type: 'text', value: linkMatch?.[1] ?? token })
      }
    } else if (token.startsWith('**')) {
      tokens.push({ type: 'bold', value: token.slice(2, -2) })
    } else {
      tokens.push({ type: 'italic', value: token.slice(1, -1) })
    }

    cursor = match.index + token.length
  }

  if (cursor < text.length) tokens.push({ type: 'text', value: text.slice(cursor) })

  return tokens
}

function renderInline(text: string, keyPrefix: string) {
  return parseInline(text).map((token, index) => {
    const key = `${keyPrefix}-${index}`

    switch (token.type) {
      case 'bold':
        return <strong key={key} className="font-semibold">{token.value}</strong>
      case 'italic':
        return <em key={key}>{token.value}</em>
      case 'code':
        return (
          <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
            {token.value}
          </code>
        )
      case 'link':
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            // `noopener noreferrer` on every external link from model output.
            rel="noopener noreferrer nofollow"
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {token.value}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )
      default:
        return <Fragment key={key}>{token.value}</Fragment>
    }
  })
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []

  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let codeBlock: string[] | null = null

  function flushParagraph() {
    if (paragraph.length === 0) return
    const text = paragraph.join(' ')
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-pretty leading-relaxed">
        {renderInline(text, `p-${blocks.length}`)}
      </p>,
    )
    paragraph = []
  }

  function flushList() {
    if (!list) return
    const items = list.items
    const ordered = list.ordered

    blocks.push(
      ordered ? (
        <ol key={`l-${blocks.length}`} className="ms-5 list-decimal space-y-1.5">
          {items.map((item, index) => (
            <li key={index} className="leading-relaxed">
              {renderInline(item, `li-${blocks.length}-${index}`)}
            </li>
          ))}
        </ol>
      ) : (
        <ul key={`l-${blocks.length}`} className="ms-5 list-disc space-y-1.5">
          {items.map((item, index) => (
            <li key={index} className="leading-relaxed">
              {renderInline(item, `li-${blocks.length}-${index}`)}
            </li>
          ))}
        </ul>
      ),
    )
    list = null
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '')

    // Fenced code.
    if (line.trim().startsWith('```')) {
      if (codeBlock === null) {
        flushParagraph()
        flushList()
        codeBlock = []
      } else {
        blocks.push(
          <pre
            key={`c-${blocks.length}`}
            className="scrollbar-subtle overflow-x-auto rounded-lg bg-muted p-3 text-xs"
          >
            <code>{codeBlock.join('\n')}</code>
          </pre>,
        )
        codeBlock = null
      }
      continue
    }

    if (codeBlock !== null) {
      codeBlock.push(rawLine)
      continue
    }

    if (line.trim().length === 0) {
      flushParagraph()
      flushList()
      continue
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph()
      flushList()
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-3 border-border" />)
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push(
        <p key={`h-${blocks.length}`} className="mt-1 font-semibold tracking-[-0.01em]">
          {renderInline(heading[2] ?? '', `h-${blocks.length}`)}
        </p>,
      )
      continue
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    if (bullet) {
      flushParagraph()
      if (!list || list.ordered) {
        flushList()
        list = { ordered: false, items: [] }
      }
      list.items.push(bullet[1] ?? '')
      continue
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (numbered) {
      flushParagraph()
      if (!list || !list.ordered) {
        flushList()
        list = { ordered: true, items: [] }
      }
      list.items.push(numbered[1] ?? '')
      continue
    }

    flushList()
    paragraph.push(line.trim())
  }

  flushParagraph()
  flushList()

  if (codeBlock !== null && codeBlock.length > 0) {
    blocks.push(
      <pre key={`c-${blocks.length}`} className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
        <code>{codeBlock.join('\n')}</code>
      </pre>,
    )
  }

  return <div className="space-y-3 text-sm">{blocks}</div>
}
