import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ArrowRight, ArrowLeft } from '@phosphor-icons/react';

// El tour del chat.
//
// La guia escrita esta bien para leerla una vez, pero nadie la lee antes de
// empezar: se abre el chat y se prueba. Esto son seis pasos señalando lo que ya
// tiene delante, la primera vez que entra.
//
// Se marca en el navegador de cada persona, no en la base: es una preferencia
// suya, no un dato del CRM, y no merece una tabla ni una migracion.

const VISTO = 'wa-tour-visto-v1';

type Paso = {
  /** A que se apunta. Si no esta en pantalla, el paso se salta. */
  donde?: string;
  titulo: string;
  texto: string;
};

const PASOS: Paso[] = [
  {
    titulo: 'Esto es tu WhatsApp',
    texto: 'Tu número, tus conversaciones. Nadie más del equipo las ve. {pasos} pasos y te dejo trabajar.',
  },
  {
    // Solo sale si NO hay numero enlazado: ese aviso desaparece en cuanto lo
    // hay, y entonces el paso se salta solo. Sin esto, quien abria el chat sin
    // enlazar recibia un recorrido sobre buscar, escribir y llamar — todo cosas
    // que aun no puede hacer— y nadie le decia lo primero que tenia que hacer.
    donde: '.wa-sin-enlazar',
    titulo: 'Primero, enlaza tu número',
    texto: 'Todavía no tienes ninguno conectado, así que aquí no hay nada que leer ni a quién escribir. Pulsa «enlazar mi número», acepta el aviso y escanea el código con tu móvil. En «Cómo se usa» está el paso a paso con las pantallas del teléfono.',
  },
  {
    donde: '.wa-barra-lista .cs-search',
    titulo: 'Busca por aquí',
    texto: 'Por nombre o por teléfono. Con muchas conversaciones es más rápido que bajar la lista.',
  },
  {
    donde: '.wa-btn-nuevo',
    titulo: 'Escribir a alguien nuevo',
    texto: 'Busca al prospecto y abre su chat, o escribe a un número suelto. Si esa persona no está en el CRM se puede escribir igual, pero queda anotado: escribir a quien no pidió información es lo que hace que reporten un número.',
  },
  {
    donde: '.cs-message-input',
    titulo: 'Escribe, manda archivos o graba',
    texto: 'El clip para adjuntar, el micrófono para una nota de voz. Antes de enviar verás lo que mandas, con su pie de foto. También puedes pegar una imagen aquí o arrastrarla.',
  },
  {
    donde: '.wa-btn-llamar',
    titulo: 'Llamar, y las que te llegan',
    texto: 'Este botón abre la llamada en TU móvil: desde el CRM no se puede hablar, WhatsApp no lo permite. Lo que sí hace es apuntarla. Y si te llaman, sale un aviso aunque estés en otra pantalla del CRM — cógela en el móvil. Las perdidas quedan en el chat y en la ficha del prospecto.',
  },
  {
    donde: '.wa-btn-prohibir',
    titulo: 'Si te piden que no escribas',
    texto: 'Márcalo aquí y el CRM no le vuelve a enviar nada, ni con plantilla. Es la regla que más protege tu línea.',
  },
  {
    donde: '.wa-btn-ampliar',
    titulo: 'Si vas a pasar la mañana aquí',
    texto: 'Amplía y desaparece todo lo demás del CRM: menú, cabecera y selector de proyecto. Se sale con Escape o con el mismo botón. Al lado tienes «Conexión», que es donde se enlaza el número.',
  },
  {
    titulo: 'Un par de cosas más',
    texto: 'Pasa el ratón por un mensaje para responderlo citándolo. Si sale con ⚠ es que no salió, y debajo tiene «Reintentar». En el menú lateral están «Plantillas» —los mensajes de siempre, que ve todo el equipo— y la cola de prospectos. Este recorrido vuelve con el «?» de arriba cuando quieras.',
  },
];

