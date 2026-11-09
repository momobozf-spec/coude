# Advisory Board

Spec §177. Four perspectives on one question, then a synthesis that states where they agree
**and** where they disagree. Implemented in `src/core/ops/services/AdvisoryService.ts`; started
with the `advisory.ask` tool ("Vraag de adviesraad: …", "Ask the board: …") or a ticket with
`context.advisory = true`; the session is stored in `advisory_sessions` and linked to the ticket.

## Neutral brief

The brief is built from facts in the system, never from assumptions: the question, the date,
active projects (names), open and overdue outgoing invoices, waiting-for items, plus any context
the user typed (wrapped as untrusted content). All four roles receive the same brief.

## Roles

| Role | Framing |
|---|---|
| Strategist | long-term positioning, options, second-order effects |
| Critic | weakest assumption, what goes wrong, what is missing |
| Operator | feasibility, sequencing, cost, who does what next week, small reversible steps |
| Analyst | numbers and evidence; separates facts from assumptions |

Each returns `position`, `arguments`, `risks`, `questions`, `confidence` (validated with Zod).

## Synthesis

A chair pass produces `agreements`, `disagreements`, `recommendation | null`, `openQuestions`.
The prompt forbids inventing consensus: when the perspectives disagree the recommendation is
`null` or a way to resolve the disagreement, and the ticket summary says *"The board disagrees"*.

## Without cloud AI

`method: 'template'`: every role returns only its standard questions with `confidence: 0`, the
synthesis has no recommendation, and the ticket outcome is `needs_user`. No analysis is faked.
`src/core/ops/ops.test.ts` → *advisory board without cloud AI returns template questions, never
fake consensus*.

## Cost

Five structured requests per session (4 perspectives + synthesis). Usage is recorded through
`CostService` and shown on the ticket as an estimate.
