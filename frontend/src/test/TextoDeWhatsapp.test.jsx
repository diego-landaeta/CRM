import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TextoDeWhatsapp from '../modules/whatsapp/components/TextoDeWhatsapp';

// «Aparecen unas letras en los mensajes enviados (se siguen enviando y no
// permite corregir desde la app)» — reportado por una gestora.
//
// Esas letras eran los asteriscos del formato de WhatsApp: el chat pintaba el
// texto crudo, asi que `*Plazas disponibles:*` salia con los asteriscos a la
// vista mientras el movil lo enseñaba en negrita.

const pinta = (texto) => render(<TextoDeWhatsapp texto={texto} />).container;

describe('el formato de WhatsApp', () => {
  it('la negrita, que es la del caso reportado', () => {
    const c = pinta('*Plazas disponibles:* 3');
    expect(c.querySelector('strong')).toHaveTextContent('Plazas disponibles:');
    expect(c.textContent).not.toContain('*');
  });

  it('la cursiva', () => {
    expect(pinta('esto es _importante_').querySelector('em')).toHaveTextContent('importante');
  });

  it('el tachado', () => {
    expect(pinta('~1.500 €~ 1.325 €').querySelector('s')).toHaveTextContent('1.500 €');
  });

  it('el monoespaciado', () => {
    expect(pinta('el codigo es ```ABC123```').querySelector('code')).toHaveTextContent('ABC123');
  });

  it('varios en la misma linea', () => {
    const c = pinta('*Master* en _Psicologia_ por ~1.500~ 1.325 €');
    expect(c.querySelector('strong')).toHaveTextContent('Master');
    expect(c.querySelector('em')).toHaveTextContent('Psicologia');
    expect(c.querySelector('s')).toHaveTextContent('1.500');
  });

  it('anidados', () => {
    const c = pinta('*negrita con _cursiva_ dentro*');
    expect(c.querySelector('strong em')).toHaveTextContent('cursiva');
  });

  it('el mensaje entero de la captura, sin un solo asterisco suelto', () => {
    const real = [
      '*Master en Psicología del Amor, Apego y Relaciones Conscientes*',
      '*Información general*',
      '*Inicio:* 11 de Septiembre del 2026',
      '*Plazas disponibles:* 3 disponibles',
      '*Precio:* 1.325 € (26.185 MXN aproximadamente)',
      '*Cierre de convocatoria:* 11 de Septiembre (O hasta agotar plazas)',
    ].join('\n');
    const c = pinta(real);
    expect(c.textContent).not.toContain('*');
    expect(c.querySelectorAll('strong').length).toBe(6);
    // Y el contenido sigue entero, no se ha comido nada por el camino.
    expect(c.textContent).toContain('11 de Septiembre del 2026');
    expect(c.textContent).toContain('26.185 MXN aproximadamente');
  });
});

describe('lo que NO tiene que tocar', () => {
  it('una multiplicacion no es negrita', () => {
    // `2*3*4` con el 3 en negrita seria peor que dejar los asteriscos.
    const c = pinta('son 2*3*4 unidades');
    expect(c.querySelector('strong')).toBeNull();
    expect(c.textContent).toBe('son 2*3*4 unidades');
  });

  it('un asterisco suelto se queda como esta', () => {
    const c = pinta('cuesta 5* mas impuestos');
    expect(c.querySelector('strong')).toBeNull();
    expect(c.textContent).toBe('cuesta 5* mas impuestos');
  });

  it('un guion bajo dentro de una palabra no es cursiva', () => {
    // Los identificadores tecnicos llegan por el chat mas de lo que parece.
    const c = pinta('el campo lead_id_nuevo');
    expect(c.querySelector('em')).toBeNull();
    expect(c.textContent).toBe('el campo lead_id_nuevo');
  });

  it('una direccion con guiones bajos no se parte', () => {
    const url = 'https://360crm.tech/docs/mi_fichero_final.pdf';
    expect(pinta(url).textContent).toBe(url);
  });

  it('dentro del monoespaciado no se busca mas formato', () => {
    const c = pinta('```peso *2* kilos```');
    expect(c.querySelector('code')).toHaveTextContent('peso *2* kilos');
    expect(c.querySelector('strong')).toBeNull();
  });

  it('los saltos de linea siguen ahi: los pone el CSS, no se comen aqui', () => {
    expect(pinta('una\ndos\ntres').textContent).toBe('una\ndos\ntres');
  });
});

describe('nada de meter etiquetas en nuestra pantalla', () => {
  it('el HTML que llegue por el chat se pinta como texto', () => {
    // El texto lo escribe quien esta al otro lado. No hay ninguna razon para
    // dejarle poner etiquetas: por eso se construyen nodos y no innerHTML.
    const c = pinta('<img src=x onerror=alert(1)>');
    expect(c.querySelector('img')).toBeNull();
    expect(c.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('ni disfrazado de negrita', () => {
    const c = pinta('*<script>alert(1)</script>*');
    expect(c.querySelector('script')).toBeNull();
    expect(c.querySelector('strong')).toHaveTextContent('<script>alert(1)</script>');
  });
});

describe('los bordes', () => {
  it('sin texto no pinta nada', () => {
    expect(pinta('').textContent).toBe('');
  });

  it('solo marcas, sin contenido dentro', () => {
    expect(pinta('**').textContent).toBe('**');
  });

  it('una marca que abre y nunca cierra', () => {
    expect(pinta('*empieza y no acaba').textContent).toBe('*empieza y no acaba');
  });

  it('un texto largo con muchas marcas no se atasca', () => {
    const largo = Array.from({ length: 200 }, (_, i) => `*n${i}*`).join(' ');
    const c = pinta(largo);
    expect(c.querySelectorAll('strong').length).toBe(200);
  });
});
