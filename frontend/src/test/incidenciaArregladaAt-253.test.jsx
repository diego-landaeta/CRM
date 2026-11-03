import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Incidencias (#253): «Cuándo se arregló» se puede borrar.
 *
 * Auditoría del 02/11: al vaciar el campo no se mandaba nada y se quedaba la
 * fecha de antes. Si nunca tuvo fecha, sigue sin mandarse (al cerrarla la pone
 * el servidor).
 */

const editar = vi.fn();
vi.mock('@/modules/incidencias/api/incidencias.api', async (original) => ({
  ...(await original()),
  incidenciasApi: { editar: (...a) => editar(...a), subirAdjunto: vi.fn() },
}));

const { default: IncidenciaDialog } = await import('@/modules/incidencias/components/IncidenciaDialog');

const base = { id: 7, projectId: null, sociedadId: null, tipos: ['capa8'], quePaso: 'Se borró un prospecto', estado: 'resolved', gravedad: 'medium', ocurrioAt: '2026-10-06T10:00:00Z', adjuntos: [] };

async function guardarCon(incidencia) {
  render(
    <MemoryRouter>
      <IncidenciaDialog incidencia={incidencia} personas={[]} campus={[]} yo={1} onCerrar={() => {}} onGuardada={() => {}} />
    </MemoryRouter>,
  );
  fireEvent.change(document.getElementById('inc-arreglo-cuando'), { target: { value: '' } });
  fireEvent.submit(document.querySelector('form'));
  await waitFor(() => expect(editar).toHaveBeenCalled());
  return editar.mock.calls[0][1];
}

describe('«Cuándo se arregló» al editar', () => {
  beforeEach(() => {
    editar.mockReset();
    editar.mockResolvedValue({ success: true, data: base });
  });

  it('si tenía fecha y se vacía, se manda el vacío', async () => {
    const datos = await guardarCon({ ...base, arregladaAt: '2026-10-20T10:00:00Z' });
    expect(datos).toHaveProperty('arregladaAt', null);
  });

  it('si nunca tuvo fecha, no se manda: la pone el servidor al cerrarla', async () => {
    const datos = await guardarCon({ ...base, arregladaAt: null });
    expect(datos).not.toHaveProperty('arregladaAt');
  });
});
