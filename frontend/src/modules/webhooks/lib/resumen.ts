/*
  CONEXIÓN › WEBHOOKS: TODOS JUNTOS, SEÑALADOS POR SU FUNCIÓN (#690).

  Diego, 05/11: «hay demasiados webhooks y están repartidos por el menú». Aquí
  se reúnen, agrupados por lo que hacen. SOLO FRONTAL: cada tipo se lee con el
  mismo GET que ya usa su pantalla, y nada cambia en cómo funcionan.

  Lo que el servidor NO registra por campus no se inventa. Stripe, WooCommerce,
  el WhatsApp y la clave del campus no guardan cuándo llegó el último aviso ni
  si falló: la tarjeta lo dice, no pone una fecha que no es (la de la última
  importación de WooCommerce, por ejemplo, es otra cosa). El botón de la web
  apunta cada pulsación, pero eso se mira en su pantalla, no aquí.

  Las «consultas de alumnos» de Moodle no están: no son un webhook, el CRM las
  LEE del Moodle de cada campus (Conexión › Moodle). Las de CERTIFEX sí, porque
  Certifex avisa al CRM (consultas, solicitudes de diploma y completados).

  EL ÁMBITO. Los que se piden de un campus por llamada (prospectos, Make,
  formularios, admisión, Stripe, el widget) se piden campus a campus, unos pocos
  a la vez. Los que traen varios campus de golpe (WooCommerce, transferencias,
  asignación de leads) se recortan a los campus de arriba, igual que los otros:
  sin los de pruebas con «Todos».
*/
import client from '@/shared/api/client';
import { CERTIFEX_PANEL } from '@/shared/lib/certifexPanel';
import { formatDateNumeric, formatDateTime } from '@/shared/lib/format';

/** `ambos`: recibe un aviso y avisa a otro (la asignación de leads). */
export type Direccion = 'entra' | 'sale' | 'ambos';
export type GrupoId = 'captacion' | 'admision' | 'pagos' | 'mensajeria' | 'salida';

export const GRUPOS: ReadonlyArray<{ id: GrupoId; titulo: string; detalle: string }> = [
  { id: 'captacion', titulo: 'Captación de prospectos', detalle: 'Lo que mete prospectos en el CRM' },
  { id: 'admision', titulo: 'Admisión y matrículas', detalle: 'Solicitudes de admisión con sus documentos' },
  { id: 'pagos', titulo: 'Pagos y ventas', detalle: 'Cobros y pedidos que avisan al CRM' },
  { id: 'mensajeria', titulo: 'Mensajería', detalle: 'Mensajes que entran por WhatsApp y la web' },
  { id: 'salida', titulo: 'Avisos que salen del CRM', detalle: 'El CRM avisa a otro sistema' },
];

export interface Campus {
  id: number;
  nombre: string;
  /** Los módulos del campus (`false`: apagado), como los mira el menú. */
  modules?: Record<string, boolean> | null;
  /** Su empresa (`sociedad_emisora_id`): para lo que se configura por empresa. */
  empresaId?: number | null;
}

/**
 * ¿Una configuración con ámbito (campus, empresa o todas) es de los campus que
 * se miran? Es la regla del servidor (`webhooks-salientes.model`, `asignacion`),
 * aplicada a los campus de arriba: así no salen los de pruebas con «Todos» y
 * una empresa enseña solo lo suyo.
 */
export function delAmbitoDeArriba(
  fila: { ambito?: string | null; project_id?: number | null; issuer_id?: number | null },
  campus: Campus[],
): boolean {
  if (fila.ambito === 'todas') return true;
  if (fila.ambito === 'campus') return campus.some((c) => c.id === fila.project_id);
  if (fila.ambito === 'empresa') return campus.some((c) => c.empresaId != null && c.empresaId === fila.issuer_id);
  return false;
}

/** Una fila de una tarjeta: un webhook concreto, o un campus con el suyo. */
export interface FilaWebhook {
  clave: string;
  nombre: string;
  campus?: string | null;
  /** null: no tiene interruptor (el de WhatsApp es uno para todo el CRM). */
  activo: boolean | null;
  /** Último aviso recibido o enviado. `undefined`: el servidor no lo registra. */
  ultimo?: string | null;
  /** Lo que falló, en una frase. `undefined`: el servidor no lo registra. */
  fallo?: string | null;
  /** Lo que no se pudo leer de esta fila (su historial, por ejemplo). */
  sinLeer?: string;
  /**
   * Algo que mirar que NO es que el último aviso fallara (envíos fallidos en
   * 30 días cuando el último fue bien). No cuenta en «N con fallos».
   */
  aviso?: string;
  /** Una aclaración neutra de esta fila (por qué no hay último aviso, por ejemplo). */
  detalle?: string;
  /** Su pantalla de configuración. */
  enlace: string;
  /**
   * El campus que hay que tener elegido para abrir `enlace`: su ficha es de un
   * campus y, con «Todos» o una empresa, el muro no deja entrar. Al pulsarla se
   * elige ese campus arriba.
   */
  campusId?: number;
}

