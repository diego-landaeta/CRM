import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SaludComercial from '@/modules/leads/components/SaludComercial';

const STATS = {
  total: 128,
  nuevo: 31,
  por_contactar: 24,
  contactado: 33,
  en_seguimiento: 19,
  convertido: 15,
  no_interesado: 6,
  sin_asignar: 9,
};

const URGENCIAS = { overdue: 3, today: 3, noContact: 3, urgent: 9 };

describe('Salud comercial', () => {
  it('saca las cifras que antes solo estaban dentro del desplegable de filtros', () => {
    render(<SaludComercial stats={STATS} urgencias={URGENCIAS} />);
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
    // 15 de 128 = 11,7% → 12%
    expect(screen.getByText('12% de los visibles')).toBeInTheDocument();
  });

  it('avisa cuando hay prospectos que no trabaja nadie, y calla cuando no los hay', () => {
    const { rerender } = render(<SaludComercial stats={STATS} urgencias={URGENCIAS} />);
    expect(screen.getByText('no los está trabajando nadie')).toBeInTheDocument();

    rerender(<SaludComercial stats={{ ...STATS, sin_asignar: 0 }} urgencias={URGENCIAS} />);
    expect(screen.getByText('todos tienen gestora')).toBeInTheDocument();
  });

  it('el reparto por estado suma lo que hay, en porcentaje sobre el total', () => {
    render(<SaludComercial stats={STATS} urgencias={URGENCIAS} />);
    expect(screen.getByText('31 · 24%')).toBeInTheDocument();  // nuevos
    expect(screen.getByText('33 · 26%')).toBeInTheDocument();  // contactados
    expect(screen.getByText('6 · 5%')).toBeInTheDocument();    // no interesados
  });

  it('sin prospectos no pinta un bloque de ceros', () => {
    // Ocupa sitio y no dice nada: la tabla ya avisa de que no hay ninguno.
    const { container } = render(
      <SaludComercial stats={{ total: 0 }} urgencias={{ overdue: 0, today: 0, noContact: 0, urgent: 0 }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('no divide por cero cuando el total es 0 pero hay urgencias', () => {
    const { container } = render(
      <SaludComercial stats={{ total: 0, convertido: 0 }} urgencias={{ overdue: 2, today: 1, noContact: 0, urgent: 3 }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('las cifras que filtran son botones; las que no, no lo fingen', () => {
    render(<SaludComercial stats={STATS} urgencias={URGENCIAS} onFiltroRapido={() => {}} />);
    // «Piden atención» filtra. «Prospectos» no: es el total, no hay nada que filtrar.
    expect(screen.getByRole('button', { name: /piden atención/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Prospectos/ })).toBeNull();
  });

  it('pulsar dos veces la misma cifra quita el filtro en vez de repetirlo', () => {
    const onFiltroRapido = vi.fn();
    const { rerender } = render(
      <SaludComercial stats={STATS} urgencias={URGENCIAS} onFiltroRapido={onFiltroRapido} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /piden atención/i }));
    expect(onFiltroRapido).toHaveBeenCalledWith('urgent');

    rerender(
      <SaludComercial
        stats={STATS} urgencias={URGENCIAS}
        filtroRapido="urgent" onFiltroRapido={onFiltroRapido}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /piden atención/i }));
    expect(onFiltroRapido).toHaveBeenLastCalledWith(null);
  });
});
