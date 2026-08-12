import { useMemo } from 'react';
import { useAuth } from 'react-oidc-context';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { signOut } from '@/auth/sign-out';
import { cn } from '@/lib/utils';
import { useTheme } from './theme-provider';
import { useOrganization } from '@/organization/organization.runtime';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const;

function getInitials(name: string | null | undefined): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return `${first}${second}`.toUpperCase() || 'U';
}

export function UserOrgMenu({ className }: { className?: string }) {
  const auth = useAuth();
  const { organizations, selectedOrganizationId, selectOrganization } = useOrganization();
  const { theme, setTheme } = useTheme();

  // No user service here, so the account comes from the OIDC profile.
  const profile = auth.user?.profile;
  const email = typeof profile?.email === 'string' ? profile.email : undefined;
  const name = typeof profile?.name === 'string' ? profile.name : undefined;

  const userInitials = useMemo(() => getInitials(name ?? email), [name, email]);
  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0] ?? null,
    [organizations, selectedOrganizationId],
  );
  const themeLabel = THEME_OPTIONS.find((option) => option.value === theme)?.label ?? 'System';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted',
            className,
          )}
          data-testid="user-menu-trigger"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {userInitials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{email ?? name ?? 'Signed in'}</p>
            <p className="truncate text-xs text-muted-foreground" data-testid="current-org-name">
              {currentOrganization?.name ?? 'No organization'}
            </p>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="min-w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Organization</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={selectedOrganizationId ?? ''}
          onValueChange={(value) => selectOrganization(value)}
          data-testid="org-switcher"
        >
          {organizations.map((organization) => (
            <DropdownMenuRadioItem
              key={organization.id}
              value={organization.id}
              className="data-[state=checked]:font-medium"
              data-testid={`org-item-${organization.id}`}
            >
              <span className="truncate" title={organization.name}>
                {organization.name}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="theme-menu-trigger">
            <span className="flex-1">Theme</span>
            <span className="text-muted-foreground">{themeLabel}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
              {THEME_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value} data-testid={`theme-${option.value}`}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut(auth)} data-testid="sign-out">
          <LogOut className="h-4 w-4 text-muted-foreground" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