/** Un GET que devuelve el `data` de la respuesta. */
export type Pedir = <T>(url: string) => Promise<T>;

export interface Contexto {
  /** Los campus del ámbito de arriba (uno, los de la empresa, o todos sin pruebas). */
  campus: Campus[];
  /** `projectId`, `issuerId` o nada, como manda `ponerAmbito`. */
  ambito: URLSearchParams;
  /** Cómo se pide. El resumen pasa uno con tope y que se cancela (`crearPedidor`). */
  pedir?: Pedir;
}

export interface TipoWebhook {
  id: string;
  grupo: GrupoId;
  titulo: string;
  queHace: string;
  direccion: Direccion;
  /** La pantalla donde se configura hoy. */
  enlace: string;
  /** Lo que pide el servidor para leerlo (basta con uno). */
  permisos: string[];
  /** Además de alguno de `permisos`, todos estos (el GET pide otro distinto). */
  requiere?: string[];
  /** Se apaga con el módulo del entorno (WhatsApp, `VITE_MODULOS_APAGADOS`). */
  modulo?: string;
  /**
   * El módulo de cada campus que lo enciende (`project.modules`, como el menú):
   * un campus con él apagado no se pide ni sale.
   */
  moduloCampus?: string;
  /** Además del permiso, uno de estos roles: lo que pide hoy su pantalla. */
  roles?: string[];
  /**
   * Su pantalla es de un campus: con «Todos» o una empresa, el muro no deja
   * entrar. La tarjeta dice entonces que se elija uno (las filas lo eligen solas).
   */
  deUnCampus?: boolean;
  /** Sin filas, la tarjeta no sale (lo que ya no se crea y casi nadie tiene). */
  ocultarSiVacio?: boolean;
  /** Si existe en este entorno (Certifex: `VITE_CERTIFEX_PANEL`). Sin ella, siempre. */
  enEsteEntorno?: () => boolean;
  /** Lo que el servidor no guarda de este tipo, dicho en la tarjeta. */
  nota?: string;
  cargar: (ctx: Contexto) => Promise<FilaWebhook[]>;
}

type Respuesta<T> = { success?: boolean; data?: T };
const datos: Pedir = async <T>(url: string): Promise<T> => {
  const r = (await client.get(url)) as Respuesta<T>;
  return (r?.data ?? ([] as unknown)) as T;
};

/**
 * Un `pedir` con tope: como mucho `limite` peticiones a la vez entre TODAS las
 * tarjetas, y con `signal` cancelado (cambio de ámbito, salir de la pantalla)
 * no sale ninguna más y las que esperan se rechazan. Sin esto, con veinte
 * campus el resumen lanzaba cientos de GET de golpe en cada cambio de arriba.
 */
export function crearPedidor(limite = 6, signal?: AbortSignal): Pedir {
  let enCurso = 0;
  const cola: Array<() => void> = [];
  const soltar = () => { enCurso -= 1; cola.shift()?.(); };
  const pedir = async <T>(url: string): Promise<T> => {
    if (enCurso >= limite) await new Promise<void>((r) => cola.push(r));
    enCurso += 1;
    try {
      if (signal?.aborted) throw Object.assign(new Error('cancelado'), { name: 'AbortError' });
      const r = (await client.get(url, signal ? { signal } : undefined)) as Respuesta<T>;
      return (r?.data ?? ([] as unknown)) as T;
    } finally {
      soltar();
    }
  };
  // La misma dirección, una sola vez por carga: dos tarjetas que leen lo mismo
  // (admisión y los tokens antiguos: `/webhook-tokens?projectId=N`) comparten
  // la petición. Se olvida al cancelar o al cambiar de ámbito (pedidor nuevo).
  const yaPedidas = new Map<string, Promise<unknown>>();
  return <T>(url: string): Promise<T> => {
    if (!yaPedidas.has(url)) yaPedidas.set(url, pedir<T>(url));
    return yaPedidas.get(url) as Promise<T>;
  };
}

/** Por qué no se pudo leer un campus, dicho como es: un 403 no es «no contestó». */
export function motivoDeNoLeer(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 403) return 'No tienes permiso para ver este campus';
  if (status === 404) return 'No existe o ya no está';
  return 'El servidor no contestó para este campus';
}

/**
 * `fn` para cada campus, `limite` a la vez. Un campus que falla no tumba la
 * tarjeta: sale como fila «no se pudo leer», que es lo que hay que saber.
 */
export async function porCampus(
  campus: Campus[],
  fn: (c: Campus) => Promise<FilaWebhook[]>,
  limite = 4,
): Promise<FilaWebhook[]> {
  const salida: FilaWebhook[][] = new Array(campus.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < campus.length) {
      const i = siguiente++;
      const c = campus[i];
      try {
        salida[i] = await fn(c);
      } catch (err) {
        // `sinLeer`, no `fallo`: no se sabe si el webhook falla, solo que no se pudo leer.
        salida[i] = [{ clave: `error-${c.id}`, nombre: 'No se pudo leer', campus: c.nombre, activo: null, sinLeer: motivoDeNoLeer(err), enlace: '' }];
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, campus.length) }, trabajador));
  return salida.flat();
}

