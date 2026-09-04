import { describe, it, expect } from 'vitest';
import { telefonoVisible } from '../modules/whatsapp/pages/ChatPage';

/**
 * Donde va un telefono se pone un telefono, o nada.
 *
 * WhatsApp identifica cada vez a mas gente por «@lid»: un identificador que
 * dice quien es la persona SIN dar su numero. La cabecera del chat pintaba sus
 * catorce cifras como si fueran su movil — «95069319217252 · sin prospecto» —
 * y eso no se puede marcar, ni buscar, ni significa nada para quien lo lee.
 *
 * Se vio con una llamada de verdad: quien llamo entro por «@lid» y el chat se
 * quedo con las cifras de titulo.
 */

describe('el telefono que se ensena', () => {
  it('un movil de verdad se ensena', () => {
    expect(telefonoVisible({ jid: '34600111222@s.whatsapp.net', telefono: '34600111222' }))
      .toBe('34600111222');
  });

  it('un «@lid» NO: no es un telefono', () => {
    expect(telefonoVisible({ jid: '95069319217252@lid', telefono: '95069319217252' }))
      .toBeNull();
  });

  it('un grupo tampoco: eso es su identificador', () => {
    expect(telefonoVisible({ jid: '120363412958104027@g.us', telefono: '120363412958104027' }))
      .toBeNull();
  });

  it('ni marcado como grupo aunque el jid no lo diga', () => {
    expect(telefonoVisible({ jid: '', telefono: '120363412958104027', es_grupo: true })).toBeNull();
  });

  it('un telefono en blanco es nada, no una cadena vacia', () => {
    expect(telefonoVisible({ jid: '34600111222@s.whatsapp.net', telefono: '   ' })).toBeNull();
  });
});
