import * as service from './facturas-colaborador.service.js';
import { AppError } from '../../shared/utils/AppError.js';
import {
  crearColaboradorSchema,
  editarColaboradorSchema,
  bajaSchema,
  listarColaboradoresSchema,
} from './facturas-colaborador.validation.js';

function validar(schema, datos) {
  const r = schema.safeParse(datos ?? {});
  if (!r.success) {
    throw new AppError(r.error.errors[0]?.message || 'Datos inválidos', 400, 'VALIDATION_ERROR');
  }
  return r.data;
}

function validarId(paramId) {
  const id = Number(paramId);
  if (!/^\d+$/.test(String(paramId)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
    throw new AppError('ID inválido', 400, 'VALIDATION_ERROR');
  }
  return id;
}

// La misma IP que guarda el registro de entradas (auth.controller.js).
const ipDe = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;

const accion = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

export const empresas = accion(async (req, res) => {
  res.json({ success: true, data: await service.empresas(req.user) });
});

export const listar = accion(async (req, res) => {
  const filtros = validar(listarColaboradoresSchema, req.query);
  res.json({ success: true, data: await service.listar(req.user, filtros) });
});

export const ver = accion(async (req, res) => {
  res.json({ success: true, data: await service.ver(req.user, validarId(req.params.id)) });
});

export const crear = accion(async (req, res) => {
  const datos = validar(crearColaboradorSchema, req.body);
  res.status(201).json({ success: true, data: await service.crear(req.user, datos, ipDe(req)) });
});

export const editar = accion(async (req, res) => {
  const cambios = validar(editarColaboradorSchema, req.body);
  res.json({ success: true, data: await service.editar(req.user, validarId(req.params.id), cambios, ipDe(req)) });
});

export const darDeBaja = accion(async (req, res) => {
  const { desde } = validar(bajaSchema, req.body);
  res.json({ success: true, data: await service.darDeBaja(req.user, validarId(req.params.id), desde, ipDe(req)) });
});

export const registro = accion(async (req, res) => {
  res.json({ success: true, data: await service.registro(req.user, validarId(req.params.id)) });
});
