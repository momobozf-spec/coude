import { switchAgencyAction } from "@/actions/admin";

export function AgencySwitcher({ agencies }: { agencies: Array<{ id: string; name: string }> }) {
  return (
    <form action={switchAgencyAction} className="border-b border-ink-200 px-4 py-2">
      <label className="label" htmlFor="agency">Acting as agency</label>
      <select id="agency" name="agencyId" className="input py-1" defaultValue="">
        <option value="" disabled>Select…</option>
        {agencies.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <button className="btn btn-sm mt-2 w-full justify-center" type="submit">Switch</button>
    </form>
  );
}
