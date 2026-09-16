import { describe, it, expect } from 'vitest';
import { textoDeBot, esDeBot } from '../src/modules/whatsapp/mensajes-de-bot.js';
import { textoDe, tipoDeMensaje } from '../src/modules/whatsapp/media.service.js';

// «En el chat con el bot no me aparece nada», reportado por una gestora.
//
// Los mensajes llegaban y se guardaban, pero `textoDe` solo sabia leer texto
// plano y pies de adjunto. Todo lo demas quedaba con texto null y tipo «otro»,
// y la burbuja se pintaba vacia. Una conversacion con un bot esta hecha casi
// entera de estos tipos.

describe('lo que el prospecto pulso', () => {
  it('un boton: se ve lo que eligio, no un hueco', () => {
    // Esto es lo mas importante del fichero. Sin ello el mensaje existe, ocupa
    // su sitio en el chat y esta vacio: la gestora no sabe que contestaron.
    const m = { buttonsResponseMessage: { selectedDisplayText: 'Si, me interesa', selectedButtonId: 'btn_1' } };
    expect(textoDeBot(m)).toBe('Si, me interesa');
  });

  it('y si el boton no trae texto, al menos su identificador', () => {
    // Peor que el texto, pero infinitamente mejor que nada.
    const m = { buttonsResponseMessage: { selectedButtonId: 'quiero_info' } };
    expect(textoDeBot(m)).toBe('quiero_info');
  });

  it('una opcion de un menu', () => {
    const m = { listResponseMessage: { title: 'Master en Psicologia', description: '1.325 €' } };
    expect(textoDeBot(m)).toBe('Master en Psicologia\n1.325 €');
  });

  it('un boton de plantilla de empresa', () => {
    const m = { templateButtonReplyMessage: { selectedDisplayText: 'Hablar con un asesor' } };
    expect(textoDeBot(m)).toBe('Hablar con un asesor');
  });
});

describe('lo que manda el bot', () => {
  it('un menu de botones sale con sus opciones', () => {
    const m = { buttonsMessage: {
      contentText: '¿Que quieres hacer?',
      footerText: 'Responde con un boton',
      buttons: [
        { buttonId: 'a', buttonText: { displayText: 'Ver precios' } },
        { buttonId: 'b', buttonText: { displayText: 'Hablar con alguien' } },
      ],
    } };
    const t = textoDeBot(m);
    expect(t).toContain('¿Que quieres hacer?');
    expect(t).toContain('· Ver precios');
    expect(t).toContain('· Hablar con alguien');
    expect(t).toContain('Responde con un boton');
  });

  it('un desplegable con secciones aplana todas sus filas', () => {
    const m = { listMessage: {
      title: 'Nuestros programas',
      sections: [
        { title: 'Masters', rows: [{ title: 'Psicologia del Amor', rowId: 'r1' }] },
        { title: 'Cursos', rows: [{ title: 'Apego', rowId: 'r2' }, { title: 'Duelo', rowId: 'r3' }] },
      ],
    } };
    const t = textoDeBot(m);
    expect(t).toContain('· Psicologia del Amor');
    expect(t).toContain('· Apego');
    expect(t).toContain('· Duelo');
  });

  it('una plantilla de empresa', () => {
    const m = { templateMessage: { hydratedTemplate: {
      hydratedContentText: 'Tu plaza esta reservada',
      hydratedButtons: [{ quickReplyButton: { displayText: 'Confirmar' } }],
    } } };
    const t = textoDeBot(m);
    expect(t).toContain('Tu plaza esta reservada');
    expect(t).toContain('· Confirmar');
  });

  it('los botones nuevos, los de flujo nativo', () => {
    const m = { interactiveMessage: { body: { text: 'Elige una fecha' }, footer: { text: 'Septiembre' } } };
    expect(textoDeBot(m)).toBe('Elige una fecha\nSeptiembre');
  });
});

describe('sitios y contactos, que salian igual de vacios', () => {
  it('una ubicacion sale con su nombre y un enlace al mapa', () => {
    const m = { locationMessage: { name: 'ISEIE', address: 'Calle Mayor 1', degreesLatitude: 40.41, degreesLongitude: -3.70 } };
    const t = textoDeBot(m);
    expect(t).toContain('Ubicación');
    expect(t).toContain('ISEIE');
    expect(t).toMatch(/maps\?q=40\.41,-3\.7/);
  });

  it('una ubicacion sin coordenadas no inventa un enlace roto', () => {
    expect(textoDeBot({ locationMessage: { name: 'Por ahi' } })).toBe('Ubicación\nPor ahi');
  });

  it('un contacto compartido', () => {
    expect(textoDeBot({ contactMessage: { displayName: 'Marta Ruiz' } })).toBe('Contacto\nMarta Ruiz');
  });
});

