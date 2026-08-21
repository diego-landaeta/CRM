import { CaretLeft, CaretRight } from '@phosphor-icons/react';

interface Props {
  page: number;
  totalPaginas: number;
  totalElementos: number;
  porPagina: number;
  onPageChange: (page: number) => void;
}

export default function TablePagination({ page, totalPaginas, totalElementos, porPagina, onPageChange }: Props) {
  if (totalPaginas <= 1) return null;

  const desde = (page - 1) * porPagina + 1;
  const hasta = Math.min(page * porPagina, totalElementos);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-muted/20">
      <span className="text-secundario text-muted-foreground">
        {desde}–{hasta} de {totalElementos}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <span className="text-secundario font-medium tabular-nums px-2">
          {page} / {totalPaginas}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPaginas}
          aria-label="Página siguiente"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
