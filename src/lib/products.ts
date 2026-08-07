import { Box, MessageCircle, SlidersVertical, TrendingUp, type LucideIcon } from 'lucide-react';
import { deriveSiblingUrl } from '@/config';

export type Product = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** First hostname label the product is served under. */
  subdomain: string;
  /** Not deployed yet — listed but not linkable. */
  comingSoon?: boolean;
};

/** Listed in grid reading order: two columns, row-major. */
export const PRODUCTS: Product[] = [
  { id: 'chat', label: 'Chat', description: 'Talk to agents', icon: MessageCircle, subdomain: 'chat' },
  { id: 'tracing', label: 'Tracing', description: 'Inspect runs', icon: TrendingUp, subdomain: 'tracing' },
  { id: 'console', label: 'Console', description: 'Manage the org', icon: SlidersVertical, subdomain: 'console' },
  { id: 'sandboxes', label: 'Sandboxes', description: 'Run code safely', icon: Box, subdomain: 'sandboxes' },
];

/** Null when the product is unreleased or the host has no derivable sibling. */
export function productUrl(product: Product): string | null {
  if (product.comingSoon) return null;
  return deriveSiblingUrl(product.subdomain);
}
