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

  it('aplica tono destructive (clase bg-red-600)', () => {
    render(<ConfirmDialog open title="X" tone="destructive" confirmLabel="Borrar" onConfirm={() => {}} onCancel={() => {}} />);
    const btn = screen.getByText('Borrar').closest('button');
    expect(btn?.className).toContain('bg-red-600');
  });
});
