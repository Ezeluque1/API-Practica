import * as publicacionService from '../services/publicacion.service.js';

// Sin try/catch: Express 5 propaga solo los rejects de los handlers async al
// errorHandler centralizado.

/**
 * GET /api/publicaciones
 * Lee req.validated.query (Express 5: req.query es solo lectura).
 */
export async function listar(req, res) {
  res.ok(await publicacionService.listar(req.validated.query));
}

/** GET /api/publicaciones/:id */
export async function obtenerPorId(req, res) {
  res.ok(await publicacionService.obtenerPorId(req.params.id));
}

/** POST /api/publicaciones - solo ADMIN */
export async function crear(req, res) {
  // autorId sale del usuario autenticado, nunca del body
  const publicacion = await publicacionService.crear(req.body, req.user.id);
  res.created(publicacion, `/api/publicaciones/${publicacion.id}`);
}

/** PATCH /api/publicaciones/:id - solo ADMIN */
export async function actualizar(req, res) {
  res.ok(await publicacionService.actualizar(req.params.id, req.body));
}

/** DELETE /api/publicaciones/:id - solo ADMIN, eliminacion fisica */
export async function eliminar(req, res) {
  await publicacionService.eliminar(req.params.id);
  res.noContent();
}
