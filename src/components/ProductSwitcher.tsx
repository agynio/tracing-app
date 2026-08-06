import { Check, ChevronDown, LayoutGrid } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';
import { ProductBrand } from './ProductBrand';
import { PRODUCTS, productUrl, type Product } from '@/lib/products';

const cardClasses = 'flex min-w-36 flex-col gap-0.5 rounded-lg p-3 text-left';

function ProductCard({ product, isCurrent }: { product: Product; isCurrent: boolean }) {
  const Icon = product.icon;
  const url = isCurrent ? null : productUrl(product);

  const body = (
    <>
      <span className="flex items-center gap-2 text-base font-medium text-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        {product.label}
        {isCurrent ? <Check className="ml-auto h-4 w-4 shrink-0" /> : null}
      </span>
      <span className="text-sm text-muted-foreground">{product.description}</span>
    </>
  );

  // Current product, or one with no derivable sibling host: shown, not navigable.
  if (!url) {
    return (
      <div
        className={cn(cardClasses, isCurrent ? 'bg-muted' : 'opacity-60')}
        aria-current={isCurrent ? 'page' : undefined}
        aria-disabled={isCurrent ? undefined : true}
        data-testid={`product-${product.id}`}
      >
        {body}
      </div>
    );
  }

  return (
    <a
      href={url}
      className={cn(cardClasses, 'transition-colors hover:bg-muted')}
      data-testid={`product-${product.id}`}
    >
      {body}
    </a>
  );
}

export function ProductSwitcher({ currentProductId }: { currentProductId: string }) {
  const current = PRODUCTS.find((product) => product.id === currentProductId) ?? PRODUCTS[0];

  return (
    <Popover>
      {/* Anchored to the whole row so the panel lines up with the wordmark
          rather than the button it hangs off. */}
      <PopoverAnchor asChild>
        <div className="flex items-center gap-2">
          <ProductBrand product={current.label.toLowerCase()} />
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Switch product"
              className={cn(
                'group flex h-8 items-center gap-1 rounded-lg px-2 text-muted-foreground',
                'transition-[background-color,color,transform] hover:bg-muted hover:text-foreground',
                'active:scale-[0.97] active:bg-muted-foreground/20',
                'data-[state=open]:bg-muted data-[state=open]:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              data-testid="product-switcher-trigger"
            >
              <LayoutGrid className="h-4 w-4" />
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="grid w-auto grid-cols-2 gap-1 rounded-xl p-2 shadow-lg">
        {PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} isCurrent={product.id === current.id} />
        ))}
      </PopoverContent>
    </Popover>
  );
}
