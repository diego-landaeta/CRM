/*
  EL ALCANCE COMERCIAL en la pantalla (QA del 09/11/2026, #704).

  `/auth/me` dice de quién son los datos que ve cada persona:
    · `alcance_comercial`: null = sin límite por persona (super admin, admin
      sin equipo); si no, la lista de personas (una gestora: ella; quien lleva
      un equipo comercial: ella y sus gestoras).
    · `lleva_equipo`: tiene gestoras a su cargo.

  El servidor ya recorta los datos; esto es para que la pantalla no ofrezca lo
  que no le va a servir: en los desplegables de gestora, solo las de su alcance,
  y los botones que el servidor le negaría (corregir o abonar facturas), fuera.
*/

type Persona = { id: number | string };
type ConAlcance = { alcance_comercial?: Array<number | string> | null; lleva_equipo?: boolean } | null | undefined;

/** La lista de personas que ve, o null si no tiene límite (o no se sabe aún). */
export function alcanceDe(user: ConAlcance): number[] | null {
  const lista = user?.alcance_comercial;
  return Array.isArray(lista) ? lista.map(Number) : null;
}

/** Solo las personas de su alcance; sin límite, la lista tal cual. */
export function soloDelAlcance<T extends Persona>(lista: T[] | null | undefined, user: ConAlcance): T[] {
  const alcance = alcanceDe(user);
  const todas = Array.isArray(lista) ? lista : [];
  return alcance ? todas.filter((p) => alcance.includes(Number(p.id))) : todas;
}

/** Si lleva un equipo comercial. */
export function llevaEquipo(user: ConAlcance): boolean {
  return user?.lleva_equipo === true;
}
