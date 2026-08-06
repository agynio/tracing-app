import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductSwitcher } from './ProductSwitcher';
import { UserOrgMenu } from './UserOrgMenu';

type TopBarProps = {
  /** Back link and context label, shown on the run detail screen. */
  backTo?: string;
  backLabel?: string;
  contextLabel?: string;
};

export function TopBar({ backTo, backLabel = 'Traces', contextLabel }: TopBarProps) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <ProductSwitcher currentProductId="tracing" />
        {backTo ? (
          <>
            <span className="h-5 w-px bg-border" aria-hidden="true" />
            <Link
              to={backTo}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          </>
        ) : null}
        {contextLabel ? (
          <span className="truncate font-mono text-sm text-foreground" data-testid="top-bar-context">
            {contextLabel}
          </span>
        ) : null}
      </div>
      <UserOrgMenu className="shrink-0" />
    </header>
  );
}
