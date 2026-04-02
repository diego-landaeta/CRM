import { useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useProject } from '@/shared/hooks/useProject';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/shared/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/shared/components/ui/alert-dialog';
import { Plus, PencilSimple, Trash, FileText } from '@phosphor-icons/react';

export default function ProductsPage() {
  const { activeProject } = useProject();
  const projectId = activeProject?.id;
  const { products, loading, error, create, update, deactivate } = useProducts(projectId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  function openCreate() {
    setEditingProduct(null);
    setFormData({ nombre: '', descripcion: '' });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setFormData({ nombre: product.nombre, descripcion: product.descripcion || '' });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.nombre.trim()) { setFormError('El nombre es obligatorio'); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingProduct) { await update(editingProduct.id, formData); }
      else { await create(formData); }
      setDialogOpen(false);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Error al guardar');
    } finally { setSubmitting(false); }
  }

  async function handleDeactivate() {
    if (!deleteTarget) return;
    try { await deactivate(deleteTarget.id); } catch { /* hook handles */ }
    setDeleteTarget(null);
  }

  if (!projectId) {
    return <div className="p-8 text-center text-muted-foreground">Selecciona un proyecto para ver sus productos.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Productos</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuevo producto</Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Cargando productos...</p>
      ) : products.length === 0 ? (
        <p className="text-muted-foreground">No hay productos en este proyecto.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripcion</TableHead>
              <TableHead>Dossier</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.nombre}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">{product.descripcion || '—'}</TableCell>
                <TableCell>
                  {product.has_dossier
                    ? <FileText className="h-4 w-4 text-primary" />
                    : <Badge variant="outline" className="text-xs">Sin dossier</Badge>}
                </TableCell>
                <TableCell>
                  <Badge variant={product.active ? 'default' : 'secondary'}>{product.active ? 'Activo' : 'Inactivo'}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(product)}><PencilSimple className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(product)}><Trash className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingProduct ? 'Editar producto' : 'Nuevo producto'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Nombre del producto" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripcion</Label>
              <Input id="descripcion" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} placeholder="Descripcion corta (opcional)" />
            </div>
            {formError && <p className="text-destructive text-sm">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : editingProduct ? 'Guardar cambios' : 'Crear producto'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar producto</AlertDialogTitle>
            <AlertDialogDescription>¿Estas seguro de desactivar &quot;{deleteTarget?.nombre}&quot;? El producto dejara de estar visible pero no se eliminara.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Desactivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
