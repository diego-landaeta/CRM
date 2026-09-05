import { describe, it, expect } from 'vitest';
import { mensajeDeError } from '@/modules/proceso/api/proceso.api';
import { nombreDeCanal, iconoDeCanal, CANALES } from '@/modules/proceso/lib/canales';
import { textoDeDias, puedeEditar } from '@/modules/proceso/pages/ProcesoPage';

/*
  El proceso comercial (#115).

  Aquí solo lo que se puede comprobar sin pintar: cómo se leen los días, qué
  se enseña cuando el servidor dice que no, y quién puede tocar. Lo que hay
  que ver —la lista, el arrastre, los botones escondidos— va en el e2e.
*/

describe('cómo se leen los días', () => {
  it('un rango se escribe como rango', () => {
    expect(textoDeDias(0, 1)).toBe('Días 0-1');
    expect(textoDeDias(7, 8)).toBe('Días 7-8');
  });

  it('un solo día no se escribe como rango de sí mismo', () => {
    // El paso 3 es «día 4», no «días 4-4».
    expect(textoDeDias(4, 4)).toBe('Día 4');
    expect(textoDeDias(4, null)).toBe('Día 4');
    expect(textoDeDias(null, 4)).toBe('Día 4');
  });

  it('el de seguimiento no tiene días y lo dice', () => {
    // `dia_desde` y `dia_hasta` llegan a null: es de fin de mes, no de la cola.
    expect(textoDeDias(null, null)).toBe('—');
  });

  it('el día cero es un día, no un vacío', () => {
    // Con un `||` en vez de un `??` esto saldría «—», y el paso 1 empieza el
    // mismo día que entra el prospecto.
    expect(textoDeDias(0, 0)).toBe('Día 0');
  });
});

describe('quién puede tocar', () => {
  it('solo administradores', () => {
    expect(puedeEditar('admin')).toBe(true);
    expect(puedeEditar('superadmin')).toBe(true);
  });

  it('el resto solo mira', () => {
    // La API responde 403, asi que los botones se esconden en vez de fallar.
    expect(puedeEditar('gestor')).toBe(false);
    expect(puedeEditar('soporte')).toBe(false);
    expect(puedeEditar('tutor')).toBe(false);
    expect(puedeEditar(undefined)).toBe(false);
  });
});

describe('lo que se dice cuando el servidor dice que no', () => {
  it('traduce los tres errores del contrato', () => {
    // «Error 409» no le dice nada a quien está delante.
    expect(mensajeDeError(409, 'x')).toMatch(/clave/i);
    expect(mensajeDeError(400, 'x')).toMatch(/anterior al inicial/i);
    expect(mensajeDeError(404, 'x')).toMatch(/no es de este proyecto/i);
  });

  it('el 403 dice de quién es la culpa, no que se ha roto algo', () => {
    expect(mensajeDeError(403, 'x')).toMatch(/administrador/i);
  });

  it('lo que no conoce lo deja pasar tal cual', () => {
    expect(mensajeDeError(500, 'El servidor se ha caído')).toBe('El servidor se ha caído');
    expect(mensajeDeError(undefined, 'Sin conexión')).toBe('Sin conexión');
  });
});

describe('los canales', () => {
  it('son los cuatro del contrato', () => {
    expect(CANALES.map((c) => c.clave)).toEqual(['llamada', 'whatsapp', 'email', 'wasapi']);
  });

  it('todos tienen nombre e icono', () => {
    for (const { clave } of CANALES) {
      expect(nombreDeCanal(clave)).toBeTruthy();
      expect(iconoDeCanal(clave)).toBeTruthy();
    }
  });

  it('uno que no conocemos se enseña tal cual en vez de desaparecer', () => {
    // Si mañana el servidor añade «telegram», es mejor verlo escrito que ver
    // un hueco donde deberia haber un canal.
    expect(nombreDeCanal('telegram')).toBe('telegram');
    expect(iconoDeCanal('telegram')).toBeNull();
  });
});
