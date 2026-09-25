import * as contactoService from '../services/contacto.service.js';

// Sin try/catch: Express 5 propaga solo los rejects de los handlers async al
// errorHandler centralizado.

/** POST /api/contacto - publico, formulario de contacto */
export async function crear(req, res) {
  const mensaje = await contactoService.crear(req.body);
  res.created(mensaje, `/api/contacto/${mensaje.id}`);
}

/**
 * GET /api/contacto - solo ADMIN
 * Lee req.validated.query (Express 5: req.query es solo lectura).
 */
export async function listar(req, res) {
  res.ok(await contactoService.listar(req.validated.query));
}

/** GET /api/contacto/:id - solo ADMIN */
export async function obtenerPorId(req, res) {
  res.ok(await contactoService.obtenerPorId(req.params.id));
}

/** PATCH /api/contacto/:id - solo ADMIN */
export async function actualizar(req, res) {
  res.ok(await contactoService.actualizar(req.params.id, req.body));
}

/** DELETE /api/contacto/:id - solo ADMIN, eliminacion fisica */
export async function eliminar(req, res) {
  await contactoService.eliminar(req.params.id);
  res.noContent();
}
