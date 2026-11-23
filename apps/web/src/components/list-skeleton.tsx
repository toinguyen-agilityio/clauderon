/** Shown at once while a list page waits for its data. */
export function ListSkeleton({ title, label }: { title: string; label: string }) {
  return (
    <div className="skel-page" role="status" aria-label={label}>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <div className="skel" style={{ width: "min(420px, 80vw)", height: 14, marginTop: 8 }} />
        </div>
      </div>
      <div className="skel" style={{ width: "min(360px, 100%)", height: 32 }} />
      <div className="card skel-rows">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skel" style={{ height: 18, width: `${92 - (i % 3) * 12}%` }} />
        ))}
      </div>
    </div>
  );
}