describe('lo que NO tiene que tocar', () => {
  it('un texto normal no pasa por aqui', () => {
    expect(textoDeBot({ conversation: 'Hola' })).toBeNull();
    expect(esDeBot({ conversation: 'Hola' })).toBe(false);
  });

  it('una foto con pie tampoco', () => {
    expect(textoDeBot({ imageMessage: { caption: 'Mira' } })).toBeNull();
  });

  it('un objeto vacio o basura no revienta', () => {
    expect(textoDeBot({})).toBeNull();
    expect(textoDeBot(null)).toBeNull();
    expect(textoDeBot('no soy un mensaje')).toBeNull();
  });

  it('campos vacios no producen lineas en blanco', () => {
    // Un `title: ''` no puede acabar siendo un salto de linea suelto.
    const t = textoDeBot({ listMessage: { title: '', description: 'Solo esto', sections: [] } });
    expect(t).toBe('Solo esto');
  });
});

describe('enganchado donde hacia falta', () => {
  it('textoDe ya no devuelve null para un mensaje de bot', () => {
    // La funcion de verdad, la que usa el webhook. Antes: null.
    expect(textoDe({ buttonsResponseMessage: { selectedDisplayText: 'Si' } })).toBe('Si');
  });

  it('y nunca pisa un texto de verdad', () => {
    // Si algun dia llega un mensaje con las dos cosas, manda el texto.
    const m = { conversation: 'Lo que escribio', buttonsResponseMessage: { selectedDisplayText: 'Boton' } };
    expect(textoDe(m)).toBe('Lo que escribio');
  });

  it('el tipo pasa a ser texto, no «otro»', () => {
    // Con 'otro' la pantalla intenta pintar un adjunto que no existe.
    expect(tipoDeMensaje({ listResponseMessage: { title: 'Una opcion' } })).toEqual({ tipo: 'texto', clave: null });
  });

  it('pero un adjunto de verdad sigue siendo su tipo', () => {
    expect(tipoDeMensaje({ imageMessage: {} }).tipo).toBe('imagen');
    expect(tipoDeMensaje({ audioMessage: {} }).tipo).toBe('audio');
  });

  it('y lo que de verdad no se sabe leer sigue siendo «otro»', () => {
    // No se trata de que todo salga como texto: si llega algo desconocido, que
    // se note, no que se disfrace de mensaje vacio.
    expect(tipoDeMensaje({ algoQueNadieHaVistoMessage: {} }).tipo).toBe('otro');
  });
});

describe('los sobres, que es lo que se ve en produccion', () => {
  it('un documento con pie se lee, no se queda en «otro»', () => {
    // En produccion, el numero por el que entran los leads enseña una fila tras
    // otra de «Descargar otro» y ni una palabra. Son mensajes que acaban en tipo
    // «otro» sin texto, y una causa muy probable son los SOBRES: WhatsApp mete
    // el mensaje de verdad dentro de otro cuando es temporal, de una sola vista
    // o un documento con pie. Sin abrirlos, lo de dentro no se ve nunca.
    const m = { documentWithCaptionMessage: { message: { documentMessage: { fileName: 'dossier.pdf', caption: 'El dossier' } } } };
    expect(tipoDeMensaje(m).tipo).toBe('documento');
    expect(textoDe(m)).toBe('El dossier');
  });

  it('un mensaje temporal tambien', () => {
    const m = { ephemeralMessage: { message: { conversation: 'Hola desde dentro del sobre' } } };
    expect(tipoDeMensaje(m).tipo).toBe('texto');
    expect(textoDe(m)).toBe('Hola desde dentro del sobre');
  });

  it('y uno de una sola vista', () => {
    expect(tipoDeMensaje({ viewOnceMessageV2: { message: { imageMessage: {} } } }).tipo).toBe('imagen');
  });

  it('un sobre dentro de otro sobre', () => {
    const m = { deviceSentMessage: { message: { ephemeralMessage: { message: { conversation: 'doble' } } } } };
    expect(textoDe(m)).toBe('doble');
  });

  it('los botones del bot DENTRO de un sobre', () => {
    // Las dos cosas a la vez: un sobre y un tipo que antes no se leia.
    const m = { ephemeralMessage: { message: { buttonsResponseMessage: { selectedDisplayText: 'Si, me interesa' } } } };
    expect(textoDe(m)).toBe('Si, me interesa');
    expect(tipoDeMensaje(m).tipo).toBe('texto');
  });

  it('un sobre que se apunta a si mismo no cuelga el proceso', () => {
    // Un mensaje mal formado no puede dejar colgado al que atiende el webhook.
    const malo = {};
    malo.ephemeralMessage = { message: malo };
    expect(tipoDeMensaje(malo).tipo).toBe('otro');
  });

  it('y un mensaje sin sobre sigue igual que siempre', () => {
    expect(textoDe({ conversation: 'sin sobre' })).toBe('sin sobre');
    expect(tipoDeMensaje({ imageMessage: {} }).tipo).toBe('imagen');
  });
});
