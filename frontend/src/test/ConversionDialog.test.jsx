import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mocks ANTES de import del componente
vi.mock('@/shared/components/ui/portal', () => ({
  default: ({ children }) => children,
}));

vi.mock('@/shared/hooks/useDialogA11y', () => ({
  useEscapeKey: () => {},
}));

const productsState = { products: [] };
vi.mock('@/modules/products/hooks/useProducts', () => ({
  useProducts: () => productsState,
}));

const createMock = vi.fn();
vi.mock('@/modules/conversions/api/conversions.api', () => ({
  conversionsApi: {
    create: (...args) => createMock(...args),
  },
}));

const toastMock = vi.fn();
vi.mock('@/shared/hooks/useToast', () => ({
  toast: (...args) => toastMock(...args),
}));

import ConversionDialog from '@/modules/conversions/components/ConversionDialog';

const baseLead = { id: 99, nombre: 'Ana Test' };

beforeEach(() => {
  productsState.products = [];
  createMock.mockReset();
  createMock.mockResolvedValue({ success: true, data: { id: 1 } });
  toastMock.mockReset();
});

describe('ConversionDialog — render base', () => {
  it('no renderiza nada cuando open=false', () => {
    render(<ConversionDialog open={false} onClose={vi.fn()} lead={baseLead} projectId={1} />);
    expect(screen.queryByText(/Registrar Conversion/i)).not.toBeInTheDocument();
  });

  it('renderiza con nombre del lead en subtítulo', () => {
    render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} />);
    expect(screen.getByText(/Lead: Ana Test/i)).toBeInTheDocument();
  });

  it('campo "Fecha compromiso" oculto si metodo_pago no es fraccionado', () => {
    render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} />);
    expect(screen.queryByText(/Fecha compromiso de pago pendiente/i)).not.toBeInTheDocument();
  });

  it('campo "Fecha compromiso" se muestra si metodo_pago = fraccionado', async () => {
    const { container } = render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} />);
    const selects = container.querySelectorAll('select');
    // Primer select es "Metodo de pago" (no hay productos)
    const metodoSelect = Array.from(selects).find((s) => s.querySelector('option[value="fraccionado"]'));
    expect(metodoSelect).toBeTruthy();
    fireEvent.change(metodoSelect, { target: { value: 'fraccionado' } });
    expect(await screen.findByText(/Fecha compromiso de pago pendiente/i)).toBeInTheDocument();
  });
});

describe('ConversionDialog — validaciones', () => {
  it('rechaza producto vacío con toast destructive', async () => {
    const { container } = render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} />);
    // No tocamos producto (queda vacío). Ponemos importe válido.
    const importeTotal = container.querySelector('input[type="number"][required]');
    fireEvent.change(importeTotal, { target: { value: '500' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Producto requerido', variant: 'destructive' }),
      );
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rechaza importe_total = 0 con toast destructive', async () => {
    const { container } = render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} />);
    // El input de producto es text required, lo llenamos
    const productoInput = container.querySelector('input[placeholder*="producto"]');
    fireEvent.change(productoInput, { target: { value: 'Curso X' } });
    // importe_total queda vacío → 0
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Importe invalido', variant: 'destructive' }),
      );
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rechaza importe_pagado > importe_total con toast destructive', async () => {
    const { container } = render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} />);
    const productoInput = container.querySelector('input[placeholder*="producto"]');
    const numbers = container.querySelectorAll('input[type="number"]');
    // El primer number es importe_total, el segundo es importe_pagado (según el grid del JSX)
    fireEvent.change(productoInput, { target: { value: 'Curso X' } });
    fireEvent.change(numbers[0], { target: { value: '500' } });
    fireEvent.change(numbers[1], { target: { value: '600' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Importe pagado invalido', variant: 'destructive' }),
      );
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('importe_pagado = importe_total se acepta (caso borde)', async () => {
    const { container } = render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} onCreated={vi.fn()} />);
    fireEvent.change(container.querySelector('input[placeholder*="producto"]'), { target: { value: 'X' } });
    const numbers = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numbers[0], { target: { value: '500' } });
    fireEvent.change(numbers[1], { target: { value: '500' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
  });
});

describe('ConversionDialog — submit', () => {
  it('submit válido llama API con lead_id, project_id, producto e importes correctos', async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <ConversionDialog open onClose={onClose} lead={baseLead} projectId={7} onCreated={onCreated} />,
    );

    fireEvent.change(container.querySelector('input[placeholder*="producto"]'), { target: { value: 'Master IA' } });
    const numbers = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numbers[0], { target: { value: '1200' } });
    fireEvent.change(numbers[1], { target: { value: '300' } });

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));

    const payload = createMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      lead_id: 99,
      project_id: 7,
      producto_contratado: 'Master IA',
      importe_total: 1200,
      importe_pagado: 300,
      metodo_pago: 'tarjeta',
    });

    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('error de API muestra toast destructive sin cerrar el dialog', async () => {
    createMock.mockRejectedValueOnce({ data: { error: 'Lead duplicado' } });
    const onClose = vi.fn();
    const { container } = render(
      <ConversionDialog open onClose={onClose} lead={baseLead} projectId={1} onCreated={vi.fn()} />,
    );
    fireEvent.change(container.querySelector('input[placeholder*="producto"]'), { target: { value: 'X' } });
    fireEvent.change(container.querySelector('input[type="number"]'), { target: { value: '100' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error al registrar conversion', description: 'Lead duplicado' }),
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ConversionDialog — payment links derivados', () => {
  it('usa payment_links del producto si existe array', () => {
    productsState.products = [
      {
        id: 1,
        nombre: 'Master IA',
        payment_links: [
          { label: 'Pago completo', url: 'https://buy.stripe.com/full', tipo: 'completo' },
          { label: 'Anticipo', url: 'https://buy.stripe.com/down', tipo: 'anticipo' },
        ],
      },
    ];
    render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} />);
    // Seleccionamos el producto
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'Master IA' } });
    // Verificamos que aparecen los enlaces en el select de pago
    const linkSelects = document.querySelectorAll('select');
    const linkSelect = linkSelects[linkSelects.length - 1]; // último select = enlace
    const opts = linkSelect.querySelectorAll('option');
    const labels = Array.from(opts).map((o) => o.textContent);
    expect(labels.some((l) => /Pago completo/.test(l))).toBe(true);
    expect(labels.some((l) => /Anticipo/.test(l))).toBe(true);
  });

  it('si no hay payment_links usa fallback stripe_link como enlace único', () => {
    productsState.products = [
      { id: 1, nombre: 'Curso Y', stripe_link: 'https://buy.stripe.com/legacy', payment_links: null },
    ];
    render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} />);
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'Curso Y' } });
    const linkSelect = document.querySelectorAll('select');
    const last = linkSelect[linkSelect.length - 1];
    const labels = Array.from(last.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels.some((l) => /Pago completo/.test(l))).toBe(true);
  });

  it('producto sin payment_links ni stripe_link muestra mensaje "no tiene enlaces"', () => {
    productsState.products = [{ id: 1, nombre: 'Sin enlaces', payment_links: null }];
    render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} />);
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'Sin enlaces' } });
    expect(screen.getByText(/no tiene enlaces configurados/i)).toBeInTheDocument();
  });
});
