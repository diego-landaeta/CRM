import { v4 as uuidv4 } from 'uuid';
import * as Docs from './documentos-marca.model.js';
import { uploadToR2 } from '../../shared/services/r2.service.js';
import { generatePresignedUrl } from '../../shared/utils/presignedUrl.js';
import { AppError } from '../../shared/utils/AppError.js';

/** Cómo se llama cada uno de cara a quien lo recibe. */
export const NOMBRES = {
  guia_campus: 'Guía del campus virtual',
  homologaciones: 'Homologaciones y acreditaciones',
  otro: 'Documento',
};

export function listar(projectId) {
  return Docs.vigentes(projectId);
}

export async function subir({ projectId, tipo, file, userId, nombreVisible }) {
  if (!file) throw new AppError('Falta el archivo', 400, 'NO_FILE');
  const key = `documentos-marca/${projectId}/${tipo}/${uuidv4()}-${Date.now()}.pdf`;
  await uploadToR2(key, file.buffer, 'application/pdf');
  return Docs.nuevaVersion({
    projectId, tipo, s3Key: key,
    filenameOriginal: file.originalname,
    nombreVisible: nombreVisible || NOMBRES[tipo],
    sizeBytes: file.size,
    subidoPor: userId,
  });
}

/**
 * El enlace para descargarlo, con el mismo candado que los dossiers: caduca.
 *
 * Se comprueba que el documento sea DEL PROYECTO por el que se pregunta. El id
 * viene de la URL y sin esta comprobación se descargaría el de otra marca
 * escribiendo un número.
 */
export async function enlace(id, projectId) {
  const doc = await Docs.findById(id);
  if (!doc || doc.project_id !== projectId) {
    throw new AppError('Documento no encontrado', 404, 'NOT_FOUND');
  }
  const url = await generatePresignedUrl(doc.s3_key);
  return { url, filename: doc.nombre_visible || doc.filename_original };
}

/**
 * Lo que hace falta para el correo del día 1, dicho en claro (#91).
 *
 * El documento comercial: «sin los tres, el correo no sale». Esto dice cuáles
 * de los tres están y cuáles no, para que la pantalla pueda impedir el envío
 * ANTES de escribir el correo, y no después.
 */
export async function loQueFaltaParaElDiaUno(projectId, dossierDelCurso) {
  const faltan = await Docs.loQueFalta(projectId);
  const todo = [...faltan];
  if (!dossierDelCurso) todo.push('dossier');
  return {
    completo: todo.length === 0,
    faltan: todo,
    // En palabras, que es lo que se va a enseñar. «guia_campus» no se lo dice
    // a nadie.
    dichoEnClaro: todo.map((t) => (t === 'dossier'
      ? 'el dossier de la formación'
      : NOMBRES[t].toLowerCase())),
  };
}
