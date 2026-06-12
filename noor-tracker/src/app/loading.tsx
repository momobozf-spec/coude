export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafdf8] px-4">
      <div className="w-full max-w-xl bg-white rounded-3xl border border-emerald-100 p-8 shadow-sm">
        <div className="skeleton h-8 w-40 mb-4" />
        <div className="skeleton h-5 w-full mb-3" />
        <div className="skeleton h-5 w-5/6 mb-8" />
        <div className="grid gap-3">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
