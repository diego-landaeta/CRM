import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { useProject } from '@/shared/hooks/useProject';
import ProductFormDialog from '../components/ProductFormDialog';
import { toast } from '@/shared/hooks/useToast';
import { Plus, PencilSimple, Trash, FileText, Package } from '@phosphor-icons/react';
import Portal from '@/shared/components/ui/portal';

export default function ProductsPage() {
  const navigate = useNavigate();
  const { activeProject } = useProject();
  const projectId = activeProject?.id;
  const { products, loading, error, create, update, deactivate } = useProducts(projectId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  function openCreate() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setFormOpen(true);
  }

  async function handleSubmit(data) {
    try {
      if (editingProduct) {
        await update(editingProduct.id, data);
        toast({ title: 'Producto actualizado', description: data.nombre });
      } else {
        await create(data);
        toast({ title: 'Producto creado', description: data.nombre });
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      throw err;
    }
  }

  async function handleDeactivate() {
    if (!deleteTarget) return;
    try {
      await deactivate(deleteTarget.id);
      toast({ title: 'Producto desactivado', description: deleteTarget.nombre, variant: 'destructive' });
      setDeleteTarget(null);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Package size={48} className="text-muted-foreground mb-4" weight="regular" />
        <p className="text-muted-foreground">Selecciona un proyecto para ver sus productos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProductFormDialog open={formOpen} onClose={() => setFormOpen(false)} product={editingProduct} onSubmit={handleSubmit} />

      {/* Delete confirm */}
      {deleteTarget && (
        <Portal>
        <div className="fixed inset-0 z-[70] flex items-center justify-center sm:p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-card rounded-lg border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-sm mx-4 p-4 sm:p-8 overflow-y-auto max-h-[90vh] text-center">
            <h2 className="text-lg font-semibold mb-2">Desactivar producto</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Estas seguro de desactivar <strong>"{deleteTarget.nombre}"</strong>? El producto dejara de estar visible pero no se eliminara.
            </p>
            <div className="flex justify-center gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-5 py-2.5 rounded-md border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={handleDeactivate} className="px-5 py-2.5 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">
                Desactivar
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Productos</h1>
          <p className="text-muted-foreground text-sm">Catalogo de productos y dossiers — {activeProject.nombre}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} weight="bold" /> Nuevo Producto
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-4 py-2.5 font-medium">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-6 animate-pulse">
              <div className="h-10 w-10 bg-muted rounded-md mb-4" />
              <div className="h-5 w-3/4 bg-muted rounded mb-2" />
              <div className="h-4 w-1/2 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={48} className="text-muted-foreground mb-4" weight="regular" />
          <p className="font-semibold">No hay productos en este proyecto</p>
          <p className="text-sm text-muted-foreground mt-1">Crea tu primer producto para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {products.map((product) => (
            <div key={product.id} className={`bg-card p-6 rounded-lg border border-border  transition-all ${!product.active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                  <Package size={20} weight="regular" />
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${product.active ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                  {product.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <h3 className="font-semibold">{product.nombre}</h3>
              <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2">{product.descripcion || 'Sin descripcion'}</p>

              {product.precio && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <span className="text-2xl font-semibold">{product.precio.toLocaleString('es-ES')} &euro;</span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3 text-[13px]">
                {product.has_dossier ? (
                  <button
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="flex items-center gap-1.5 text-primary font-medium hover:underline"
                  >
                    <FileText size={14} /> Dossier v{product.dossier_version}
                  </button>
                ) : (
                  <span className="text-muted-foreground">Sin dossier</span>
                )}
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t">
                <button
                  onClick={() => openEdit(product)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border border-border bg-card text-[13px] font-medium hover:bg-muted transition-colors"
                >
                  <PencilSimple size={14} /> Editar
                </button>
                <button
                  onClick={() => setDeleteTarget(product)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-md border border-border text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
