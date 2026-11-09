'use client'

import { useTransition } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { runReconciliationAction } from '@/modules/admin/actions'

/**
 * Runs the same reconciliation the scheduled job runs.
 *
 * There is no admin-only write path behind this: the button calls
 * `reconcileSubscription`, which re-reads the provider and applies its answer.
 * An operator cannot grant a subscription that the provider does not confirm.
 */
export function ReconcileButton({ userId, reference }: { userId: string; reference: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await runReconciliationAction({ userId })

          if (!result.ok) {
            toast.error(result.message)
            return
          }

          toast.success(
            result.data.reconciled
              ? `Reconciled ${reference}.`
              : `Nothing to apply for ${reference}${result.data.reason ? ` — ${result.data.reason}` : ''}.`,
          )
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      Reconcile
    </Button>
  )
}