/**
 * El último aviso de un webhook de prospectos (su historial, 1 fila). Si no se
 * puede leer, no se dice «sin avisos todavía», que sería mentira: se dice que
 * no se pudo leer.
 */
async function ultimoEvento(pedir: Pedir, formId: number): Promise<Pick<FilaWebhook, 'ultimo' | 'fallo' | 'sinLeer'>> {
  try {
    const [e] = await pedir<Array<{ status: string; error_message?: string | null; created_at: string }>>(`/forms/${formId}/events?limit=1`);
    if (!e) return { ultimo: null, fallo: null };
    return { ultimo: e.created_at, fallo: e.status === 'error' ? (e.error_message || 'El último aviso falló') : null };
  } catch {
    return { sinLeer: 'No se pudo leer su último aviso' };
  }
}

/**
 * Un webhook con destino Matrícula: el servidor apunta en su historial los
 * ERRORES (y la muestra del modo escucha), pero no los que salen bien
 * (`form.controller`, `processInboundPayload`). Así que su último evento no es
 * su último aviso: «sin avisos todavía» sería falso, y un error del historial
 * puede ser anterior a otros que fueron bien. Ese error se enseña como aviso,
 * con su fecha, sin contar en «con fallos».
 */
async function ultimoDeMatricula(pedir: Pedir, formId: number): Promise<Pick<FilaWebhook, 'detalle' | 'aviso' | 'sinLeer'>> {
  const detalle = 'Va a Matrículas: los avisos que salen bien no se apuntan aquí, se ven en Matrículas';
  try {
    const [e] = await pedir<Array<{ status: string; error_message?: string | null; created_at: string }>>(`/forms/${formId}/events?limit=1`);
    if (e?.status === 'error') {
      return { detalle, aviso: `Último error registrado el ${formatDateTime(e.created_at)}: ${e.error_message || 'sin detalle'}` };
    }
    return { detalle };
  } catch {
    return { detalle, sinLeer: 'No se pudo leer su historial de errores' };
  }
}

type FormFila = { id: number; nombre: string; active: boolean; submissions_count?: number; destination?: string | null };

/**
 * Los formularios o los webhooks de prospectos de cada campus. El último aviso
 * se pide solo de los webhooks (`conAvisos`): son pocos y es lo que se vigila.
 * Los formularios de la web son muchos y sus envíos se ven en su pantalla;
 * pedir el historial de cada uno era una petición por formulario y campus.
 */
const formulariosDe = (kind: 'webhook' | 'form', enlace: (f: FormFila) => string, conAvisos: boolean) => (ctx: Contexto) => {
  const pedir = ctx.pedir || datos;
  return porCampus(ctx.campus, async (c) => {
    const filas = await pedir<FormFila[]>(`/forms?projectId=${c.id}&kind=${kind}`);
    return Promise.all(filas.map(async (f) => ({
      clave: `${kind}-${f.id}`,
      nombre: f.nombre,
      campus: c.nombre,
      activo: !!f.active,
      ...(conAvisos && f.destination === 'matricula'
        ? await ultimoDeMatricula(pedir, f.id)
        : conAvisos ? await ultimoEvento(pedir, f.id) : {}),
      enlace: enlace(f),
      campusId: c.id,
    })));
  });
};

/**
 * Si el último aviso de un escenario de Make falló. Su última entrega
 * (`/make-webhooks/:id/deliveries?limit=1`, `make.view`) dice `rejected` aunque
 * `last_error` esté vacío. Uno apagado o sin avisos no se pide: no hay entrega
 * nueva que mirar.
 */
async function falloDeMake(
  pedir: Pedir,
  m: { id: number; active: boolean; last_received_at: string | null; last_error: string | null },
): Promise<Pick<FilaWebhook, 'fallo' | 'sinLeer'>> {
  if (!m.active || !m.last_received_at) return { fallo: m.last_error };
  try {
    const [d] = await pedir<Array<{ result: string; error_message?: string | null }>>(`/make-webhooks/${m.id}/deliveries?limit=1`);
    if (d?.result === 'rejected') return { fallo: d.error_message || 'El último aviso se rechazó' };
    // La última fue bien (o era de prueba, que no limpia `last_error`): el
    // error que quede es de antes y no dice cómo está ahora.
    if (d?.result === 'accepted' || d?.result === 'test_only') return { fallo: null };
    return { fallo: m.last_error };
  } catch {
    return { fallo: m.last_error, sinLeer: 'No se pudo leer su última entrega' };
  }
}

