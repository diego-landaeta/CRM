import client from '@/shared/api/client';

/*
  La agenda del proceso comercial (#89 · #90).

  El recorte de quién ve qué lo hace el servidor: una gestora solo recibe lo
  suyo aunque escriba el id de otra. Aquí no se esconde nada.
*/

export type PasoEnCola = {
  lead_id: number;
  lead_nombre: string | null;
  lead_estado: string;
  responsable_id: number | null;
  gestora: string | null;
  clave: string;
  orden: number;
  paso_nombre: string | null;
  canales: string[] | null;
  paso_nota: string | null;
  fecha_prevista: string;
  dias_de_retraso: number;
  contactos: number;
  /** La formación por la que preguntó. Las plazas NO vienen: no las lleva el
      CRM, se miran en el sistema de admisiones. Solo viene la marca de que
      este paso las menciona y hay que ir a comprobarlas. */
  producto: string | null;
  producto_precio: string | number | null;
  /** Ver `falta_correo` / `falta_aviso` abajo: la misma regla en la cola. */
  falta_correo?: boolean;
  falta_aviso?: boolean;
  avisa_plazas: boolean;
  /** Este paso es donde se ofrece el 5 % de contado. */
  ofrece_descuento?: boolean;
  /** Si la formación lo lleva. `null` es «no consta», que no es «no». */
  lleva_descuento?: boolean | null;
  /** Este paso manda las opiniones de la formación (#91). */
  pide_opiniones?: boolean;
  /** Si la formación tiene opiniones. `null` es «no consta», que no es «no». */
  opiniones_publicadas?: boolean | null;
  /** El campus. Solo importa cuando se mira una empresa entera. */
  project_id: number;
  proyecto: string | null;
};

export type ResumenCola = {
  atrasados: number;
  hoy: number;
  manana: number;
  esta_semana: number;
};

export type PasoDeLead = {
  id: number;
  clave: string;
  orden: number;
  nombre: string | null;
  cuando: string | null;
  canales: string[] | null;
  nota_del_paso: string | null;
  fecha_prevista: string;
  estado: 'pendiente' | 'saltado';
  nota: string | null;
  hecho: boolean;
  vencido: boolean;
  dias_de_retraso: number;
  /** Su mensaje dice cuántas plazas quedan: hay que comprobarlo fuera. */
  avisa_plazas: boolean;
  /** Este paso es donde se ofrece el 5 % de contado. */
  ofrece_descuento?: boolean;
  /** Si la formación lo lleva. `null` es «no consta», que no es «no». */
  lleva_descuento?: boolean | null;
  /** Este paso manda las opiniones de la formación (#91). */
  pide_opiniones?: boolean;
  /** Si la formación tiene opiniones. `null` es «no consta», que no es «no». */
  opiniones_publicadas?: boolean | null;
  /** No tenemos su correo. Sin correo no hay guía ni homologaciones. */
  sin_correo?: boolean;
  /**
   * Por qué el paso sigue abierto cuando se pide por los dos canales (#91).
   *
   * «Nunca damos por hecho que lo ha visto»: un correo sin su aviso por
   * WhatsApp no cierra el paso.
   */
  falta_correo?: boolean;
  falta_aviso?: boolean;
};

function conAmbito(params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    // `-1` es «todos los proyectos», un valor interno del CRM: mandarlo pediría
    // el proyecto número menos uno.
    if (v === undefined || v === null || v === '' || v === -1) continue;
    q.set(k, String(v));
  }
  return q.toString();
}

export async function traerCola(opciones: {
  projectId?: number | null; projectIds?: string | null; gestoraId?: number | null; hasta?: string | null; limite?: number;
}): Promise<PasoEnCola[]> {
  const r = await client.get(`/proceso/cola?${conAmbito(opciones)}`);
  return r?.success ? r.data : [];
}

export async function traerResumen(opciones: {
  projectId?: number | null; projectIds?: string | null; gestoraId?: number | null;
}): Promise<ResumenCola | null> {
  const r = await client.get(`/proceso/cola/resumen?${conAmbito(opciones)}`);
  return r?.success ? r.data : null;
}

export async function traerPasosDeLead(leadId: number): Promise<PasoDeLead[]> {
  const r = await client.get(`/proceso/lead/${leadId}`);
  return r?.success ? r.data : [];
}

export async function ajustarPaso(id: number, datos: {
  estado?: 'pendiente' | 'saltado'; fecha_prevista?: string; nota?: string;
}) {
  const r = await client.patch(`/proceso/paso-lead/${id}`, datos);
  return r?.success ? r.data : null;
}

export async function replanificar(leadId: number) {
  const r = await client.post(`/proceso/lead/${leadId}/replanificar`, {});
  return r?.success ? r.data : null;
}

/**
 * Las plantillas de un paso, ya rellenas (#88).
 *
 * Vienen hechas del servidor: aquí no se rellena nada. En el chat sí se
 * rellena en el navegador, porque allí el texto se sigue editando antes de
 * mandarlo; aquí solo se copia.
 */
export type PlantillaDePaso = {
  id: number;
  label: string;
  texto: string;
  /** Solo las de WhatsApp: el mensaje va con una captura o un dossier. */
  pide_adjunto?: boolean;
  pista?: string | null;
  /** Solo las de correo. */
  asunto?: string;
};

export type PlantillasDelPaso = {
  whatsapp: PlantillaDePaso[];
  email: PlantillaDePaso[];
};

export async function traerPlantillasDelPaso(
  leadId: number, clave: string,
): Promise<PlantillasDelPaso> {
  const r = await client.get(`/proceso/lead/${leadId}/plantillas/${clave}`);
  return r?.success ? r.data : { whatsapp: [], email: [] };
}
