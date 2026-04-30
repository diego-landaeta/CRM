import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mocks de dependencias externas (deben declararse antes del import del componente).
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectContext: () => ({ activeProject: { id: 1, nombre: 'Test Project', producto_label: 'Producto' } }),
}));

vi.mock('@/modules/products/hooks/useProducts', () => ({
  useProducts: () => ({ products: [], refetch: vi.fn() }),
}));

vi.mock('@/shared/api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ success: true, data: [] }),
    post: vi.fn().mockResolvedValue({ success: true }),
    patch: vi.fn().mockResolvedValue({ success: true }),
    delete: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/shared/hooks/useDialogA11y', () => ({
  useEscapeKey: () => {},
}));

// Portal renderiza inline para testear sin document.body shenanigans
vi.mock('@/shared/components/ui/portal', () => ({
  default: ({ children }) => children,
}));

// ProductCombobox simplificado a input controlado
vi.mock('@/modules/leads/components/ProductCombobox', () => ({
  default: ({ value, onChange }) => (
    <input
      data-testid="product-combobox"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import LeadFormDialog from '@/modules/leads/components/LeadFormDialog';

describe('LeadFormDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('no renderiza nada cuando open=false', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<LeadFormDialog open={false} onClose={onClose} onSubmit={onSubmit} />);
    expect(screen.queryByText(/Nuevo Prospecto/i)).not.toBeInTheDocument();
  });

  it('renderiza titulo "Nuevo Prospecto" cuando no hay lead', async () => {
    render(<LeadFormDialog open onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(await screen.findByText('Nuevo Prospecto')).toBeInTheDocument();
    // Espera el useEffect de carga de custom_fields para evitar warning de act()
    await act(async () => { await Promise.resolve(); });
  });

  it('renderiza titulo "Editar Lead" cuando hay un lead', async () => {
    render(<LeadFormDialog open onClose={vi.fn()} onSubmit={vi.fn()} lead={{ id: 1, nombre: 'X', email: 'x@y.com' }} />);
    expect(await screen.findByText('Editar Lead')).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
  });

  it('llama onSubmit con los datos del formulario al submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    const onClose = vi.fn();
    const { container } = render(<LeadFormDialog open onClose={onClose} onSubmit={onSubmit} />);

    // Inputs por nombre del registro de react-hook-form (atributo `name`)
    const nombreInput = container.querySelector('input[name="nombre"]');
    const emailInput = container.querySelector('input[name="email"]');
    const telefonoInput = container.querySelector('input[name="telefono"]');
    expect(nombreInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();

    fireEvent.input(nombreInput, { target: { value: 'Juan Pérez' } });
    fireEvent.input(emailInput, { target: { value: 'juan@example.com' } });
    fireEvent.input(telefonoInput, { target: { value: '600123456' } });

    // El boton de submit es el ultimo dentro del form (puede no tener type="submit" explicito)
    const form = container.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({
      nombre: 'Juan Pérez',
      email: 'juan@example.com',
      telefono: '600123456',
      origen: 'directo',
    });
    // Tras submit, el dialog debe cerrarse
    expect(onClose).toHaveBeenCalled();
  });

  it('no llama onSubmit si el email es invalido', async () => {
    const onSubmit = vi.fn();
    const { container } = render(<LeadFormDialog open onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.input(container.querySelector('input[name="nombre"]'), { target: { value: 'Juan' } });
    fireEvent.input(container.querySelector('input[name="email"]'), { target: { value: 'no-es-email' } });

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      // Mensaje del schema de Zod
      expect(screen.getByText(/Email no valido/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