export const TIPOS: TipoWebhook[] = [
  {
    id: 'prospectos',
    grupo: 'captacion',
    titulo: 'Webhooks de prospectos',
    queHace: 'Reciben prospectos de Make, Zapier, n8n o cualquier sistema y los crean en el CRM.',
    direccion: 'entra',
    enlace: '/conexion/webhooks/prospectos',
    permisos: ['webhooks.view'],
    requiere: ['forms.view'],
    moduloCampus: 'webhooks',
    deUnCampus: true,
    cargar: formulariosDe('webhook', (f) => `/conexion/webhooks/prospectos/${f.id}`, true),
  },
  {
    id: 'make',
    grupo: 'captacion',
    titulo: 'Escenarios de Make',
    queHace: 'Cada escenario de Make envía aquí sus prospectos, con su propio mapeo de campos.',
    direccion: 'entra',
    enlace: '/conexion/webhooks/make',
    permisos: ['make.view'],
    moduloCampus: 'make',
    deUnCampus: true,
    // `last_error` NO basta: el rechazo por falta de mapeo (sin correo ni nombre,
    // #627) se apunta como entrega `rejected` sin tocar `last_error`, y la
    // tarjeta diría «Activo · Último aviso: hoy» sin avisar. Se mira además la
    // última entrega de cada escenario encendido.
    cargar: (ctx) => {
      const pedir = ctx.pedir || datos;
      return porCampus(ctx.campus, async (c) => {
        const filas = await pedir<Array<{ id: number; label: string | null; slug: string; active: boolean; mode: string; last_received_at: string | null; last_error: string | null }>>(`/make-webhooks?projectId=${c.id}`);
        return Promise.all(filas.map(async (m) => ({
          clave: `make-${m.id}`,
          nombre: `${m.label || m.slug}${m.mode === 'test' ? ' (en prueba)' : ''}`,
          campus: c.nombre,
          activo: !!m.active,
          ultimo: m.last_received_at,
          ...(await falloDeMake(pedir, m)),
          enlace: `/conexion/webhooks/make/${m.id}`,
          campusId: c.id,
        })));
      });
    },
  },
  {
    id: 'formularios',
    grupo: 'captacion',
    titulo: 'Formularios de la web',
    queHace: 'Los formularios incrustados en la web (y su versión por correo) crean el prospecto al enviarse.',
    direccion: 'entra',
    enlace: '/captacion',
    permisos: ['forms.view'],
    moduloCampus: 'forms',
    deUnCampus: true,
    nota: 'Sus envíos se ven en su pantalla.',
    cargar: formulariosDe('form', () => '/captacion', false),
  },
  {
    id: 'clave-campus',
    grupo: 'captacion',
    titulo: 'Entrada del campus (con su clave)',
    queHace: 'Una dirección por campus que crea prospectos con la clave del proyecto.',
    direccion: 'entra',
    enlace: '/configuracion?pestana=projects',
    // La clave se pone y se regenera con `projects.edit` (POST
    // /projects/:id/regenerate-webhook-key): sin él, la tarjeta llevaría a una
    // pantalla donde no se puede tocar. Y así `/projects`, que trae las claves,
    // no se pide para quien no las gestiona.
    permisos: ['projects.edit'],
    requiere: ['projects.view'],
    nota: 'No guarda cuándo llegó el último ni si falló. La clave se pone y se cambia en Configuración › Proyectos, en la pestaña Webhook de cada campus.',
    cargar: async (ctx) => {
      const ids = new Set(ctx.campus.map((c) => c.id));
      const filas = await (ctx.pedir || datos)<Array<{ id: number; nombre: string; webhook_api_key?: string | null }>>('/projects');
      // La clave NO se enseña: solo si la tiene puesta.
      return filas.filter((p) => ids.has(p.id)).map((p) => ({
        clave: `campus-${p.id}`,
        nombre: p.webhook_api_key ? 'Con clave' : 'Sin clave',
        campus: p.nombre,
        activo: !!p.webhook_api_key,
        enlace: '/configuracion?pestana=projects',
      }));
    },
  },
  {
    id: 'tokens',
    grupo: 'captacion',
    titulo: 'Tokens de entrada antiguos',
    queHace: 'Direcciones con token (de tipo «prospectos» o «a medida») que siguen recibiendo avisos aunque ya no se crean desde ninguna pantalla.',
    direccion: 'entra',
    enlace: '',
    // `GET /webhook-tokens` (sin `kind`: todos los del campus), el mismo que
    // lee la pestaña de admisión. Los de admisión van en su tarjeta.
    permisos: ['webhooks.view'],
    ocultarSiVacio: true,
    nota: 'No tienen pantalla de configuración: si alguno no debería estar activo, hay que darlo de baja desde el servidor.',
    cargar: (ctx) => porCampus(ctx.campus, async (c) => {
      const filas = await (ctx.pedir || datos)<Array<{ id: number; kind: string; notas?: string | null; active: boolean; last_used_at: string | null }>>(`/webhook-tokens?projectId=${c.id}`);
      return filas.filter((t) => t.kind !== 'matriculas').map((t) => ({
        clave: `token-${t.id}`,
        nombre: `${t.notas || `Token n.º ${t.id}`} (${t.kind === 'leads' ? 'prospectos' : 'a medida'})`,
        campus: c.nombre,
        activo: !!t.active,
        ultimo: t.last_used_at,
        enlace: '',
      }));
    }),
  },
  {
    id: 'admision',
    grupo: 'admision',
    titulo: 'Webhook de admisión',
    queHace: 'Recibe las solicitudes de admisión y matrícula de la web, con sus documentos.',
    direccion: 'entra',
    enlace: '/clientes/matriculas?pestana=webhooks',
    // Los de su pestaña en Matrículas, que es adonde lleva: solo administración
    // y con `diplomas.view_emisiones` (MatriculasPage, #198). Sin eso, la
    // tarjeta llevaría a una pestaña que no se le enseña.
    // Y `matriculas.view`, que es lo que pide la propia pantalla de Matrículas.
    permisos: ['webhooks.view'],
    requiere: ['diplomas.view_emisiones', 'matriculas.view'],
    roles: ['superadmin', 'admin'],
    deUnCampus: true,
    nota: 'Guarda cuándo se usó por última vez, pero no si falló.',
    cargar: (ctx) => porCampus(ctx.campus, async (c) => {
      // Sin `kind`: la misma petición que la de los tokens antiguos, que el
      // pedidor hace una sola vez por campus. Aquí, solo los de admisión.
      const filas = await (ctx.pedir || datos)<Array<{ id: number; kind?: string; notas?: string | null; active: boolean; last_used_at: string | null; created_at?: string | null }>>(`/webhook-tokens?projectId=${c.id}`);
      return filas.filter((t) => t.kind === 'matriculas').map((t) => ({
        clave: `admision-${t.id}`,
        // Sin nota, cinco webhooks del mismo campus salían iguales («Webhook de
        // admisión · Campus»): se distinguen por su número y cuándo se crearon.
        nombre: t.notas || `Webhook de admisión n.º ${t.id}${t.created_at ? ` · creado el ${formatDateNumeric(t.created_at)}` : ''}`,
        campus: c.nombre,
        activo: !!t.active,
        ultimo: t.last_used_at,
        enlace: '/clientes/matriculas?pestana=webhooks',
        campusId: c.id,
      }));
    }),
  },
  {
    id: 'stripe',
    grupo: 'pagos',
    titulo: 'Pagos de Stripe',
    queHace: 'Stripe avisa de cada cobro, suscripción y devolución.',
    direccion: 'entra',
    enlace: '/finanzas/integraciones',
    permisos: ['integrations.view'],
    nota: 'No guarda por campus cuándo llegó el último aviso ni si falló (el último de todo el CRM está en Sistema › Status).',
    // La de cada campus (`/integrations/stripe?projectId`, la que lee su
    // pantalla): si está encendida y si tiene la FIRMA del webhook
    // (`config_public.webhook_secret_preview`). Sin la firma, Stripe avisa y el
    // CRM rechaza el aviso; con la clave de la API a secas no basta.
    // La firma vale cifrada (`webhook_secret_preview`, la de ahora) o en claro
    // en `config_public.webhook_secret` (la de antes): las dos las acepta
    // `getWebhookSecret` (stripe-payments.service). El interruptor no sale como
    // «Activo/Apagado» (con la firma, el aviso se procesa igual esté encendida o
    // no); solo se nombra cuando, sin la firma, explica por qué no llega nada.
    cargar: (ctx) => porCampus(ctx.campus, async (c) => {
      const i = await (ctx.pedir || datos)<{ active?: boolean; has_secret?: boolean; config_public?: { webhook_secret_preview?: string | null; webhook_secret?: string | null } } | null>(`/integrations/stripe?projectId=${c.id}`);
      if (!i || Array.isArray(i)) return [];
      const conFirma = Boolean(i.config_public?.webhook_secret_preview || i.config_public?.webhook_secret);
      // La consulta cada 5 minutos solo corre con la integración ENCENDIDA y la
      // clave de la API puesta (`listProjectsWithStripe`). Y las devoluciones
      // solo llegan por el aviso (`propagarReembolso`): sin la firma no se
      // apuntan en la venta ni deshacen la comisión.
      const consulta = Boolean(i.active && i.has_secret);
      return [{
        clave: `stripe-${c.id}`,
        nombre: conFirma ? 'Con la firma del webhook' : 'Sin la firma del webhook',
        campus: c.nombre,
        activo: null,
        // Tres casos sin la firma:
        //  · encendida y con clave: la consulta trae los cobros, no las devoluciones → aviso;
        //  · APAGADA: puede ser a propósito (el campus no usa Stripe) → aviso, no fallo;
        //  · encendida SIN clave: alguien quiso conectarla y no entra nada → fallo.
        aviso: conFirma ? undefined
          : consulta ? 'Sin la firma los avisos se rechazan: los cobros llegan por la consulta cada 5 minutos, pero las devoluciones no se apuntan en la venta ni deshacen la comisión'
            : !i.active ? 'Integración apagada: no llega nada de Stripe a este campus'
              : undefined,
        fallo: conFirma || consulta || !i.active ? null
          : 'Encendida pero sin la firma ni la clave de la API: no llega nada de Stripe',
        enlace: '/finanzas/integraciones',
        campusId: c.id,
      }];
    }),
  },
  {
    id: 'woocommerce',
    grupo: 'pagos',
    titulo: 'Pedidos de WooCommerce',
    queHace: 'La tienda avisa de cada pedido nuevo o cambiado.',
    direccion: 'entra',
    enlace: '/productos/woocommerce',
    permisos: ['woocommerce.view'],
    moduloCampus: 'woocommerce',
    // Lo que se lee es la CONEXIÓN de la tienda (`wc_credentials`, la de la
    // importación). El aviso de pedidos lleva su propia firma
    // (`POST /woocommerce/webhook-secret`), que no tiene pantalla en el CRM ni
    // sale en este estado: una tienda conectada puede tener los avisos rechazados.
    nota: 'Se ve la conexión de la tienda, no el aviso de pedidos: su firma no se configura en el CRM. No guarda cuándo llegó el último pedido por aviso ni si falló.',
    cargar: async (ctx) => {
      const filas = await (ctx.pedir || datos)<Array<{ id: number; nombre: string; conectado: boolean; activo: boolean }>>(`/woocommerce/estado?${ctx.ambito.toString()}`);
      // Se pide del ámbito, pero solo salen los campus que se están mirando (los
      // de WooCommerce apagado ya los quitó `campusDelTipo`).
      const ids = new Set(ctx.campus.map((c) => c.id));
      return filas.filter((c) => c.conectado && ids.has(c.id)).map((c) => ({
        clave: `wc-${c.id}`,
        nombre: 'Conexión de la tienda',
        campus: c.nombre,
        activo: !!c.activo,
        enlace: '/productos/woocommerce',
        campusId: c.id,
      }));
    },
  },
  {
    id: 'whatsapp',
    grupo: 'mensajeria',
    titulo: 'WhatsApp',
    queHace: 'Los mensajes de WhatsApp entran por un único aviso para todo el CRM; cada persona enlaza su número.',
    direccion: 'entra',
    enlace: '/whatsapp/conexion',
    // El de su pantalla, `/whatsapp/conexion`: supervisar sin usar no la abre.
    permisos: ['whatsapp.usar'],
    modulo: 'whatsapp',
    nota: 'Es uno para todo el CRM: no va por campus.',
    cargar: async () => [{ clave: 'whatsapp', nombre: 'Aviso de WhatsApp', campus: null, activo: null, enlace: '/whatsapp/conexion' }],
  },
  {
    id: 'widget',
    grupo: 'mensajeria',
    titulo: 'Botón de WhatsApp de la web',
    queHace: 'El botón de la web abre WhatsApp con la gestora que toca y apunta cada pulsación.',
    direccion: 'entra',
    enlace: '/captacion/whatsapp',
    permisos: ['widget.view'],
    nota: 'Las pulsaciones se ven en su pantalla.',
    cargar: (ctx) => porCampus(ctx.campus, async (c) => {
      const d = await (ctx.pedir || datos)<{ config?: { enabled?: boolean } }>(`/widget/config?projectId=${c.id}`);
      return [{ clave: `widget-${c.id}`, nombre: 'Botón de la web', campus: c.nombre, activo: !!d?.config?.enabled, enlace: '/captacion/whatsapp', campusId: c.id }];
    }),
  },
  {
    id: 'transferencias',
    grupo: 'salida',
    titulo: 'Transferencias y depósitos',
    queHace: 'Cuando se registra un cobro por transferencia o depósito, el CRM avisa a la dirección que se ponga (Make).',
    direccion: 'sale',
    enlace: '/conexion/webhooks/transferencias',
    permisos: ['webhooks_salientes.view'],
    cargar: async (ctx) => {
      const filas = await (ctx.pedir || datos)<ConAmbito[]>(`/webhooks-salientes?${ctx.ambito.toString()}`);
      // El servidor recorta por el ámbito, y con un campus enseña también los de
      // los otros campus de su empresa (Diego, 21/10): eso se respeta. Solo con
      // «Todos» se recorta aquí, porque un admin recibe también lo de sus campus
      // de pruebas, que el resto de tarjetas no enseña.
      const enTodos = !ctx.ambito.get('projectId') && !ctx.ambito.get('issuerId');
      const pedir = ctx.pedir || datos;
      return Promise.all(filas.filter((w) => !enTodos || delAmbitoDeArriba(w, ctx.campus)).map(async (w) => ({
        clave: `saliente-${w.id}`,
        nombre: w.nombre,
        campus: dondeVa(w),
        activo: !!w.activo,
        // Con el ámbito de arriba: con una empresa, el último envío de un
        // webhook «de todas las empresas» es el de un cobro de esa empresa.
        ...(await comoFueElUltimo(pedir, `/webhooks-salientes/envios?webhookId=${w.id}`, conAmbito(ctx.ambito, 'projectId', 'issuerId'),
          { ultimo: w.ultimo_envio_at ?? null, fallidos30: w.fallidos_30_dias }, (e) => e.enviado_at)),
        enlace: '/conexion/webhooks/transferencias',
      })));
    },
  },
  {
    id: 'asignacion',
    grupo: 'salida',
    titulo: 'Asignación de leads',
    queHace: 'Make manda cada formulario al CRM; el CRM decide qué gestora lo atiende por su actividad y se lo avisa al escenario de Make.',
    direccion: 'ambos',
    enlace: '/conexion/asignacion-leads',
    // `GET /asignacion` (CRM#513), el que lee su pantalla: la misma gente que
    // el de transferencias.
    permisos: ['webhooks_salientes.view'],
    nota: 'De lo que entra se ve la última decisión; los fallos son los avisos al escenario.',
    cargar: async (ctx) => {
      // No acepta ámbito: devuelve todo lo que ve la persona, y se recorta aquí.
      const pedir = ctx.pedir || datos;
      const filas = await pedir<Array<ConAmbito & { ultima_decision_at: string | null }>>('/asignacion');
      return Promise.all(filas.filter((d) => delAmbitoDeArriba(d, ctx.campus)).map(async (d) => ({
        clave: `asignacion-${d.id}`,
        nombre: d.nombre,
        campus: dondeVa(d),
        activo: !!d.activo,
        ...(await comoFueElUltimo(pedir, `/asignacion/decisiones?destino_id=${d.id}`, conAmbito(ctx.ambito, 'project_id', 'issuer_id'),
          { ultimo: d.ultima_decision_at, fallidos30: d.fallidos_30_dias }, (e) => e.created_at)),
        enlace: '/conexion/asignacion-leads',
      })));
    },
  },
  {
    id: 'certifex',
    grupo: 'admision',
    titulo: 'Avisos de Certifex',
    queHace: 'Certifex avisa al CRM de las consultas de los alumnos, las solicitudes de diploma y los cursos completados.',
    direccion: 'entra',
    enlace: '/clientes/matriculas/certificaciones',
    // Los de su pantalla (Matrículas › Certificaciones): `certifex_consultas.view`
    // y administración o soporte (MatriculasPage, `verConsultas`); y la propia
    // Matrículas. Sin el panel de Certifex en este entorno no hay pantalla.
    permisos: ['certifex_consultas.view'],
    requiere: ['matriculas.view'],
    roles: ['superadmin', 'admin', 'soporte'],
    enEsteEntorno: () => CERTIFEX_PANEL,
    nota: 'Es uno para todo el CRM. No guarda si un aviso falló; las consultas por atender se ven en su pantalla.',
    cargar: async (ctx) => {
      const d = await (ctx.pedir || datos)<{ nuevas?: number }>('/certifex/consultas?limite=1');
      const n = Number(d?.nuevas) || 0;
      return [{
        clave: 'certifex',
        nombre: n ? `${n} ${n === 1 ? 'consulta nueva' : 'consultas nuevas'} por atender` : 'Sin consultas nuevas',
        campus: null,
        activo: null,
        enlace: '/clientes/matriculas/certificaciones',
      }];
    },
  },
];

