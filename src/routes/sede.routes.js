import { Router } from 'express';

import * as controller from '../controllers/sede.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  authenticate,
  authenticateOptional,
  authorize,
} from '../middlewares/auth.middleware.js';
import { ApiError } from '../utils/ApiError.js';
import {
  crearSedeSchema,
  actualizarSedeSchema,
  sedeIdParamSchema,
  sedesListadoQuerySchema,
  sedeDetalleQuerySchema,
} from '../models/sede.model.js';

const router = Router();

/**
 * Los GET son publicos, pero ver las sedes dadas de baja no: sin esto,
 * esconderlas del listado no serviria de nada porque cualquiera las veria
 * agregando el query param.
 *
 * Va despues del validate() porque necesita `incluirInactivas` ya parseado a
 * booleano, y lee `req.validated.query` porque en Express 5 `req.query` es un
 * getter de solo lectura.
 */
function soloAdminVeInactivas(req, _res, next) {
  if (req.validated.query.incluirInactivas && req.user?.rol !== 'ADMIN') {
    return next(
      ApiError.forbidden('Solo un ADMIN puede ver las sedes dadas de baja'),
    );
  }
  next();
}

router.get(
  '/',
  authenticateOptional,
  validate({ query: sedesListadoQuerySchema }),
  soloAdminVeInactivas,
  controller.listar,
);

router.get(
  '/:id',
  authenticateOptional,
  validate({ params: sedeIdParamSchema, query: sedeDetalleQuerySchema }),
  soloAdminVeInactivas,
  controller.obtenerPorId,
);

// De aca para abajo, solo ADMIN.

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate({ body: crearSedeSchema }),
  controller.crear,
);

router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: sedeIdParamSchema, body: actualizarSedeSchema }),
  controller.actualizar,
);

// Baja logica: la fila queda en la base con activa=false.
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: sedeIdParamSchema }),
  controller.eliminar,
);

router.post(
  '/:id/reactivar',
  authenticate,
  authorize('ADMIN'),
  validate({ params: sedeIdParamSchema }),
  controller.reactivar,
);

export default router;
