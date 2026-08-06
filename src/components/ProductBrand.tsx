import { cn } from '@/lib/utils';

type ProductBrandProps = {
  /** Product name shown after the wordmark, e.g. "chat". */
  product: string;
  className?: string;
};

export function ProductBrand({ product, className }: ProductBrandProps) {
  return (
    <span className={cn('text-base leading-none', className)}>
      <span className="font-semibold text-foreground">agyn</span>{' '}
      <span className="text-muted-foreground">{product}</span>
    </span>
  );
}
