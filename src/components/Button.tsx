import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: ReactNode;
  asChild?: boolean;
}

const baseStyles =
  'inline-flex items-center justify-center rounded-[10px] font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-[var(--agyn-blue-dark)] active:bg-[var(--agyn-blue-dark)]',
  secondary: 'bg-[var(--agyn-purple)] text-primary-foreground hover:opacity-90 active:opacity-80',
  accent: 'bg-[var(--agyn-cyan)] text-primary-foreground hover:opacity-90 active:opacity-80',
  outline:
    'bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground',
  ghost: 'bg-transparent text-primary hover:bg-primary hover:text-primary-foreground',
  danger:
    'bg-transparent border-2 border-[var(--agyn-status-failed)] text-[var(--agyn-status-failed)] hover:bg-[var(--agyn-status-failed)] hover:text-primary-foreground',
  link:
    'bg-transparent text-primary underline-offset-4 hover:underline focus-visible:underline px-0 py-0',
};

const sizeClasses: Record<Exclude<ButtonProps['size'], undefined>, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3',
  lg: 'px-8 py-4',
  icon: 'p-0 h-10 w-10',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', children, className = '', asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  const appliedSize = variant === 'link' ? 'text-sm font-medium px-0 py-0' : sizeClasses[size];

  return (
    <Comp ref={ref} className={cn(baseStyles, variants[variant], appliedSize, className)} {...props}>
      {children}
    </Comp>
  );
});
