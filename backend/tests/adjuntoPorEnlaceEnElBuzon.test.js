import { describe, it, expect, vi } from 'vitest';

/**
 * Un adjunto por ENLACE no puede desaparecer en el camino (#91).
 *
 * El CRM manda por dos tubos: Brevo y el buzón propio. Brevo acepta los
 * adjuntos por url; el buzón usa nodemailer y su conversor **descartaba todo
 * lo que no llevara `content`**, en silencio.
 *
 * O sea: se comprobaba que estuvieran los tres documentos, se mandaban por
 * enlace, y según qué remitente se usara el cliente recibía el correo SIN
 * ellos — y el CRM decía «enviado». Eso es peor que no mandarlo: nadie va a
 * comprobar un correo que el sistema da por bueno.
 */

const enviados = [];
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (msg) => { enviados.push(msg); return { messageId: 'x' }; },
      verify: async () => true,
    }),
  },
}));
const avisos = [];
vi.mock('../src/shared/utils/logger.js', () => ({
  logger: { warn: (o) => avisos.push(o), info: () => {}, error: () => {}, debug: () => {} },
}));

// El buzón solo manda si tiene usuario y clave. Se ponen ANTES de importarlo:
// las lee al cargar el módulo.
process.env.SMTP_HOST = 'smtp.local';
process.env.SMTP_USER = 'crm@local';
process.env.SMTP_PASSWORD = 'x';

const { mandarDesdeBuzon } = await import('../src/shared/services/correo-buzon.service.js');

describe('los adjuntos del buzón propio', () => {
  it('manda los que van por enlace, que antes se perdían', async () => {
    enviados.length = 0;
    await mandarDesdeBuzon({
      to: { email: 'a@b.com' }, subject: 'Info', htmlContent: '<p>hola</p>',
      attachment: [{ name: 'Dossier.pdf', url: 'https://r2.local/d.pdf' }],
    });

    const adj = enviados[0]?.attachments || [];
    expect(adj).toHaveLength(1);
    // nodemailer se lo descarga del `path`.
    expect(adj[0].path).toBe('https://r2.local/d.pdf');
    expect(adj[0].filename).toBe('Dossier.pdf');
  });

  it('sigue mandando los de siempre, en base64', async () => {
    enviados.length = 0;
    await mandarDesdeBuzon({
      to: { email: 'a@b.com' }, subject: 'Factura', htmlContent: '<p>x</p>',
      attachment: [{ name: 'F.pdf', content: 'JVBERi0=' }],
    });

    const adj = enviados[0]?.attachments || [];
    expect(adj[0].content).toBe('JVBERi0=');
    expect(adj[0].encoding).toBe('base64');
  });

  it('uno que no se puede mandar QUEDA DICHO, no desaparece', async () => {
    enviados.length = 0; avisos.length = 0;
    await mandarDesdeBuzon({
      to: { email: 'a@b.com' }, subject: 'x', htmlContent: '<p>x</p>',
      attachment: [{ name: 'Roto.pdf' }],
    });

    expect(avisos.some((a) => a.nombre === 'Roto.pdf')).toBe(true);
  });
});
