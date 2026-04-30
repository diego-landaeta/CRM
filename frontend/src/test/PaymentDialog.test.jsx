import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mocks ANTES de import del componente
vi.mock('@/shared/components/ui/portal', () => ({
  default: ({ children }) => children,
}));

vi.mock('@/shared/hooks/useDialogA11y', () => ({
  useEscapeKey: () => {},
}));

const addPaymentMock = vi.fn();
vi.mock('@/modules/conversions/api/conversions.api', () => ({
  conversionsApi: {
    addPayment: (...args) => addPaymentMock(...args),
  },
}));

const toastMock = vi.fn();
vi.mock('@/shared/hooks/useToast', () => ({
  toast: (...args) => toastMock(...args),
}));

import PaymentDialog from '@/modules/conversions/components/PaymentDialog';

const baseConversion = {
  id: 42,
  importe_total: 1000,
  importe_pagado: 300,
  producto_contratado: 'Master IA',
};

describe('PaymentDialog', () => {
  beforeEach(() => {
    addPaymentMock.mockReset();
    addPaymentMock.mockResolvedValue({ success: true });
    toastMock.mockReset();
  });

  it('no renderiza nada cuando open=false', () => {
    render(<PaymentDialog open={false} onClose={vi.fn()} conversion={baseConversion} />);
    expect(screen.queryByText(/Registrar abono/i)).not.toBeInTheDocument();
  });

  it('no renderiza nada cuando conversion=null aunque open=true', () => {
    render(<PaymentDialog open onClose={vi.fn()} conversion={null} />);
    expect(screen.queryByText(/Registrar abono/i)).not.toBeInTheDocument();
  });

  it('muestra Total, Pagado y calcula Pendiente correctamente', () => {
    render(<PaymentDialog open onClose={vi.fn()} conversion={baseConversion} />);
    // 1000 total, 300 pagado, 700 pendiente
    // Buscar el bloque que muestra "Pendiente:" — verificamos que aparezca el monto formateado
    expect(screen.getByText(/Pendiente:/i)).toBeInTheDocument();
    // Intl puede usar nbsp + €; nos basta con que aparezca "700"
    const allText = document.body.textContent || '';
    expect(allText).toMatch(/700/);
    expect(allText).toMatch(/1\.000|1000/);
    expect(allText).toMatch(/300/);
  });

  it('muestra el producto contratado en el subtítulo', () => {
    render(<PaymentDialog open onClose={vi.fn()} conversion={baseConversion} />);
    expect(screen.getByText('Master IA')).toBeInTheDocument();
  });

  it('rechaza importe = 0 con toast destructive y NO llama API', async () => {
    const { container } = render(<PaymentDialog open onClose={vi.fn()} conversion={baseConversion} onPaid={vi.fn()} />);
    const form = container.querySelector('form');
    // No completar importe (queda string vacío que parsea a 0)
    fireEvent.submit(form);
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Importe invalido', variant: 'destructive' }),
      );
    });
    expect(addPaymentMock).not.toHaveBeenCalled();
  });

  it('rechaza importe negativo con toast destructive', async () => {
    const { container } = render(<PaymentDialog open onClose={vi.fn()} conversion={baseConversion} />);
    const importeInput = container.querySelector('input[type="number"]');
    fireEvent.change(importeInput, { target: { value: '-50' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Importe invalido', variant: 'destructive' }),
      );
    });
    expect(addPaymentMock).not.toHaveBeenCalled();
  });

  it('rechaza importe > pendiente con toast destructive y NO llama API', async () => {
    const { container } = render(<PaymentDialog open onClose={vi.fn()} conversion={baseConversion} />);
    const importeInput = container.querySelector('input[type="number"]');
    // Pendiente = 700, intentamos pagar 800
    fireEvent.change(importeInput, { target: { value: '800' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Importe excede pendiente', variant: 'destructive' }),
      );
    });
    expect(addPaymentMock).not.toHaveBeenCalled();
  });

  it('importe = pendiente exacto SÍ se acepta (caso borde)', async () => {
    const onClose = vi.fn();
    const onPaid = vi.fn();
    const { container } = render(<PaymentDialog open onClose={onClose} conversion={baseConversion} onPaid={onPaid} />);
    const importeInput = container.querySelector('input[type="number"]');
    fireEvent.change(importeInput, { target: { value: '700' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => {
      expect(addPaymentMock).toHaveBeenCalledTimes(1);
    });
    expect(onPaid).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('submit válido: llama addPayment con id, importe, fecha y notas', async () => {
    const onPaid = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<PaymentDialog open onClose={onClose} conversion={baseConversion} onPaid={onPaid} />);

    const importeInput = container.querySelector('input[type="number"]');
    const fechaInput = container.querySelector('input[type="date"]');
    const notasInput = container.querySelectorAll('input[type="text"], input:not([type])');

    fireEvent.change(importeInput, { target: { value: '250' } });
    fireEvent.change(fechaInput, { target: { value: '2026-01-15' } });
    // El input de notas es el último input no-number/no-date
    const notas = container.querySelector('input[placeholder*="Primer"]');
    if (notas) fireEvent.change(notas, { target: { value: 'Cuota 2' } });

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(addPaymentMock).toHaveBeenCalledTimes(1);
    });

    const [conversionId, payload] = addPaymentMock.mock.calls[0];
    expect(conversionId).toBe(42);
    expect(payload.importe).toBe(250);
    expect(payload.fecha).toBe('2026-01-15');
    expect(payload.notas).toBe('Cuota 2');

    expect(onPaid).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('notas vacías se envían como null', async () => {
    const { container } = render(<PaymentDialog open onClose={vi.fn()} conversion={baseConversion} onPaid={vi.fn()} />);
    fireEvent.change(container.querySelector('input[type="number"]'), { target: { value: '100' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(addPaymentMock).toHaveBeenCalled());
    expect(addPaymentMock.mock.calls[0][1].notas).toBeNull();
  });

  it('error de la API muestra toast destructive', async () => {
    addPaymentMock.mockRejectedValueOnce({ data: { error: 'Boom servidor' } });
    const onClose = vi.fn();
    const { container } = render(<PaymentDialog open onClose={onClose} conversion={baseConversion} onPaid={vi.fn()} />);
    fireEvent.change(container.querySelector('input[type="number"]'), { target: { value: '100' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', description: 'Boom servidor', variant: 'destructive' }),
      );
    });
    // En error NO se cierra el dialog
    expect(onClose).not.toHaveBeenCalled();
  });

  it('botón Cancelar llama onClose sin llamar API', () => {
    const onClose = vi.fn();
    render(<PaymentDialog open onClose={onClose} conversion={baseConversion} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalled();
    expect(addPaymentMock).not.toHaveBeenCalled();
  });
});
