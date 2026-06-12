export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-10 w-64" />
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="skeleton h-48 rounded-3xl" />
        <div className="skeleton h-48 rounded-3xl" />
      </div>
      <div className="skeleton h-40 rounded-3xl" />
    </div>
  );
}
