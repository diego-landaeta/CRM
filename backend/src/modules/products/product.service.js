import * as ProductModel from './product.model.js';
import { AppError } from '../../shared/utils/AppError.js';

export async function listByProject(projectId) {
  return ProductModel.findByProject(projectId);
}

export async function getById(id, projectId) {
  const product = await ProductModel.findById(id);
  if (!product) throw new AppError('Producto no encontrado', 404, 'PRODUCT_NOT_FOUND');
  if (product.project_id !== projectId) throw new AppError('No tienes acceso a este producto', 403, 'FORBIDDEN');
  return product;
}

export async function create(data) {
  const existing = await ProductModel.findByProjectAndName(data.projectId, data.nombre);
  if (existing) throw new AppError('Ya existe un producto con ese nombre en este proyecto', 409, 'PRODUCT_DUPLICATE');
  return ProductModel.create(data);
}

export async function update(id, projectId, data) {
  const product = await getById(id, projectId);
  if (data.nombre && data.nombre !== product.nombre) {
    const existing = await ProductModel.findByProjectAndName(projectId, data.nombre);
    if (existing) throw new AppError('Ya existe un producto con ese nombre en este proyecto', 409, 'PRODUCT_DUPLICATE');
  }
  return ProductModel.update(id, data);
}

export async function deactivate(id, projectId) {
  await getById(id, projectId);
  return ProductModel.deactivate(id);
}
