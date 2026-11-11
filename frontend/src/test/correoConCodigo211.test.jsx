import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/*
  #211 · Cambiar el correo con un código a la dirección nueva.

  «Mi perfil»: con su contraseña, «Mandarme el código»; con el código, «Cambiar
  mi correo». Quien no tiene «Cambiar su correo» (p. ej. el project manager)
  no ve la sección. Y en la ficha de usuario del superadmin, «Aplicar sin
  código» sale desmarcado: de serie, con código.
*/

const avisos = vi.hoisted(() => ({ toast: vi.fn() }));
const api = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), get: vi.fn() }));
const sesion = vi.hoisted(() => ({ permisos: {} }));
vi.mock('@/shared/hooks/useToast', () => ({ toast: avisos.toast }));
vi.mock('@/shared/api/client', () => ({ default: api }));
vi.mock('@/shared/components/ui/portal', () => ({ default: ({ children }) => children }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 9, nombre: 'Ana', email: 'ana@viejo.com', role: 'gestor' },
    permissions: sesion.permisos, refreshUser: vi.fn(), logout: vi.fn(),
  }),
}));
vi.mock('@/contexts/ProjectContext', () => ({ useProjectContext: () => ({ projects: [] }) }));
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }), useOptionalTheme: () => 'dark',
}));

const { default: ProfilePage } = await import('@/shared/pages/ProfilePage');
const { default: UserFormDialog } = await import('@/modules/users/components/UserFormDialog');

const pintar = () => render(<MemoryRouter><ProfilePage /></MemoryRouter>);
const esperar = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  vi.clearAllMocks();
  sesion.permisos = { 'cuenta.cambiar_correo': true };
  api.get.mockResolvedValue({ success: true, data: [] });
  api.post.mockResolvedValue({ success: true, data: { email: 'ana@nuevo.com', enviado: true, minutos: 15 } });
  api.patch.mockResolvedValue({ success: true, data: { email: 'ana@nuevo.com', cambiado: true } });
});

describe('«Mi perfil» · el correo con código (#211)', () => {
  it('paso 1: con la contraseña actual pide el código a la dirección nueva; todavía no cambia', async () => {
    pintar();
    const form = screen.getByRole('form', { name: 'Cambiar mi correo' });
    fireEvent.change(within(form).getByLabelText('Mi correo nuevo'), { target: { value: 'Ana@Nuevo.com' } });
    // Sin contraseña no se puede pedir.
    expect(within(form).getByRole('button', { name: 'Mandarme el código' })).toBeDisabled();
    fireEvent.change(within(form).getByLabelText('Mi contraseña actual'), { target: { value: 'secreta' } });
    fireEvent.submit(form);
    await esperar();
    expect(api.post).toHaveBeenCalledWith('/auth/me/email/codigo', { email: 'ana@nuevo.com', password: 'secreta' });
    expect(api.patch).not.toHaveBeenCalledWith('/auth/me/email', expect.anything());
    expect(screen.getByRole('form', { name: 'Confirmar mi correo nuevo' })).toBeInTheDocument();
  });

  it('paso 2: con las 6 cifras del código, cambia', async () => {
    pintar();
    const form = screen.getByRole('form', { name: 'Cambiar mi correo' });
    fireEvent.change(within(form).getByLabelText('Mi correo nuevo'), { target: { value: 'ana@nuevo.com' } });
    fireEvent.change(within(form).getByLabelText('Mi contraseña actual'), { target: { value: 'secreta' } });
    fireEvent.submit(form);
    await esperar();
    const paso2 = screen.getByRole('form', { name: 'Confirmar mi correo nuevo' });
    const campo = within(paso2).getByLabelText(/El código que te ha llegado a ana@nuevo.com/);
    // Solo cifras, y como mucho seis.
    fireEvent.change(campo, { target: { value: '12a34567' } });
    expect(campo.value).toBe('123456');
    fireEvent.submit(paso2);
    await esperar();
    expect(api.patch).toHaveBeenCalledWith('/auth/me/email', { codigo: '123456' });
  });

  it('sin «Cambiar su correo» (p. ej. el project manager) no sale la sección', () => {
    sesion.permisos = {};
    pintar();
    expect(screen.queryByRole('form', { name: 'Cambiar mi correo' })).toBeNull();
  });
});

describe('la ficha de usuario del superadmin (#211)', () => {
  const base = {
    projects: [], canResetPassword: true, canChangeEmail: true, loading: false,
    onClose: vi.fn(), onSubmit: vi.fn(), onCheckEmail: vi.fn().mockResolvedValue(null), onResetPassword: vi.fn(),
  };
  const usuario = { id: 4, nombre: 'Laura', email: 'laura@empresa.com', role: 'gestor', projects: [{ project_id: 1, can_view: true, can_edit: true }] };

  it('con un correo nuevo, «Aplicar sin código» sale desmarcado: de serie, con código', () => {
    render(<UserFormDialog {...base} user={usuario} />);
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'laura@nueva.com' } });
    const casilla = screen.getByRole('checkbox', { name: /Aplicar sin código/ });
    expect(casilla).not.toBeChecked();
    expect(screen.getByText(/le llega un código de 6 cifras a la dirección nueva/)).toBeInTheDocument();
    // El «reenviar enlace» solo tiene sentido si se aplica al momento.
    expect(screen.queryByRole('checkbox', { name: /Reenviar enlace/ })).toBeNull();
    fireEvent.click(casilla);
    expect(screen.getByRole('checkbox', { name: /Reenviar enlace/ })).toBeInTheDocument();
  });
});
