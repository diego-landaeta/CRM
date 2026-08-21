import { useEffect, useState } from 'react';
import { X, PaperPlaneTilt, FileText } from '@phosphor-icons/react';

// Ver lo que vas a mandar, antes de mandarlo.
//
// Antes se enviaba directo al elegir el fichero: no habia paso intermedio y
// quien adjuntaba no veia que estaba mandando hasta que ya estaba enviado. En
// WhatsApp un mensaje no se recoge pasados unos minutos, asi que equivocarse de
// captura no tenia arreglo.
//
// El camino peor era pegar o arrastrar, que es justo donde mas facil es mandar
// lo que no era: se pega una captura sin mirar.
//
// De paso, el pie de foto va aqui. Antes habia que mandar la imagen y escribir
// despues: dos mensajes para una sola cosa.

const tamano = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

export default function VistaPreviaAdjunto({
  archivos, enviando, alEnviar, alCancelar,
}: {
  archivos: File[];
  enviando: boolean;
  alEnviar: (pie: string) => void;
  alCancelar: () => void;
}) {
  const [pie, setPie] = useState('');
  const [vistas, setVistas] = useState<string[]>([]);

  // Las miniaturas se sueltan al cerrar: cada createObjectURL se queda en
  // memoria hasta que se revoca, y aqui se abren y cierran muchas.
  useEffect(() => {
    const urls = archivos.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : ''));
    setVistas(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [archivos]);

  // Escape cancela: es lo que se intenta primero al ver algo que no querias.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) alCancelar(); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [alCancelar, enviando]);

  if (!archivos.length) return null;
  const varios = archivos.length > 1;

  return (
    <div className="wa-velo" onClick={() => !enviando && alCancelar()}>
      <form className="wa-panel wa-previa" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (!enviando) alEnviar(pie.trim()); }}>
        <div className="wa-panel-cabecera">
          <span>{varios ? `Enviar ${archivos.length} archivos` : 'Enviar archivo'}</span>
          <button type="button" onClick={alCancelar} disabled={enviando}
            className="wa-panel-cerrar" title="Cancelar (Esc)">
            <X size={14} />
          </button>
        </div>

        <div className="wa-previa-lienzo">
          {archivos.map((f, i) => (
            <div key={`${f.name}-${i}`} className="wa-previa-uno">
              {vistas[i]
                ? <img src={vistas[i]} alt={f.name} className="wa-previa-img" />
                : <div className="wa-previa-doc"><FileText size={34} weight="duotone" /></div>}
              <span className="wa-previa-nombre" title={f.name}>{f.name}</span>
              <span className="wa-previa-peso">{tamano(f.size)}</span>
            </div>
          ))}
        </div>

        <div className="wa-panel-cuerpo">
          <input autoFocus value={pie} onChange={(e) => setPie(e.target.value)}
            placeholder={varios ? 'Un pie para todos (opcional)' : 'Anade un pie de foto (opcional)'}
            className="wa-campo" disabled={enviando} />
        </div>

        <div className="wa-panel-pie">
          <button type="button" onClick={alCancelar} disabled={enviando} className="wa-btn-suave">
            Cancelar
          </button>
          <button type="submit" disabled={enviando} className="wa-btn-verde">
            <PaperPlaneTilt size={14} weight="fill" />
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  );
}
