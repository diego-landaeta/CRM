import { useEffect, useState } from 'react';
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
    texto: 'Tu numero, tus conversaciones. Nadie mas del equipo las ve. Seis pasos y te dejo trabajar.',
  },
  {
    donde: '.wa-barra-lista .cs-search',
    titulo: 'Busca por aqui',
    texto: 'Por nombre o por telefono. Con muchas conversaciones es mas rapido que bajar la lista.',
  },
  {
    donde: '.wa-btn-nuevo',
    titulo: 'Escribir a alguien nuevo',
    texto: 'Busca al prospecto y abre su chat, o escribe a un numero suelto. Si esa persona no esta en el CRM se puede escribir igual, pero queda anotado: escribir a quien no pidio informacion es lo que hace que reporten un numero.',
  },
  {
    donde: '.cs-message-input',
    titulo: 'Escribe, manda archivos o graba',
    texto: 'El clip para adjuntar, el microfono para una nota de voz. Antes de enviar veras lo que mandas, con su pie de foto. Tambien puedes pegar una imagen aqui o arrastrarla.',
  },
  {
    donde: '.wa-btn-prohibir',
    titulo: 'Si te piden que no escribas',
    texto: 'Marcalo aqui y el CRM no le vuelve a enviar nada, ni con plantilla. Es la regla que mas protege tu linea.',
  },
  {
    titulo: 'Un par de cosas mas',
    texto: 'Pasa el raton por un mensaje para responderlo citandolo. Si alguno sale con ⚠ es que no salio, y debajo tiene «Reintentar». Todo lo demas esta en «Como se usa», en el menu.',
  },
];

export default function Tour({ alCerrar }: { alCerrar?: () => void }) {
  const [paso, setPaso] = useState(0);
  const [hueco, setHueco] = useState<DOMRect | null>(null);

  const actual = PASOS[paso];

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
    const medir = () => {
      const el = document.querySelector(actual.donde!);
      if (el) { esperando = 0; setHueco(el.getBoundingClientRect()); return; }
      setHueco(null);
      // Kilometro y medio de margen: 1,5 s de espera antes de darlo por perdido.
      esperando += 1;
      if (esperando > 3) saltar();
    };
    medir();
    window.addEventListener('resize', medir);
    const t = setInterval(medir, 500);
    return () => { window.removeEventListener('resize', medir); clearInterval(t); };
  }, [actual, paso]);

  /**
   * Al siguiente paso que SI tenga algo que señalar.
   *
   * Si no queda ninguno se cierra: mejor nada que un recorrido que no recorre.
   */
  function saltar() {
    for (let i = paso + 1; i < PASOS.length; i++) {
      const p = PASOS[i];
      if (!p.donde || document.querySelector(p.donde)) { setPaso(i); return; }
    }
    cerrar();
  }

  function cerrar() {
    try { localStorage.setItem(VISTO, '1'); } catch { /* navegador sin permiso */ }
    alCerrar?.();
  }

  const ultimo = paso === PASOS.length - 1;

  // El cartel, pegado a lo que señala pero sin salirse de la pantalla.
  const margen = 12;
  const anchoCartel = 300;
  let izquierda = hueco ? hueco.left : window.innerWidth / 2 - anchoCartel / 2;
  let arriba = hueco ? hueco.bottom + margen : window.innerHeight / 2 - 90;
  izquierda = Math.max(margen, Math.min(izquierda, window.innerWidth - anchoCartel - margen));
  if (arriba + 190 > window.innerHeight) arriba = Math.max(margen, (hueco?.top ?? 0) - 190);

  return (
    <div className="wa-tour" onClick={cerrar}>
      {/* El recuadro que rodea lo que se esta explicando. */}
      {hueco && (
        <div className="wa-tour-foco" style={{
          left: hueco.left - 6, top: hueco.top - 6,
          width: hueco.width + 12, height: hueco.height + 12,
        }} />
      )}

      <div className="wa-tour-cartel" style={{ left: izquierda, top: arriba }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wa-tour-cabecera">
          <span>{actual.titulo}</span>
          <button type="button" onClick={cerrar} className="wa-panel-cerrar" title="Cerrar">
            <X size={14} />
          </button>
        </div>
        <p className="wa-tour-texto">{actual.texto}</p>
        <div className="wa-tour-pie">
          <span className="wa-tour-cuenta">{paso + 1} de {PASOS.length}</span>
          <div className="wa-tour-botones">
            {paso > 0 && (
              <button type="button" className="wa-btn-suave" onClick={() => setPaso(paso - 1)}>
                <ArrowLeft size={13} /> Atras
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
