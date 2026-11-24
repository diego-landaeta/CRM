import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * La tutora redactora no ve «Mis cursos y comisiones» en Mi campus (Diego, 24/11/2026):
 * cobra por su factura del mes, no por comisiones. La tutora, sí.
 */
const sesion = { user: { id: 7, role: 'tutor_redactor' } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => sesion }));
vi.mock('@/modules/tutores/api/tutores.api', async (orig) => ({
  ...(await orig()),
  tutoresApi: { miCampus: vi.fn().mockResolvedValue({ success: true, data: { campus: [], elegidos: null } }) },
}));
vi.mock('@/modules/consultas/api/consultas.api', async (orig) => ({
  ...(await orig()),
  consultasApi: { mias: vi.fn().mockResolvedValue({ data: { consultas: [], plazoHoras: 24 } }) },
}));
vi.mock('@/shared/hooks/useToast', () => ({ toast: vi.fn() }));
vi.mock('@/modules/tutores/pages/MisCursosPage', () => ({ default: () => <p>LISTA DE COMISIONES</p> }));

const { default: MiCampusPage } = await import('@/modules/tutores/pages/MiCampusPage');
const { esSoloRedactora } = await import('@/shared/lib/roles');

afterEach(() => cleanup());

describe('Mi campus sin comisiones para la redactora', () => {
  it('solo redactora: ni la pestaña ni la lista, aunque llegue con ?vista=cursos', () => {
    sesion.user = { id: 7, role: 'tutor_redactor' };
    render(<MemoryRouter initialEntries={['/mis-cursos/campus?vista=cursos']}><MiCampusPage /></MemoryRouter>);
    expect(screen.queryByRole('tab', { name: /Mis cursos y comisiones/ })).toBeNull();
    expect(screen.queryByText('LISTA DE COMISIONES')).toBeNull();
  });

  it('la tutora sigue con su pestaña', () => {
    sesion.user = { id: 8, role: 'tutor' };
    render(<MemoryRouter><MiCampusPage /></MemoryRouter>);
    expect(screen.getByRole('tab', { name: /Mis cursos y comisiones/ })).toBeTruthy();
  });

  it('quién es «solo redactora»', () => {
    expect(esSoloRedactora({ role: 'tutor_redactor' })).toBe(true);
    expect(esSoloRedactora({ role: 'tutor_redactor', roles_extra: ['tutor'] })).toBe(false);
    expect(esSoloRedactora({ role: 'tutor' })).toBe(false);
    expect(esSoloRedactora(null)).toBe(false);
  });
});