/** Lo que traen las configuraciones con ámbito (transferencias y asignación). */
type ConAmbito = {
  id: number; nombre: string; activo: boolean; ambito: string;
  project_id: number | null; issuer_id: number | null;
  proyecto: string | null; empresa: string | null;
  ultimo_envio_at?: string | null; fallidos_30_dias: number;
};

/**
 * El ámbito de arriba como parámetros de otra ruta, con sus nombres
 * (`/webhooks-salientes/envios` usa projectId/issuerId; `/asignacion/decisiones`,
 * project_id/issuer_id). Sin ámbito («Todos»), nada.
 */
function conAmbito(ambito: URLSearchParams, campo: string, empresa: string): string {
  const p = ambito.get('projectId');
  const e = ambito.get('issuerId');
  return p ? `&${campo}=${p}` : e ? `&${empresa}=${e}` : '';
}

const dondeVa = (w: ConAmbito) => (w.ambito === 'todas' ? 'Todas las empresas' : (w.proyecto || w.empresa));
const fallidos = (n: number) => (n > 0 ? `${n} ${n === 1 ? 'envío fallido' : 'envíos fallidos'} en 30 días` : null);

/**
 * Si falló el ÚLTIMO envío (sin contar las pruebas), y los fallidos de 30 días
 * aparte. Un webhook que falló hace dos semanas y desde entonces va bien no
 * está fallando: sus fallidos se dicen como aviso, sin contar en «con fallos».
 * Si no se puede leer el último, se dice, y los fallidos quedan como aviso.
 */
