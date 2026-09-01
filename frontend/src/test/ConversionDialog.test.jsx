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

// ─────────────────────────────────────────────────────────────────────────────
// Estas ayudas existen porque las pruebas elegian los campos POR POSICION
// —`querySelectorAll('input[type=number]')[0]` y `[1]`— y el dialogo crecio: hoy
// el primer number es el porcentaje de IVA, no el precio. Los valores se metian
// en campos que no eran, y de ahi los tres rojos.
//
// Elegir por posicion es una prueba que se rompe cada vez que el producto crece
// y que no dice nada cuando importa. Se elige por lo que el campo ES.

/** El precio base: el unico number obligatorio del formulario. */
const precioBase = (c) => c.querySelector('input[type="number"][required]');

/**
 * Abre «Parcial» y devuelve su casilla, que solo existe en ese modo.
 *
 * OJO: pulsar «Parcial» cambia el metodo de pago a `fraccionado` a proposito —
 * si paga una parte, el resto va a plazos— y eso genera el plan de cuotas solo.
 */
function pagoParcial(c) {
  fireEvent.click(screen.getByText('Parcial'));
  return screen.getByPlaceholderText(/cuánto pagó/i);
}

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
    render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} />);
    // Sin productos solo hay un combobox: "Metodo de pago"
    const metodoTrigger = screen.getByRole('combobox', { name: /Método de pago/i });
    fireEvent.click(metodoTrigger);
    fireEvent.mouseDown(await screen.findByRole('option', { name: 'Fraccionado' }));
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
    fireEvent.change(productoInput, { target: { value: 'Curso X' } });
    fireEvent.change(precioBase(container), { target: { value: '500' } });
    fireEvent.change(pagoParcial(container), { target: { value: '600' } });
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
    fireEvent.change(precioBase(container), { target: { value: '500' } });
    // «Pago TODO» pone el pagado exactamente igual al total, que es este caso
    // borde. Antes se escribia el mismo numero a mano en dos campos y pasaba
    // por casualidad: el pagado se quedaba en 0 y 0 <= 500 tambien pasa.
    fireEvent.click(screen.getByText(/pagó todo/i));
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0]).toMatchObject({ importe_total: 500, importe_pagado: 500 });
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
    fireEvent.change(precioBase(container), { target: { value: '1200' } });
    fireEvent.change(pagoParcial(container), { target: { value: '300' } });

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));

    const payload = createMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      lead_id: 99,
      project_id: 7,
      producto_contratado: 'Master IA',
      importe_total: 1200,
      importe_pagado: 300,
      // Ya no es 'tarjeta': pagar una parte implica que el resto va a plazos, y
      // el dialogo cambia el metodo solo. El metodo real de cada abono se
      // indica al registrar cada cuota.
      metodo_pago: 'fraccionado',
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
    fireEvent.change(precioBase(container), { target: { value: '100' } });
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
  function pickProduct(name) {
    const productoTrigger = screen.getByRole('combobox', { name: /Producto contratado/i });
    fireEvent.click(productoTrigger);
    fireEvent.mouseDown(screen.getByRole('option', { name }));
  }

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
    pickProduct('Master IA');
    const linkTrigger = screen.getByRole('combobox', { name: /Enlace de pago/i });
    fireEvent.click(linkTrigger);
    expect(screen.getByRole('option', { name: /Pago completo/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Anticipo/i })).toBeInTheDocument();
  });

  it('si no hay payment_links usa fallback stripe_link como enlace único', () => {
    productsState.products = [
      { id: 1, nombre: 'Curso Y', stripe_link: 'https://buy.stripe.com/legacy', payment_links: null },
    ];
    render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} />);
    pickProduct('Curso Y');
    const linkTrigger = screen.getByRole('combobox', { name: /Enlace de pago/i });
    fireEvent.click(linkTrigger);
    expect(screen.getByRole('option', { name: /Pago completo/i })).toBeInTheDocument();
  });

  it('producto sin payment_links ni stripe_link muestra mensaje "no tiene enlaces"', () => {
    productsState.products = [{ id: 1, nombre: 'Sin enlaces', payment_links: null }];
    render(<ConversionDialog open onClose={vi.fn()} lead={baseLead} projectId={1} />);
    pickProduct('Sin enlaces');
    expect(screen.getByText(/no tiene enlaces configurados/i)).toBeInTheDocument();
  });
});
