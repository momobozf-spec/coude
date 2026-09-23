import { assignAction, snoozeAction, statusAction } from "@/actions/opportunities";

interface Props {
  opportunityId: string;
  status: string;
  assignedUserId: string | null;
  currentUserId: string;
  canAssign: boolean;
  users: Array<{ id: string; name: string }>;
  returnTo: string;
  compact?: boolean;
}

/** OPEN · ASSIGN · MARK CONTACTED · SNOOZE · DISMISS */
export function OpportunityActions({ opportunityId, status, assignedUserId, currentUserId, canAssign, users, returnTo, compact }: Props) {
  const closed = ["MANDATE_WON", "LOST", "DISMISSED"].includes(status);
  const size = compact ? "btn btn-sm" : "btn";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!assignedUserId || assignedUserId !== currentUserId ? (
        <form action={assignAction}>
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="self" value="1" />
          <button className={size} type="submit" disabled={closed}>Assign to me</button>
        </form>
      ) : null}
      {canAssign ? (
        <form action={assignAction} className="flex items-center gap-1">
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <select name="userId" className={`input w-auto ${compact ? "py-1 text-xs" : "py-1.5"}`} defaultValue={assignedUserId ?? ""}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button className={size} type="submit" disabled={closed}>Assign</button>
        </form>
      ) : null}
      {status !== "CONTACTED" && !closed ? (
        <form action={statusAction}>
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="status" value="CONTACTED" />
          <button className={`${size} btn-primary`} type="submit">Mark contacted</button>
        </form>
      ) : null}
      {!closed ? (
        <form action={snoozeAction} className="flex items-center gap-1">
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <select name="days" className={`input w-auto ${compact ? "py-1 text-xs" : "py-1.5"}`} defaultValue="7">
            <option value="1">1 day</option>
            <option value="3">3 days</option>
            <option value="7">1 week</option>
            <option value="30">1 month</option>
          </select>
          <button className={size} type="submit">Snooze</button>
        </form>
      ) : null}
      {!closed ? (
        <form action={statusAction}>
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="status" value="DISMISSED" />
          <button className={`${size} btn-danger`} type="submit">Dismiss</button>
        </form>
      ) : null}
    </div>
  );
}
