import { describe, it, expect } from 'vitest';
import { ROLES_CON_WHATSAPP, porQueNoPuede, puedeTenerWhatsapp } from '../src/modules/whatsapp/roles.js';

// Quien puede tener WhatsApp del CRM.
//
// Esto vivia dentro de una consulta SQL, escrito dos veces —una por cada rama
// del selector— como `role IN ('superadmin','admin','gestor','soporte')`. Y
// quien no estaba en esa lista NO APARECIA: hoy los tutores, 26 activos en
// ISEIE. Ni salian, ni se decia por que, y no salir es la peor forma de negar
// algo porque parece un fallo. Es la tarea #68.
//
// Se prueba la REGLA y no la consulta: el valor de sacarla a un modulo es que
// haya un solo sitio donde mirar y cambiar.

describe('quien puede tener WhatsApp', () => {
  const gestora = { role: 'gestor', active: true, gestor_colaboraciones: false };

  it('las gestoras y quien manda, si', () => {
    for (const role of ['superadmin', 'admin', 'gestor', 'soporte']) {
      expect(puedeTenerWhatsapp({ ...gestora, role }), role).toBe(true);
    }
  });

  it('un tutor no, y se dice POR QUE', () => {
    // El motivo no es adorno: es lo unico que evita que alguien pierda la tarde
    // preguntandose por que no sale en la lista.
    const motivo = porQueNoPuede({ ...gestora, role: 'tutor' });
    expect(motivo).toBeTruthy();
    expect(motivo).toMatch(/tutores/i);
  });

  it('un rol que no existe todavia tampoco, y lo dice con su nombre', () => {
    // Manana puede aparecer uno. Que no entre por defecto es lo correcto; que
    // no se sepa por que, no.
    const motivo = porQueNoPuede({ ...gestora, role: 'contable' });
    expect(motivo).toMatch(/contable/);
  });

  it('quien esta de baja, no', () => {
    expect(porQueNoPuede({ ...gestora, active: false })).toMatch(/baja/i);
  });

  it('quien lleva colaboraciones, no', () => {
    // Tiene rol de gestor pero no atiende prospectos: no se le reparte trabajo
    // y tampoco le toca una sesion.
    expect(porQueNoPuede({ ...gestora, gestor_colaboraciones: true })).toMatch(/colaboraciones/i);
  });

  it('sin usuario, no revienta', () => {
    expect(porQueNoPuede(null)).toBeTruthy();
    expect(porQueNoPuede(undefined)).toBeTruthy();
  });

  it('la lista de roles esta en UN sitio y es la que se usa', () => {
    // Si alguien vuelve a escribirla en una consulta, esto no lo detecta — pero
    // al menos deja escrito cual es la buena.
    expect(ROLES_CON_WHATSAPP).toContain('gestor');
    expect(ROLES_CON_WHATSAPP).not.toContain('tutor');
  });
});
