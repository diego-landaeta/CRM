import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Las dos familias de plantillas, separadas en el chat (#129).
 *
 * Diego: «serían plantillas de procesos de ventas y plantillas
 * personalizadas, las de ellas». No es orden por gusto: son cosas distintas y
 * se usan distinto — las del proceso vienen del documento comercial y se usan
 * tal cual; las suyas las escribe cada gestora.
 *
 * Mezcladas, que es como estaban, la lista es un montón de veinte nombres
 * donde no se ve cuál toca hoy.
 */

const plantillas = vi.fn();
vi.mock('@/modules/whatsapp/api/whatsapp.api', () => ({
  whatsappApi: { plantillas: (...a) => plantillas(...a) },
}));

const SelectorPlantillas = (await import('@/modules/whatsapp/components/SelectorPlantillas')).default;

const DEL_PROCESO = {
  id: 1, project_id: 1, label: 'Día 1 · Saludo', body: 'Hola {nombre}',
  ambito: 'compartida', owner_id: null, orden: 1,
  paso_clave: 'paso_1', paso_nombre: 'Primer contacto e información', paso_orden: 1,
};
const SUYA = {
  id: 2, project_id: 1, label: 'Mi recordatorio', body: 'Te recuerdo lo del pago',
  ambito: 'personal', owner_id: 3, orden: 2, paso_clave: null,
};

function pinta() {
  return render(
    <MemoryRouter>
      <SelectorPlantillas
        projectId={1} datos={{ nombre: 'David' }} nombreProyecto="Psiko Aprende"
        alElegir={() => {}} alCerrar={() => {}}
      />
    </MemoryRouter>
  );
}

describe('el popup de plantillas', () => {
  beforeEach(() => plantillas.mockReset());

  it('separa las del proceso de las suyas', async () => {
    plantillas.mockResolvedValue({ success: true, data: [DEL_PROCESO, SUYA] });
    pinta();

    expect(await screen.findByText('Del proceso de ventas')).toBeTruthy();
    expect(screen.getByText('Tuyas y del equipo')).toBeTruthy();
  });

  it('dice de qué paso es cada una de las del proceso', async () => {
    // Para saber cuál toca hoy sin tener el documento abierto al lado.
    plantillas.mockResolvedValue({ success: true, data: [DEL_PROCESO, SUYA] });
    pinta();
    expect(await screen.findByText('Primer contacto e información')).toBeTruthy();
  });

  it('con una sola familia no pone títulos', async () => {
    // Dos cabeceras sobre una sola lista es ruido.
    plantillas.mockResolvedValue({ success: true, data: [SUYA] });
    pinta();

    await screen.findByText('Mi recordatorio');
    expect(screen.queryByText('Del proceso de ventas')).toBeNull();
    expect(screen.queryByText('Tuyas y del equipo')).toBeNull();
  });

  it('las del proceso van primero, aunque lleguen después', async () => {
    plantillas.mockResolvedValue({ success: true, data: [SUYA, DEL_PROCESO] });
    const { container } = pinta();

    await screen.findByText('Día 1 · Saludo');
    const nombres = [...container.querySelectorAll('.wa-plantilla-nombre')]
      .map((n) => n.textContent);
    expect(nombres[0]).toContain('Día 1 · Saludo');
  });

  it('sigue rellenando los huecos con los datos de la persona', async () => {
    // Lo que ya funcionaba no se toca: el popup rellena antes de enseñar.
    plantillas.mockResolvedValue({ success: true, data: [DEL_PROCESO] });
    const { container } = pinta();

    await waitFor(() => {
      const cuerpo = container.querySelector('.wa-plantilla-cuerpo');
      expect(cuerpo?.textContent).toBe('Hola David');
    });
  });
});
