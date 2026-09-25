import * as informacionInstitucionalService from '../services/informacionInstitucional.service.js';

// Sin try/catch: Express 5 propaga solo los rejects de los handlers async al
// errorHandler centralizado.

/** POST /api/sedes/:sedeId/informacion-institucional */
export async function crear(req, res) {
  const { sedeId } = req.validated.params;
  const informacion = await informacionInstitucionalService.crear(
    sedeId,
    req.body,
  );
  res.created(
    informacion,
    `/api/sedes/${sedeId}/informacion-institucional`,
  );
}

/** GET /api/sedes/:sedeId/informacion-institucional */
export async function obtener(req, res) {
  const { sedeId } = req.validated.params;
  res.ok(await informacionInstitucionalService.obtenerPorSedeId(sedeId));
}

/** PUT /api/sedes/:sedeId/informacion-institucional */
export async function actualizar(req, res) {
  const { sedeId } = req.validated.params;
  res.ok(
    await informacionInstitucionalService.actualizar(sedeId, req.body),
  );
}
