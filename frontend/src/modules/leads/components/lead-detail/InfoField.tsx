import { avatarColorFor } from '@/shared/lib/ui';
import type { ReactNode } from 'react';

export default function InfoField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="text-[13px] font-medium break-words">{children}</div>
    </div>
  );
}

export const inputClass = 'w-full h-9 px-3 rounded-md border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground';

// La paleta esta en shared/lib/ui.ts. Esta copia no llevaba variante oscura:
// en modo oscuro pintaba un parche claro.
export function avatarColor(id: number | string | null | undefined): string {
  return avatarColorFor(Number(id || 0));
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}
