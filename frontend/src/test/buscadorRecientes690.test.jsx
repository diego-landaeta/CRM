import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * #690 · El buscador montado de verdad, con recientes guardados ANTES de juntar
 * los webhooks: los de las direcciones viejas siguen saliendo, con su dirección
 * y su sección de hoy, y los que hoy no se pueden abrir, no.
 */

const get = vi.fn();
vi.mock('@/shared/api/client', () => ({ default: { get: (...a) => get(...a) } }));
const AUTH = { user: { id: 1, role: 'superadmin', roles_extra: [] }, permissions: {}, logout: () => {} };
const PROYECTO = { activeProject: { id: 7, nombre: 'Psiko', type: 'educacion', modules: { make: false } }, projects: [], switchProject: () => {}, activeIssuerId: null };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => AUTH }));
vi.mock('@/contexts/ProjectContext', () => ({ useProjectContext: () => PROYECTO }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }), useOptionalTheme: () => 'light' }));
vi.mock('@/shared/hooks/useAmbito', () => ({ useIdsDelAmbito: () => [7] }));
vi.mock('@/shared/hooks/useToast', () => ({ toast: vi.fn() }));

const { default: CommandPalette } = await import('@/shared/components/layout/CommandPalette');

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ success: true, data: [] });
  localStorage.setItem('crm.palette.recents', JSON.stringify([
    { label: 'Webhooks', sublabel: 'Captación', to: '/captacion/webhooks' },
    { label: 'Webhook de transferencias', sublabel: 'Conexión', to: '/conexion/webhook-transferencias' },
    // Make está apagado en este campus: su pestaña no sale, y su reciente tampoco.
    { label: 'Make', sublabel: 'Captación', to: '/captacion/make' },
  ]));
});

describe('recientes de antes de juntar los webhooks', () => {
  it('salen con su dirección y su sección de hoy; el de una pestaña que no se puede abrir, no', async () => {
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    act(() => { window.dispatchEvent(new Event('crm:open-palette')); });
    const lista = await screen.findByRole('listbox');
    const opciones = within(lista).getAllByRole('option').map((o) => o.textContent);
    const prospectos = opciones.find((t) => t.startsWith('Webhooks'));
    expect(prospectos).toContain('Conexión › Webhooks');
    expect(prospectos).not.toContain('Captación');
    expect(opciones.some((t) => t.startsWith('Webhook de transferencias') && t.includes('Conexión › Webhooks'))).toBe(true);
    expect(opciones.some((t) => t.startsWith('Make'))).toBe(false);
  });
});