type Envio = {
  estado: string; prueba?: boolean; error?: string | null; http_status?: number | null;
  created_at?: string | null; enviado_at?: string | null;
};

async function comoFueElUltimo(
  pedir: Pedir,
  base: string,
  ambito: string,
  delServidor: { ultimo: string | null; fallidos30: number },
  // La fecha que el servidor usa como «último» en cada tipo, para que con un
  // ámbito se mida lo mismo que con «Todos». Transferencias: `ultimo_envio_at`
  // = MAX(enviado_at), la última entrega BUENA. Asignación:
  // `ultima_decision_at` = MAX(created_at), la última decisión.
  fechaDe: (e: Envio) => string | null | undefined,
): Promise<Pick<FilaWebhook, 'ultimo' | 'fallo' | 'aviso' | 'sinLeer'>> {
  const falloDe = (e?: Envio) => (e?.estado === 'fallido'
    ? `El último envío falló: ${e.error || (e.http_status ? `respondió ${e.http_status}` : 'no se pudo entregar')}`
    : null);

  // «Todos»: la fecha y los fallidos de 30 días los da el servidor, de todo el
  // CRM, que es lo que se mira. Basta con los últimos envíos para el fallo.
  if (!ambito) {
    const aviso = fallidos(delServidor.fallidos30) || undefined;
    try {
      const envios = await pedir<Envio[]>(`${base}&limit=5`);
      return { ultimo: delServidor.ultimo, fallo: falloDe(envios.find((e) => !e.prueba)), aviso };
    } catch {
      return { ultimo: delServidor.ultimo, aviso, sinLeer: 'No se pudo leer su último envío' };
    }
  }

  // Con un campus o una empresa, los del servidor son de TODO el CRM: una fila
  // de un webhook «de todas las empresas» diría «Último aviso: hoy · 3
  // fallidos» por otra empresa, junto a un fallo que sí es de esta. Todo sale
  // de los envíos de este ámbito (los 200 últimos, el tope de la ruta).
  const TOPE = 200;
  try {
    // El tope se mira con lo que llega, ANTES de quitar las pruebas: si no, una
    // prueba entre los 200 escondía que podía haber más.
    const crudos = await pedir<Envio[]>(`${base}&limit=${TOPE}${ambito}`);
    const envios = crudos.filter((e) => !e.prueba);
    const hace30 = Date.now() - 30 * 864e5;
    const reciente = (e: Envio) => Boolean(e.created_at && new Date(e.created_at).getTime() >= hace30);
    const n = envios.filter((e) => reciente(e) && e.estado === 'fallido').length;
    // Llegaron 200 y el más antiguo aún es de estos 30 días: puede haber más.
    const masDe = crudos.length >= TOPE && reciente(crudos[crudos.length - 1]);
    const aviso = n
      ? `${n}${masDe ? ' o más' : ''} ${n === 1 && !masDe ? 'envío fallido' : 'envíos fallidos'} en 30 días aquí`
      : masDe ? '200 o más envíos en 30 días aquí: los fallidos se ven en su pantalla' : undefined;
    const fechas = envios.map(fechaDe).filter((f): f is string => Boolean(f)).sort();
    // Sin fecha entre los que llegaron: si se llegó al tope, la última entrega
    // puede ser anterior (o un reenvío antiguo): no se sabe, y no se dice «sin
    // avisos todavía», que sería falso. Solo sin tope es seguro que no hay.
    const ultimo = fechas.length ? fechas[fechas.length - 1] : crudos.length >= TOPE ? undefined : null;
    return { ultimo, fallo: falloDe(envios[0]), aviso };
  } catch {
    return { ultimo: undefined, sinLeer: 'No se pudo leer sus envíos de este ámbito' };
  }
}