export default function Tour({ alCerrar }: { alCerrar?: () => void }) {
  const [paso, setPaso] = useState(0);
  const [hueco, setHueco] = useState<DOMRect | null>(null);
  // El alto real del cartel y el tamaño de la ventana. Los dos hacen falta para
  // colocarlo, y los dos cambian: el alto con cada paso, la ventana al girar el
  // movil o al ampliar la pantalla del chat.
  const cartel = useRef<HTMLDivElement | null>(null);
  const [altoCartel, setAltoCartel] = useState(0);
  const [ventana, setVentana] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));

  useEffect(() => {
    const alRedimensionar = () => setVentana({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', alRedimensionar);
    return () => window.removeEventListener('resize', alRedimensionar);
  }, []);

  // Despues de pintar: el texto de cada paso ocupa distinto.
  useEffect(() => {
    if (cartel.current) setAltoCartel(cartel.current.offsetHeight);
  }, [paso]);

  const actual = PASOS[paso];

  const cerrar = useCallback(() => {
    try { localStorage.setItem(VISTO, '1'); } catch { /* navegador sin permiso */ }
    alCerrar?.();
  }, [alCerrar]);

  // Estables a proposito. El efecto que mide llama a `saltar`, asi que tiene que
  // poder declararlo como dependencia; si cambiara de identidad en cada render,
  // el temporizador de medir se reiniciaria sin parar y no llegaria nunca a los
  // 1,5 segundos de espera que hacen que un paso valido no se salte.
  const saltar = useCallback(() => {
    for (let i = paso + 1; i < PASOS.length; i++) {
      const p = PASOS[i];
      if (!p.donde || document.querySelector(p.donde)) { setPaso(i); return; }
    }
    cerrar();
  }, [paso, cerrar]);

  // Se mide donde esta lo que se señala, cada vez. Guardar la posicion no vale:
  // la ventana cambia de tamaño y la lista crece mientras entra el historial.
  //
  // Y si NO se encuentra, el paso se salta — que es lo que decia el comentario
  // del tipo `Paso` y el codigo no hacia: pintaba el cartel igual, sin recuadro
  // y centrado en mitad de la pantalla. Cuatro de los seis pasos apuntan a
  // cosas que solo existen con una conversacion abierta, asi que quien lo veia
  // sin chats abiertos recibia una lista de carteles, no un recorrido.
  //
  // Antes de saltarlo se ESPERA: en esa pantalla la lista se llena por tandas
  // mientras entra el historial, y el objetivo puede tardar un segundo en
  // existir. Rendirse a la primera saltaria pasos que si eran validos.
  useEffect(() => {
    if (!actual?.donde) { setHueco(null); return undefined; }

    let esperando = 0;
    let traido = false;
    const medir = () => {
      const el = document.querySelector(actual.donde!);
      if (el) {
        esperando = 0;
        // Una vez por paso: si lo que se señala esta fuera de la vista, el
        // recuadro se dibujaba donde nadie lo ve y el cartel apuntaba a la nada.
        if (!traido) {
          traido = true;
          el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        }
        setHueco(el.getBoundingClientRect());
        return;
      }
      setHueco(null);
      // Kilometro y medio de margen: 1,5 s de espera antes de darlo por perdido.
      esperando += 1;
      if (esperando > 3) saltar();
    };
    medir();
    window.addEventListener('resize', medir);
    const t = setInterval(medir, 500);
    return () => { window.removeEventListener('resize', medir); clearInterval(t); };
  }, [actual, saltar]);

  /**
   * Al paso ANTERIOR que tenga algo que señalar.
   *
   * Sin esto, «Atras» volvia a ciegas: caia en un paso cuyo objetivo no existe
   * —por ejemplo el de llamar, que no sale en un grupo— y ese se salta solo
   * hacia adelante. O sea que pulsar «Atras» te llevaba al siguiente.
   */
  const atras = useCallback(() => {
    for (let i = paso - 1; i >= 0; i--) {
      const p = PASOS[i];
      if (!p.donde || document.querySelector(p.donde)) { setPaso(i); return; }
    }
  }, [paso]);

  // Escape cierra, como cualquier otra cosa que se abre encima. Sin esto habia
  // que buscar la X con el raton.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [cerrar]);

  const ultimo = paso === PASOS.length - 1;

  // El cartel, pegado a lo que señala pero sin salirse de la pantalla.
  //
  // El alto se MIDE. Antes estaba puesto a 190 px a ojo, y con un paso de texto
  // largo el cartel es bastante mas alto: se salia por abajo y las unicas dos
  // cosas que hay que poder pulsar —«Siguiente» y «Atras»— quedaban fuera de la
  // pantalla. Se mide despues de pintar y se recoloca.
  const margen = 12;
  const anchoCartel = 300;
  const alto = altoCartel || 190;
  let izquierda = hueco ? hueco.left : ventana.w / 2 - anchoCartel / 2;
  let arriba = hueco ? hueco.bottom + margen : ventana.h / 2 - alto / 2;
  izquierda = Math.max(margen, Math.min(izquierda, ventana.w - anchoCartel - margen));
  // Si no cabe debajo, encima. Y si tampoco cabe encima —pantalla corta—, se
  // pega arriba del todo: mejor tapar algo que dejar los botones fuera.
  if (arriba + alto + margen > ventana.h) {
    const encima = (hueco?.top ?? ventana.h) - alto - margen;
    arriba = encima >= margen ? encima : margen;
  }

  return (
    <div className="wa-tour" onClick={cerrar}>
      {/* El recuadro que rodea lo que se esta explicando. */}
      {hueco && (
        <div className="wa-tour-foco" style={{
          left: hueco.left - 6, top: hueco.top - 6,
          width: hueco.width + 12, height: hueco.height + 12,
        }} />
      )}

      <div ref={cartel} className="wa-tour-cartel" style={{ left: izquierda, top: arriba }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wa-tour-cabecera">
          <span>{actual.titulo}</span>
          <button type="button" onClick={cerrar} className="wa-panel-cerrar" title="Cerrar">
            <X size={14} />
          </button>
        </div>
        <p className="wa-tour-texto">{actual.texto.replace('{pasos}', String(PASOS.length))}</p>
        {/* Cuanto queda, sin tener que leer «4 de 8». */}
        <div className="wa-tour-avance" aria-hidden="true">
          <span style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }} />
        </div>
        <div className="wa-tour-pie">
          <span className="wa-tour-cuenta">{paso + 1} de {PASOS.length}</span>
          <div className="wa-tour-botones">
            {paso > 0 && (
              <button type="button" className="wa-btn-suave" onClick={atras}>
                <ArrowLeft size={13} /> Atrás
              </button>
            )}
            {ultimo ? (
              <button type="button" className="wa-btn-verde" onClick={cerrar}>Entendido</button>
            ) : (
              <button type="button" className="wa-btn-verde" onClick={saltar}>
                Siguiente <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** ¿Toca enseñarlo? Solo la primera vez de cada persona en este navegador. */
export function tourPendiente() {
  try { return localStorage.getItem(VISTO) !== '1'; } catch { return false; }
}

/**
 * ¿Hay algo que señalar ahora mismo?
 *
 * Si ningun paso encuentra su objetivo, el recorrido serian seis carteles
 * sueltos. En ese caso no se abre.
 */
export function hayQueSeñalar() {
  return PASOS.some((p) => p.donde && document.querySelector(p.donde));
}

/** Para poder volver a verlo desde la guia. */
export function reiniciarTour() {
  try { localStorage.removeItem(VISTO); } catch { /* da igual */ }
}
