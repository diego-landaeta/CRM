import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium ring-offset-background transition-[background-color,color,transform] duration-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-card hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // Compacto en escritorio, tocable en el móvil (44 px): rediseño, 20/11.
        default: 'h-10 px-3.5 lg:h-8 lg:px-3',
        sm: 'h-9 px-3 lg:h-7 lg:px-2.5 text-xs',
        lg: 'h-11 px-5 lg:h-9 lg:px-4',
        icon: 'h-10 w-10 lg:h-8 lg:w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/**
 * Button — wrapper shadcn con variantes (variant, size).
 * Acepta cualquier prop de <button> nativo + asChild para Slot.
 *
 * @type {React.ForwardRefExoticComponent<
 *   React.ButtonHTMLAttributes<HTMLButtonElement> & {
 *     variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
 *     size?: 'default' | 'sm' | 'lg' | 'icon';
 *     asChild?: boolean;
 *   } & React.RefAttributes<HTMLButtonElement>
 * >}
 */
const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button };
