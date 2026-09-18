import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * «Sin los tres, el correo no sale» (#91), en la pantalla.
 *
 * El aviso se enseña al elegir la plantilla del día 1, ANTES de escribir el
 * correo. Enterarse al pulsar enviar, con el mensaje ya redactado, es la peor
 * forma de enterarse — y es lo que pasaba, porque no existía ni la
 * comprobación ni los documentos.
 */

const adjuntos = vi.fn();
const enviar = vi.fn();
const listar = vi.fn();
const render_ = vi.fn();

vi.mock('@/modules/leads/api/lead-emails.api', () => ({
  leadEmailsApi: {
    send: (...a) => enviar(...a),
    list: vi.fn(),
    adjuntosDelDiaUno: (...a) => adjuntos(...a),
  },
}));
vi.mock('@/modules/email-templates/api/templates.api', () => ({
  emailTemplatesApi: { list: (...a) => listar(...a), render: (...a) => render_(...a) },
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectContext: () => ({ activeProject: { id: 1, nombre: 'Psiko' } }),
}));
vi.mock('@/shared/hooks/useToast', () => ({ toast: vi.fn() }));

const LeadEmailDialog = (await import('@/modules/leads/components/LeadEmailDialog')).default;

const PLANTILLA_DIA_1 = {
  id: 7, project_id: 1, name: 'Día 1 · Información y dossier',
  subject: 'Info', body_html: '<p>hola</p>', active: true,
  created_at: '', updated_at: '', paso_clave: 'paso_1',
};

const TRES = (guia, homo, dossier) => ({
  completo: guia && homo && dossier,
  piezas: [
    { tipo: 'dossier', como: 'el dossier de la formación', esta: dossier },
    { tipo: 'guia_campus', como: 'la guía del campus', esta: guia },
    { tipo: 'homologaciones', como: 'las homologaciones', esta: homo },
  ],
});

function pinta() {
  return render(
    <LeadEmailDialog open leadId={6} leadName="David" leadEmail="d@x.com"
      onClose={() => {}} onSent={() => {}} />
  );
}

/**
 * Elige la plantilla del día 1 en el desplegable.
 *
 * No es un `<select>` nativo: es el Select del CRM, un combobox con su lista
 * de opciones. Se abre y se pulsa la opción, que es lo que hace una persona.
 */
async function eligeLaDelDiaUno() {
  fireEvent.click(await screen.findByRole('combobox', { name: 'Plantilla de email' }));
  // La opción se confirma con mouseDown, no con click: el Select lo hace así
  // para que el foco no salte antes de elegir.
  fireEvent.mouseDown(await screen.findByRole('option', { name: PLANTILLA_DIA_1.name }));
}

describe('el correo del día 1', () => {
  beforeEach(() => {
    [adjuntos, enviar, listar, render_].forEach((f) => f.mockReset());
    listar.mockResolvedValue({ success: true, data: [PLANTILLA_DIA_1] });
    render_.mockResolvedValue({ success: true, data: { subject: 'Info', body_html: 'hola' } });
    enviar.mockResolvedValue({ success: true, data: { sent: true } });
  });

  it('con los tres, lo dice y deja enviar', async () => {
    adjuntos.mockResolvedValue({ success: true, data: TRES(true, true, true) });
    pinta();
    await eligeLaDelDiaUno();

    expect(await screen.findByText(/va con los tres documentos/i)).toBeTruthy();
    const boton = screen.getByRole('button', { name: /^Enviar$/ });
    await waitFor(() => expect(boton.disabled).toBe(false));
  });

  it('si falta uno, NO deja enviar y dice cuál', async () => {
    adjuntos.mockResolvedValue({ success: true, data: TRES(false, true, true) });
    pinta();
    await eligeLaDelDiaUno();

    expect(await screen.findByText(/no puede salir/i)).toBeTruthy();
    // Se enseñan los tres, no solo el que falta.
    expect(screen.getByText('la guía del campus')).toBeTruthy();
    expect(screen.getByText('el dossier de la formación')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Enviar$/ }).disabled).toBe(true);
    });
  });

  it('el envío le dice al servidor de qué paso es', async () => {
    // Sin esto el servidor no sabría que a este correo hay que exigirle los
    // tres, y la regla se quedaría solo en la pantalla.
    adjuntos.mockResolvedValue({ success: true, data: TRES(true, true, true) });
    pinta();
    await eligeLaDelDiaUno();
    await screen.findByText(/va con los tres documentos/i);

    fireEvent.click(screen.getByRole('button', { name: /^Enviar$/ }));
    await waitFor(() => expect(enviar).toHaveBeenCalled());
    expect(enviar.mock.calls[0][1]).toMatchObject({ paso: 'paso_1' });
  });

  it('un correo suelto, sin plantilla del proceso, no pide nada', async () => {
    // El que se escribe a mano a alguien que ya va por el día 4 no lleva los
    // tres documentos, y pedírselos sería un estorbo.
    pinta();
    await screen.findByLabelText('Plantilla de email');

    expect(screen.queryByText(/no puede salir/i)).toBeNull();
    expect(adjuntos).not.toHaveBeenCalled();
  });
});
