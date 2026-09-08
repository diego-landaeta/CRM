import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// El selector de plantillas del chat.
//
// Existe porque las plantillas no servian para nada: se creaban en su pantalla y
// alli se quedaban. En el chat no habia forma de insertarlas —habia que ir,
// copiar a mano, volver y pegar— y el motor que rellena los huecos no lo
// importaba NADIE. Era codigo muerto mientras la pagina de ayuda prometia que
// «se rellenan con los datos de esa persona».
//
// Se prueba montado y no por la API porque lo que fallaba era justo eso: las
// piezas existian por separado y ninguna se tocaba.

const plantillas = vi.fn();
vi.mock('@/modules/whatsapp/api/whatsapp.api', () => ({
  whatsappApi: { plantillas: (...a) => plantillas(...a) },
}));

import SelectorPlantillas from '@/modules/whatsapp/components/SelectorPlantillas';

const LISTA = [
  { id: 1, label: 'Primer contacto', body: 'Hola {nombre}, te escribo por {producto}.', ambito: 'compartida' },
  { id: 2, label: 'Matrícula abierta', body: '{nombre}, ya está abierta la matrícula.', ambito: 'personal' },
  { id: 3, label: 'Seguimiento', body: '¿Pudiste ver lo que te mandé?', ambito: 'personal' },
];

const MARTA = { nombre: 'Marta Ruiz Díaz', email: 'marta@ejemplo.com', telefono: '+34600111222', producto: 'Máster en Logopedia' };

const montar = (props = {}) => render(
  <MemoryRouter>
    <SelectorPlantillas
      projectId={1}
      datos={MARTA}
      nombreProyecto="Psiko Aprende"
      alElegir={props.alElegir || vi.fn()}
      alCerrar={props.alCerrar || vi.fn()}
      {...props}
    />
  </MemoryRouter>
);

beforeEach(() => {
  plantillas.mockReset().mockResolvedValue({ success: true, data: LISTA });
});

describe('elegir una plantilla desde el chat', () => {
  it('pinta las plantillas del proyecto', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('Primer contacto')).toBeTruthy());
    expect(screen.getByText('Seguimiento')).toBeTruthy();
  });

  it('el adelanto se ve YA RELLENO, no con las llaves crudas', async () => {
    // Es la mitad del valor: si hay que leer «Hola {nombre}» y adivinar como
    // queda, la plantilla no ahorra la revision.
    montar();
    await waitFor(() => expect(screen.getByText(/Hola Marta, te escribo por Máster en Logopedia/)).toBeTruthy());
    expect(screen.queryByText(/\{nombre\}/)).toBeNull();
  });

  it('al elegir devuelve el texto relleno, y NO lo envia', async () => {
    // Elegir no es enviar: el texto entra en el campo para poder ajustarlo,
    // igual que se hace con la nota de voz.
    const alElegir = vi.fn();
    const alCerrar = vi.fn();
    montar({ alElegir, alCerrar });
    await waitFor(() => expect(screen.getByText('Primer contacto')).toBeTruthy());
    fireEvent.click(screen.getByText('Primer contacto'));
    expect(alElegir).toHaveBeenCalledWith('Hola Marta, te escribo por Máster en Logopedia.');
    expect(alCerrar).toHaveBeenCalled();
  });

  it('usa el nombre de pila, no el completo', async () => {
    montar();
    await waitFor(() => expect(screen.getByText(/Hola Marta,/)).toBeTruthy());
    expect(screen.queryByText(/Hola Marta Ruiz Díaz/)).toBeNull();
  });

  it('busca sin tildes: «matricula» encuentra «Matrícula»', async () => {
    // Sin esto, quien escribe rapido y sin acentos no encuentra nada — y es lo
    // que hace todo el mundo.
    montar();
    await waitFor(() => expect(screen.getByText('Matrícula abierta')).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Buscar una plantilla/i), { target: { value: 'matricula' } });
    expect(screen.getByText('Matrícula abierta')).toBeTruthy();
    expect(screen.queryByText('Seguimiento')).toBeNull();
  });

  it('busca tambien por el CONTENIDO, no solo por el nombre', async () => {
    // Muchas veces se recuerda una frase de la plantilla y no como se llamo.
    montar();
    await waitFor(() => expect(screen.getByText('Seguimiento')).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Buscar una plantilla/i), { target: { value: 'pudiste ver' } });
    expect(screen.getByText('Seguimiento')).toBeTruthy();
    expect(screen.queryByText('Primer contacto')).toBeNull();
  });

  it('avisa de los huecos que NO se pueden rellenar', async () => {
    // Una conversacion sin prospecto no tiene nombre. Sin este aviso saldria un
    // «Hola {nombre}» al otro lado.
    montar({ datos: {} });
    await waitFor(() => expect(screen.getByText('Primer contacto')).toBeTruthy());
    expect(screen.getAllByText(/Falta.*\{nombre\}/).length).toBeGreaterThan(0);
  });

  it('sin ninguna plantilla, ofrece crear la primera', async () => {
    plantillas.mockResolvedValue({ success: true, data: [] });
    montar();
    await waitFor(() => expect(screen.getByText(/Todavía no hay plantillas/)).toBeTruthy());
    expect(screen.getByText('Crear la primera')).toBeTruthy();
  });

  it('si el filtro no encuentra nada, eso es OTRA cosa que no tener ninguna', async () => {
    // Y la salida es distinta: ahi lo util es quitar la busqueda, no crear una.
    montar();
    await waitFor(() => expect(screen.getByText('Seguimiento')).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Buscar una plantilla/i), { target: { value: 'zzzz' } });
    expect(screen.getByText(/Ninguna coincide/)).toBeTruthy();
    expect(screen.getByText('Quitar la búsqueda')).toBeTruthy();
    expect(screen.queryByText('Crear la primera')).toBeNull();
  });

  it('si no se pueden cargar, lo dice', async () => {
    plantillas.mockResolvedValue({ success: false, error: 'No hay conexión' });
    montar();
    await waitFor(() => expect(screen.getByText('No hay conexión')).toBeTruthy());
  });
});