/**
 * Qué tipos ve alguien: los de su permiso, con el rol que pide su pantalla si
 * pide alguno y, si van con módulo, con el módulo encendido.
 */
export function tiposVisibles(
  can: (p: string) => boolean,
  moduloEncendido: (m: string) => boolean = () => true,
  tipos: TipoWebhook[] = TIPOS,
  tieneRol: (...roles: string[]) => boolean = () => true,
): TipoWebhook[] {
  return tipos.filter((t) => t.permisos.some((p) => can(p))
    && (t.requiere || []).every((p) => can(p))
    && (!t.roles || tieneRol(...t.roles))
    && (!t.modulo || moduloEncendido(t.modulo))
    && (!t.enEsteEntorno || t.enEsteEntorno()));
}

/** Los campus de un tipo: sin los que tienen apagado su módulo (`modules[x] === false`). */
export function campusDelTipo(tipo: TipoWebhook, campus: Campus[]): Campus[] {
  const m = tipo.moduloCampus;
  return m ? campus.filter((c) => c.modules?.[m] !== false) : campus;
}

/** Las de la tarjeta con algo que mirar primero: lo que falla, luego lo apagado. */
export function ordenarFilas(filas: FilaWebhook[]): FilaWebhook[] {
  const peso = (f: FilaWebhook) => (f.fallo ? 0 : f.activo === false ? 2 : 1);
  return [...filas].sort((a, b) => peso(a) - peso(b)
    || String(a.campus || '').localeCompare(String(b.campus || ''), 'es')
    || a.nombre.localeCompare(b.nombre, 'es'));
}
