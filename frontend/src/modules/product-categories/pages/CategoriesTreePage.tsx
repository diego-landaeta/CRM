import { useEffect, useState } from 'react';
import { useProject } from '@/shared/hooks/useProject';
import { getTree, type CategoryNode } from '../api/categories.api';
import { CaretDown, CaretRight, Tree } from '@phosphor-icons/react';

function NodeRow({ node, depth }: { node: CategoryNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 hover:bg-muted/50 rounded px-2 cursor-pointer"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        onClick={() => hasChildren && setOpen((o) => !o)}
      >
        {hasChildren ? (
          open ? <CaretDown size={16} /> : <CaretRight size={16} />
        ) : (
          <span style={{ width: 16, display: 'inline-block' }} />
        )}
        <span className="font-medium">{node.nombre}</span>
        {node.productos_count > 0 && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">
            {node.productos_count} productos
          </span>
        )}
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground ml-2">
          {node.source}
        </span>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((child) => (
            <NodeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriesTreePage() {
  const { activeProject } = useProject();
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProject?.id) return;
    setLoading(true);
    getTree(activeProject.id)
      .then((data) => {
        setTree(data);
        setError(null);
      })
      .catch((e) => setError(e.message || 'Error al cargar el árbol'))
      .finally(() => setLoading(false));
  }, [activeProject?.id]);

  function countAll(nodes: CategoryNode[]): { total: number; productos: number } {
    let t = 0;
    let p = 0;
    function walk(n: CategoryNode[]) {
      for (const x of n) {
        t++;
        p += x.productos_count;
        walk(x.children);
      }
    }
    walk(nodes);
    return { total: t, productos: p };
  }

  const stats = countAll(tree);

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Tree size={28} className="text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Árbol de categorías</h1>
          <p className="text-sm text-muted-foreground">
            Jerarquía de N niveles de las categorías de productos del proyecto activo.
          </p>
        </div>
      </div>

      {loading && <div className="text-muted-foreground">Cargando árbol…</div>}

      {error && (
        <div className="bg-destructive/10 text-destructive rounded p-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && tree.length === 0 && (
        <div className="bg-muted rounded p-8 text-center text-muted-foreground">
          Sin categorías en este proyecto.<br />
          <span className="text-xs">Sincroniza WooCommerce o crea una manualmente desde Settings.</span>
        </div>
      )}

      {!loading && tree.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground mb-3">
            <strong>{stats.total}</strong> categorías totales · <strong>{stats.productos}</strong> productos asignados
          </div>
          <div className="border rounded-lg p-2 bg-card">
            {tree.map((node) => (
              <NodeRow key={node.id} node={node} depth={0} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
