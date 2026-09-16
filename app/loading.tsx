export default function Loading() {
  return (
    <div className="min-h-[60vh] luxury-gradient p-6">
      <div className="mx-auto max-w-7xl animate-fade-in space-y-5">
        <div className="skeleton h-10 w-56 rounded-2xl" />
        <div className="skeleton h-4 w-96 max-w-full rounded-lg" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((n) => <div key={n} className="skeleton h-36 rounded-3xl" />)}
        </div>
        <div className="skeleton h-72 rounded-3xl" />
      </div>
    </div>
  )
}
