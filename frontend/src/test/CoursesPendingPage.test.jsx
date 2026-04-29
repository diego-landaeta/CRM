import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// vi.hoisted asegura que las refs se evalúen antes que los vi.mock factories
const { mockUser, mockProject, mockClient } = vi.hoisted(() => ({
  mockUser: { value: { id: 1, role: 'creador' } },
  mockProject: { value: { id: 1, nombre: 'Psiko Aprende', producto_label: 'Curso', producto_label_plural: 'Cursos' } },
  mockClient: { get: vi.fn(), patch: vi.fn() },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser.value }),
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectContext: () => ({ activeProject: mockProject.value }),
}));
vi.mock('@/shared/api/client', () => ({ default: mockClient }));
vi.mock('@/shared/components/ui/ConfirmDialog', () => ({
  default: ({ open, title }) => (open ? <div data-testid="confirm-dialog">{title}</div> : null),
}));

import CoursesPendingPage from '@/modules/products/pages/CoursesPendingPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <CoursesPendingPage />
    </MemoryRouter>,
  );
}

describe('CoursesPendingPage (CRM-142)', () => {
  beforeEach(() => {
    mockClient.get.mockReset();
    mockClient.patch.mockReset();
    mockUser.value = { id: 1, role: 'creador' };
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('bloquea acceso para roles no autorizados', () => {
    mockUser.value = { id: 2, role: 'gestor' };
    renderPage();
    expect(screen.getByText(/Sin permisos/i)).toBeInTheDocument();
    expect(mockClient.get).not.toHaveBeenCalled();
  });

  it('muestra empty state cuando no hay cursos pendientes', async () => {
    mockClient.get.mockResolvedValue({ success: true, data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Sin cursos pendientes/i)).toBeInTheDocument();
    });
  });

  it('renderiza cards con cursos pendientes filtrados', async () => {
    mockClient.get.mockResolvedValue({
      success: true,
      data: [
        { id: 1, nombre: 'Curso pendiente A', estado_creacion: 'pendiente_crear', solicitado_por_nombre: 'Laura' },
        { id: 2, nombre: 'Curso ya creado', estado_creacion: 'creado' },
        { id: 3, nombre: 'Curso pendiente B', estado_creacion: 'pendiente_crear' },
      ],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Curso pendiente A')).toBeInTheDocument();
    });
    expect(screen.getByText('Curso pendiente B')).toBeInTheDocument();
    expect(screen.queryByText('Curso ya creado')).not.toBeInTheDocument();
    expect(screen.getByText(/Laura/)).toBeInTheDocument();
  });

  it('admin también tiene acceso', async () => {
    mockUser.value = { id: 99, role: 'admin' };
    mockClient.get.mockResolvedValue({ success: true, data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Sin cursos pendientes/i)).toBeInTheDocument();
    });
  });

  it('superadmin también tiene acceso', async () => {
    mockUser.value = { id: 99, role: 'superadmin' };
    mockClient.get.mockResolvedValue({ success: true, data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Sin cursos pendientes/i)).toBeInTheDocument();
    });
  });

  it('hace fallback al endpoint general si la query con filtro falla', async () => {
    mockClient.get
      .mockRejectedValueOnce(new Error('404 — endpoint con filtro no soportado'))
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: 1, nombre: 'Curso X', estado_creacion: 'pendiente_crear' }],
      });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Curso X')).toBeInTheDocument();
    });
    // 1ª llamada con filtro, 2ª sin
    expect(mockClient.get).toHaveBeenCalledTimes(2);
    expect(mockClient.get.mock.calls[0][0]).toContain('estado_creacion=pendiente_crear');
    expect(mockClient.get.mock.calls[1][0]).not.toContain('estado_creacion');
  });
});
