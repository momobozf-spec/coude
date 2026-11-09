export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-5xl flex-col gap-4 px-4 py-8">
      <div className="h-8 w-48 animate-pulse rounded-full bg-emerald-light" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-40 animate-pulse rounded-card bg-white" />
        <div className="h-40 animate-pulse rounded-card bg-white" />
      </div>
    </div>
  );
}
