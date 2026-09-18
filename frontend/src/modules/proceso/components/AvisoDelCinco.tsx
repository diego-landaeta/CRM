import { Percent } from '@phosphor-icons/react';

/**
 * Si esta formación lleva el 5 % de contado (#91).
 *
 * El documento: «el 5 % solo aplica en máster y diplomado, y se ofrece aquí,
 * no antes». Hasta ahora dependía de que cada asesora supiera de qué tipo es
 * cada formación, y son dos errores distintos: ofrecerlo en un curso regala un
 * 5 % que no tocaba, y no ofrecerlo en un máster **no se nota nunca**.
 *
 * El «no consta» NO se pinta como un «no». Sin formación elegida el CRM no
 * sabe, y dar por hecho que no aplica es justo el error caro de los dos.
 */
export default function AvisoDelCinco({ lleva }: { lleva: boolean | null }) {
  const color = lleva === true
    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
    : lleva === false
      ? 'bg-muted text-muted-foreground'
      : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300';

  const texto = lleva === true
    ? 'Lleva el 5 % de contado: es máster o diplomado. Se ofrece aquí, no antes.'
    : lleva === false
      ? 'Sin 5 % de contado: esta formación no es máster ni diplomado.'
      : 'No consta la formación: comprueba si lleva el 5 % antes de ofrecerlo.';

  return (
    <p className={`mt-1.5 flex items-start gap-1 rounded px-2 py-1 text-[11px] font-medium ${color}`}>
      <Percent size={11} weight="bold" className="mt-0.5 flex-shrink-0" />
      <span>{texto}</span>
    </p>
  );
}
