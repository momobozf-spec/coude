/**
 * robots.txt — lezen en toepassen.
 *
 * Een scraper van Superette bezoekt nooit een pad dat de site in robots.txt
 * verbiedt. Dit is de enige plek waar die beslissing valt; de browserlaag
 * vraagt het hier voor elke URL.
 *
 * Regels volgens RFC 9309:
 *  - de groep met de meest specifieke `User-agent` die op ons past, anders `*`;
 *  - binnen die groep wint de langste overeenkomende regel; bij gelijke lengte
 *    wint `Allow`;
 *  - `*` is een joker, `$` verankert het einde.
 * `Crawl-delay` is geen deel van de RFC maar respecteren we wel.
 */

export interface RobotsRule {
  readonly allow: boolean;
  readonly pattern: string;
}

export interface RobotsGroup {
  readonly agents: readonly string[];
  readonly rules: readonly RobotsRule[];
  readonly crawlDelaySeconds: number | null;
}

export interface RobotsPolicy {
  readonly groups: readonly RobotsGroup[];
  readonly sitemaps: readonly string[];
}

export function parseRobots(text: string): RobotsPolicy {
  const groups: { agents: string[]; rules: RobotsRule[]; crawlDelaySeconds: number | null }[] = [];
  const sitemaps: string[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelaySeconds: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;

    if (field === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }
    if (!current) continue;

    if (field === 'allow' || field === 'disallow') {
      // Een lege Disallow betekent "alles mag" en voegt geen regel toe.
      if (value === '') continue;
      current.rules.push({ allow: field === 'allow', pattern: value });
    } else if (field === 'crawl-delay') {
      const seconds = Number(value.replace(',', '.'));
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelaySeconds = seconds;
    }
  }

  return { groups, sitemaps };
}

/** De groep die voor deze user-agent geldt (RFC 9309 § 2.2.1). */
export function groupFor(policy: RobotsPolicy, userAgentToken: string): RobotsGroup | null {
  const token = userAgentToken.toLowerCase();
  let best: RobotsGroup | null = null;
  let bestLength = -1;
  for (const group of policy.groups) {
    for (const agent of group.agents) {
      if (agent !== '*' && token.includes(agent) && agent.length > bestLength) {
        best = group;
        bestLength = agent.length;
      }
    }
  }
  if (best) return best;
  return policy.groups.find((group) => group.agents.includes('*')) ?? null;
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`);
}

/**
 * Mag dit pad (inclusief querystring) bezocht worden?
 * Geen overeenkomende regel betekent: toegestaan.
 */
export function isAllowed(policy: RobotsPolicy, userAgentToken: string, pathWithQuery: string): boolean {
  const group = groupFor(policy, userAgentToken);
  if (!group) return true;

  let decision: RobotsRule | null = null;
  for (const rule of group.rules) {
    if (!patternToRegExp(rule.pattern).test(pathWithQuery)) continue;
    if (
      !decision ||
      rule.pattern.length > decision.pattern.length ||
      (rule.pattern.length === decision.pattern.length && rule.allow && !decision.allow)
    ) {
      decision = rule;
    }
  }
  return decision ? decision.allow : true;
}

export function crawlDelayFor(policy: RobotsPolicy, userAgentToken: string): number | null {
  return groupFor(policy, userAgentToken)?.crawlDelaySeconds ?? null;
}
