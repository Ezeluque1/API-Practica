import * as sedeService from '../services/sede.service.js';

// Sin try/catch: Express 5 propaga solo los rejects de los handlers async al
// errorHandler centralizado.

/**
 * GET /api/sedes
 *
 * Se lee `req.validated.query`, NO `req.query`: en Express 5 `req.query` es un
 * getter de solo lectura, asi que validate() deja ahi el resultado parseado.
 * Leyendo req.query llegaria el string "true" sin transformar y sin el default.
 */
export async function listar(req, res) {
  res.ok(await sedeService.listar(req.validated.query));
}

/** POST /api/sedes */
export async function crear(req, res) {
  // req.body ya viene validado y normalizado por validate({ body: ... }).
  const sede = await sedeService.crear(req.body);
  res.created(sede, `/api/sedes/${sede.id}`);
}

/** GET /api/sedes/:id */
export async function obtenerPorId(req, res) {
  res.ok(await sedeService.obtenerPorId(req.params.id, req.validated.query));
}

/** PATCH /api/sedes/:id */
export async function actualizar(req, res) {
  res.ok(await sedeService.actualizar(req.params.id, req.body));
}

/** DELETE /api/sedes/:id - baja logica */
export async function eliminar(req, res) {
  await sedeService.darDeBaja(req.params.id);
  res.noContent();
}

/** POST /api/sedes/:id/reactivar */
export async function reactivar(req, res) {
  res.ok(await sedeService.reactivar(req.params.id));
}
