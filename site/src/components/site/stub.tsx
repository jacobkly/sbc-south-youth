/** Stands in for a page's content until that page is built. */
export function Stub({ note }: { note: string }) {
  return (
    <div className="page-x">
      <div className="grid min-h-64 place-items-center rounded-card border-2 border-dashed border-line-strong p-8 text-center text-muted">
        <p className="max-w-xs text-pretty">{note}</p>
      </div>
    </div>
  );
}
