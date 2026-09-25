import { Router } from 'express';

import * as controller from '../controllers/informacionInstitucional.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate, authenticateOptional, authorize } from '../middlewares/auth.middleware.js';
import {
  crearInformacionInstitucionalSchema,
  actualizarInformacionInstitucionalSchema,
  sedeIdParamSchema,
} from '../models/informacionInstitucional.model.js';

const router = Router();

/**
 * Se registra en index.js bajo el mismo prefijo '/sedes' que sede.routes.js:
 * las rutas no chocan porque esta siempre exige el segmento
 * '/informacion-institucional' despues del :sedeId.
 *
 * El GET es publico, igual que el resto de las rutas de lectura de Sede.
 */
router.get(
  '/:sedeId/informacion-institucional',
  authenticateOptional,
  validate({ params: sedeIdParamSchema }),
  controller.obtener,
);

// De aca para abajo, solo ADMIN (mismo criterio que POST/PATCH de Sede).

router.post(
  '/:sedeId/informacion-institucional',
  authenticate,
  authorize('ADMIN'),
  validate({
    params: sedeIdParamSchema,
    body: crearInformacionInstitucionalSchema,
  }),
  controller.crear,
);

router.put(
  '/:sedeId/informacion-institucional',
  authenticate,
  authorize('ADMIN'),
  validate({
    params: sedeIdParamSchema,
    body: actualizarInformacionInstitucionalSchema,
  }),
  controller.actualizar,
);

export default router;
