import * as carreraService from '../services/carrera.service.js';
import { ApiError } from '../utils/ApiError.js';
import { CAMPO_IMAGEN } from '../middlewares/upload.middleware.js';

// Sin try/catch: Express 5 propaga los rejects de los handlers async
// al errorHandler centralizado.

/**
 * GET /api/carreras
 *
 * Lista las carreras activas y permite aplicar búsqueda y filtros.
 */
export async function listar(req, res) {
  res.ok(await carreraService.listar(req.validated.query));
}

/**
 * GET /api/carreras/:id
 *
 * Obtiene el detalle de una carrera activa.
 */
export async function obtenerPorId(req, res) {
  res.ok(await carreraService.obtenerPorId(req.params.id));
}

// ============================================================
// ADMIN: crear / editar / dar de baja / eliminar
// ============================================================

/** POST /api/carreras */
export async function crear(req, res) {
  const carrera = await carreraService.crear(req.body);
  res.created(carrera, `/api/carreras/${carrera.id}`);
}

/** PATCH /api/carreras/:id */
export async function actualizar(req, res) {
  res.ok(await carreraService.actualizar(req.params.id, req.body));
}

/** DELETE /api/carreras/:id - baja logica */
export async function eliminar(req, res) {
  await carreraService.darDeBaja(req.params.id);
  res.noContent();
}

/** DELETE /api/carreras/:id/definitivo - hard delete */
export async function eliminarDefinitivo(req, res) {
  await carreraService.eliminarDefinitivo(req.params.id);
  res.noContent();
}

// ============================================================
// ADMIN: imagen de la carrera
// ============================================================

/**
 * PUT /api/carreras/:id/imagen
 *
 * Cubre cargar y reemplazar: con una sola imagen por carrera son la misma
 * operacion, y asi el front no necesita saber si ya habia una antes de mandar.
 *
 * Devuelve la carrera entera para que se entere del imagenUrl nuevo sin tener
 * que pedirla de nuevo.
 */
export async function establecerImagen(req, res) {
  // multer deja req.file en undefined si no vino ningun archivo. Sin este
  // chequeo el request seguiria hasta el service y explotaria leyendo
  // `archivo.buffer`, con un 500 que no le dice nada al usuario.
  if (!req.file) {
    throw ApiError.badRequest(
      `Hay que mandar una imagen en el campo "${CAMPO_IMAGEN}"`,
    );
  }

  res.ok(await carreraService.establecerImagen(req.params.id, req.file));
}

/** DELETE /api/carreras/:id/imagen */
export async function eliminarImagen(req, res) {
  res.ok(await carreraService.eliminarImagen(req.params.id));
}
