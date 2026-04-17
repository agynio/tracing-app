import { Link } from 'react-router-dom';

export function NotFoundScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-lg font-semibold text-[var(--agyn-dark)]">Page not found</h1>
      <p className="text-sm text-[var(--agyn-text-subtle)]">The page you requested does not exist.</p>
      <Link
        to="/"
        className="text-sm font-medium text-[var(--agyn-blue)] transition-colors hover:text-[var(--agyn-blue-dark)]"
      >
        Back to home
      </Link>
    </div>
  );
}
