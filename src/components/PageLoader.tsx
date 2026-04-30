export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20" aria-busy="true" aria-label="Ładowanie…">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
    </div>
  );
}
