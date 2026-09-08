// Piezas de presentacion que estaban copiadas en varios modulos a la vez.
//
// Antes de tocar esto habia 5 copias de AVATAR_COLORS, 6 de getInitials y 14 de
// inputClass — con seis valores distintos entre ellas. Aqui hay UNA. El resto se
// va apuntando aqui segun se toca cada pantalla; no se migran todas de golpe
// porque cambiar 30 archivos a la vez no se puede revisar.

export const AVATAR_COLORS: ReadonlyArray<string> = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
];

/** Color estable para un avatar: el mismo id siempre pinta el mismo color. */
export function avatarColorFor(id: number): string {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export const inputClass =
  'w-full h-9 px-3 rounded-md border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground';
