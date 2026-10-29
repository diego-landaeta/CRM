import client from '@/shared/api/client';
import { ponerAmbito } from '@/shared/lib/ambitoInforme';

/**
 * La tasa de cierre (#39) — la definición verificada, y la única.
 *
 * «De los prospectos que entraron en el periodo, los que han comprado: venta
 * con algún cobro, posterior a su entrada y sin contar mensualidades.»
 *
 * NO es lo mismo que el `tasa_conversion` que devuelve `/informes/overview`.
 * Aquél cuenta los leads con `status = 'convertido'`, que es un campo que
 * alguien pone a mano: un lead puede estar marcado y no haber pagado nunca, y
 * puede haber pagado sin que nadie le cambiara el estado. Por eso los dos
 * números discrepan, y por eso el ticket pide no escribir un tercero.
 */

export interface MesDeCierre {
  mes: string;
  leads: number;
  cerrados: number;
  tasa: number;
  /** Un mes sin madurar SIEMPRE sale bajo: no se puntúa. */
  madura: boolean;
}

export interface TasaDeCierre {
  leads: number;
  cerrados: number;
  tasa: number;
  meses: MesDeCierre[];
  definicion: string;
}

export interface PersonaDelDesglose {
  id: number;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  entrada: string;
  gestora: string | null;
  fecha_venta: string | null;
}

export interface AmbitoDeLaTasa {
  activeProject?: { id?: number } | null;
  activeIssuerId?: number | null;
  from?: string;
  to?: string;
  asesoraId?: number | null;
}

/**
 * El ámbito va por `ponerAmbito`, el mismo helper que usa el resto de Reportes.
 *
 * No se arma a mano: con una sociedad elegida hay que mandar `issuerId` y NO
 * `projectId`, y quien lo escriba por su cuenta acaba pidiendo un campus suelto
 * con el título de la sociedad puesto. Ya pasó una vez con el «Resumen del
 * periodo».
 */
function conAmbitoYRango(params: AmbitoDeLaTasa) {
  const p = new URLSearchParams();
  if (params.from) p.set('from', params.from);
  if (params.to) p.set('to', params.to);
  ponerAmbito(p, { activeIssuerId: params.activeIssuerId ?? null, activeProject: params.activeProject ?? null });
  if (params.asesoraId) p.set('asesoraId', String(params.asesoraId));
  return p;
}

export async function traerTasaDeCierre(params: AmbitoDeLaTasa): Promise<TasaDeCierre | null> {
  const r = await client.get(`/informes/tasa-cierre?${conAmbitoYRango(params)}`);
  return r?.success ? r.data : null;
}

/**
 * Las personas detrás de cada sumando, para el «¿de dónde sale este número?».
 *
 * `lado` dice cuál: `cerrados` son los que compraron, `todos` el total de
 * entrados. Poder pulsar los dos sumandos es lo que hace comprobable el
 * porcentaje — si solo se puede mirar el de arriba, hay que creérselo igual.
 */
export async function traerDesglose(
  params: AmbitoDeLaTasa & { lado: 'cerrados' | 'todos' },
): Promise<PersonaDelDesglose[]> {
  const p = conAmbitoYRango(params);
  p.set('lado', params.lado);
  const r = await client.get(`/informes/tasa-cierre/detalle?${p}`);
  return r?.success ? (r.data || []) : [];
}
