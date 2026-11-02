import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IncidenciaDialog from '@/modules/incidencias/components/IncidenciaDialog';

/**
 * Incidencias (#253): una nueva sale con el campus o la empresa de arriba.
 *
 * Visto en la prueba a mano (02/11): con Psiko arriba, «Campus o empresa» salía
 * en «Ninguno (todo el CRM)», y la incidencia no aparecía en la lista de Psiko
 * que se estaba mirando. Con «Todos» arriba sigue en «Ninguno».
 */

const campus = [
  { id: 1, nombre: 'Psiko Aprende', sociedad_emisora_id: 10, sociedad_nombre: 'CEDIA' },
  { id: 2, nombre: 'ISEIH', sociedad_emisora_id: null },
];

function abrir(props = {}) {
  render(
    <MemoryRouter>
      <IncidenciaDialog personas={[]} campus={campus} yo={1} onCerrar={() => {}} onGuardada={() => {}} {...props} />
    </MemoryRouter>,
  );
  return document.getElementById('inc-donde').textContent;
}

describe('el campus de una incidencia nueva', () => {
  it('con un campus arriba, sale ese campus', () => {
    expect(abrir({ dondeInicial: 'p:1' })).toContain('Campus · Psiko Aprende');
  });

  it('con una empresa arriba, sale esa empresa', () => {
    expect(abrir({ dondeInicial: 'e:10' })).toContain('Empresa · CEDIA');
  });

  it('con «Todos» arriba, sigue en «Ninguno (todo el CRM)»', () => {
    expect(abrir({ dondeInicial: '' })).toContain('Ninguno (todo el CRM)');
  });

  it('un campus que no es suyo no se pone: «Ninguno»', () => {
    expect(abrir({ dondeInicial: 'p:99' })).toContain('Ninguno (todo el CRM)');
  });

  it('al editar una que ya existe, manda la suya y no la de arriba', () => {
    const inc = { id: 5, projectId: 2, tipos: ['capa8'], quePaso: 'x', estado: 'open', gravedad: 'medium', ocurrioAt: '2026-10-06T10:00:00Z' };
    expect(abrir({ incidencia: inc, dondeInicial: 'p:1' })).toContain('Campus · ISEIH');
  });
});
