import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('no se renderiza si open=false', () => {
    render(<ConfirmDialog open={false} title="X" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText('X')).toBeNull();
  });

  it('renderiza titulo y mensaje', () => {
    render(<ConfirmDialog open title="Eliminar" message="Estas seguro?" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Eliminar')).toBeInTheDocument();
    expect(screen.getByText('Estas seguro?')).toBeInTheDocument();
  });

  it('llama onConfirm al click en Confirmar', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="X" confirmLabel="Si" onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Si'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('llama onCancel al click en Cancelar', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="X" onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('deshabilita botones cuando loading=true', () => {
    render(<ConfirmDialog open title="X" loading onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Procesando…').closest('button')).toBeDisabled();
    expect(screen.getByText('Cancelar')).toBeDisabled();
  });

  // Antes esto comprobaba `bg-red-600`, el color exacto. Eso ataba el test a la
  // paleta: cambiar el rojo obligaba a tocar el test aunque el comportamiento
  // fuera el mismo. Ahora comprueba lo que de verdad importa —que cada tono
  // pinta SU token y no el de otro—, que es lo que se rompería de verdad.
  it('cada tono usa su propio token de color', () => {
    const casos = [
      { tone: 'destructive', token: 'bg-destructive' },
      { tone: 'warning', token: 'bg-warning' },
      { tone: 'success', token: 'bg-success' },
      { tone: 'info', token: 'bg-info' },
      { tone: 'default', token: 'bg-primary' },
    ];
    for (const { tone, token } of casos) {
      const { unmount } = render(
        <ConfirmDialog open title="X" tone={tone} confirmLabel="Borrar" onConfirm={() => {}} onCancel={() => {}} />,
      );
      const btn = screen.getByText('Borrar').closest('button');
      expect(btn?.className, `tono ${tone}`).toContain(token);
      unmount();
    }
  });

  it('el texto del boton sale del token, no de un text-white fijo', () => {
    // En oscuro el ámbar es claro: con `text-white` fijo el botón de aviso se
    // quedaba en blanco sobre amarillo.
    render(<ConfirmDialog open title="X" tone="warning" confirmLabel="Vale" onConfirm={() => {}} onCancel={() => {}} />);
    const btn = screen.getByText('Vale').closest('button');
    expect(btn?.className).toContain('text-warning-foreground');
    expect(btn?.className).not.toContain('text-white');
  });

  it('un tono desconocido cae en el estilo por defecto en vez de romper', () => {
    render(<ConfirmDialog open title="X" tone="inventado" confirmLabel="Ok" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Ok').closest('button')?.className).toContain('bg-primary');
  });
});
