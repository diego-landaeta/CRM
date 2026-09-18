import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * Las plantillas del paso, en la ficha del prospecto (#88).
 *
 * Las dos reglas del documento comercial que la pantalla tiene que cumplir, y
 * que son justo las que se pierden al refactorizar:
 *
 *   - SE COPIA, NO SE ENVÍA. «Natural antes que literal: la plantilla marca el
 *     orden, las palabras las pones tú». Un botón de enviar convierte diez
 *     conversaciones en diez mensajes idénticos.
 *   - LOS [CORCHETES] SE VEN. Es lo que la gestora tiene que escribir antes de
 *     mandar. Un «[importe]» que pase desapercibido llega al cliente.
 */

const get = vi.fn();
vi.mock('@/shared/api/client', () => ({
  default: { get: (...a) => get(...a), post: vi.fn(), patch: vi.fn() },
}));

const PlantillasDelPaso = (await import('@/modules/proceso/components/PlantillasDelPaso')).default;

const UNA = {
  id: 1,
  label: 'Día 1 · Ficha de la formación',
  texto: 'Inicio: marzo 2026\nInversión total: [importe]\nPlazas: [nº]',
  pide_adjunto: false,
  pista: null,
};

const responde = (datos) => get.mockResolvedValue({ success: true, data: datos });

describe('las plantillas del paso', () => {
  beforeEach(() => { get.mockReset(); });

  it('no hay ninguna forma de enviarlas desde aquí', async () => {
    responde({ whatsapp: [UNA], email: [] });
    render(<PlantillasDelPaso leadId={6} clave="paso_1" />);

    await screen.findByText(UNA.label);
    for (const b of screen.getAllByRole('button')) {
      expect(b.textContent).not.toMatch(/enviar|mandar/i);
    }
  });

  it('marca lo que queda por escribir a mano', async () => {
    responde({ whatsapp: [UNA], email: [] });
    const { container } = render(<PlantillasDelPaso leadId={6} clave="paso_1" />);

    // Se despliega: el texto no está a la vista hasta que se pide.
    fireEvent.click(await screen.findByRole('button', { name: /Ficha de la formación/ }));

    const marcados = [...container.querySelectorAll('mark')].map((m) => m.textContent);
    expect(marcados).toContain('[importe]');
    expect(marcados).toContain('[nº]');
    // Lo que el CRM sí sabe va sin marcar.
    expect(marcados.join(' ')).not.toContain('marzo');
  });

  it('dice cuántos huecos quedan sin salir de la lista', async () => {
    responde({ whatsapp: [UNA], email: [] });
    render(<PlantillasDelPaso leadId={6} clave="paso_1" />);
    expect(await screen.findByText('2 a mano')).toBeTruthy();
  });

  it('copia el texto entero, y el asunto con él', async () => {
    const escrito = [];
    Object.assign(navigator, { clipboard: { writeText: async (t) => { escrito.push(t); } } });
    responde({ whatsapp: [], email: [{ id: 9, label: 'Día 1 · Info', asunto: 'Sobre tu curso', texto: 'Hola David' }] });

    render(<PlantillasDelPaso leadId={6} clave="paso_1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Copiar/ }));

    await waitFor(() => expect(escrito).toHaveLength(1));
    // Un correo copiado sin asunto obliga a volver a buscarlo.
    expect(escrito[0]).toContain('Sobre tu curso');
    expect(escrito[0]).toContain('Hola David');
  });

  it('un paso sin plantillas no pinta nada', async () => {
    // Hay pasos que son una llamada. Un «no hay plantillas» solo ocupa sitio.
    responde({ whatsapp: [], email: [] });
    const { container } = render(<PlantillasDelPaso leadId={6} clave="paso_3" />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
