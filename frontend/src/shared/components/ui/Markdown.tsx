import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Markdown pintado de verdad.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE NO VALEN LAS CLASES `prose-*`
 *
 * Estaban puestas en dos sitios —el reporte mensual con IA y el chat— y NO
 * HACEN NADA: `@tailwindcss/typography` no está instalado en este proyecto, así
 * que `prose`, `prose-invert` y compañía son nombres de clase que no existen.
 *
 * No es un detalle estético. Con el reset de Tailwind por medio, el resultado
 * era:
 *
 *   - las tablas sin rejilla, con las columnas pegadas — «6» y «21,4 %» se
 *     leían como «621,4 %»,
 *   - las listas numeradas sin números, o sea párrafos sueltos,
 *   - las citas sin marca, indistinguibles del texto normal.
 *
 * Y una respuesta de IA sobre datos del CRM es casi siempre una tabla. Es el
 * caso principal, no el raro.
 *
 * Así que aquí va cada etiqueta con sus clases, que además es lo que permite
 * que use los colores del tema —claro y oscuro— en vez de los del plugin.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed space-y-3 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children: c }) => <h3 className="text-base font-bold mt-4 first:mt-0">{c}</h3>,
          h2: ({ children: c }) => <h4 className="text-sm font-bold mt-4 first:mt-0">{c}</h4>,
          h3: ({ children: c }) => (
            <h5 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mt-4 first:mt-0">{c}</h5>
          ),
          p: ({ children: c }) => <p className="leading-relaxed">{c}</p>,
          strong: ({ children: c }) => <strong className="font-bold text-foreground">{c}</strong>,
          em: ({ children: c }) => <em className="italic">{c}</em>,

          // Los marcadores se ponen a mano: el reset de Tailwind los quita, y
          // una lista numerada sin numeros es una lista de parrafos.
          ul: ({ children: c }) => <ul className="list-disc pl-5 space-y-1 marker:text-muted-foreground">{c}</ul>,
          ol: ({ children: c }) => <ol className="list-decimal pl-5 space-y-1 marker:text-muted-foreground marker:font-semibold">{c}</ol>,
          li: ({ children: c }) => <li className="leading-relaxed pl-0.5">{c}</li>,

          // La tabla, dentro de su propio scroll: una de seis columnas en el
          // ancho de un chat no cabe, y sin esto empuja la pagina entera de
          // lado.
          table: ({ children: c }) => (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs border-collapse">{c}</table>
            </div>
          ),
          thead: ({ children: c }) => <thead className="bg-muted/60">{c}</thead>,
          th: ({ children: c }) => (
            <th className="border-b border-border px-2.5 py-1.5 text-left font-bold whitespace-nowrap">{c}</th>
          ),
          td: ({ children: c }) => (
            <td className="border-b border-border/60 px-2.5 py-1.5 align-top tabular-nums">{c}</td>
          ),
          tr: ({ children: c }) => <tr className="last:[&>td]:border-0">{c}</tr>,

          blockquote: ({ children: c }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground italic">{c}</blockquote>
          ),

          code: ({ className, children: c }) => {
            // Sin `language-*` es codigo dentro de una linea; con el, un bloque.
            const enBloque = /language-/.test(className || '');
            if (enBloque) return <code className="block">{c}</code>;
            return (
              <code className="rounded bg-muted px-1 py-0.5 text-[12px] font-mono">{c}</code>
            );
          },
          pre: ({ children: c }) => (
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-[12px] font-mono">{c}</pre>
          ),

          a: ({ href, children: c }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              {c}
            </a>
          ),
          hr: () => <hr className="border-border" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
