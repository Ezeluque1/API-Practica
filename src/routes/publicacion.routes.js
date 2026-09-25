import { Router } from 'express';

import * as controller from '../controllers/publicacion.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import {
  crearPublicacionSchema,
  actualizarPublicacionSchema,
  publicacionIdParamSchema,
  publicacionesListadoQuerySchema,
} from '../models/publicacion.model.js';

const router = Router();

// Publicos
router.get(
  '/',
  validate({ query: publicacionesListadoQuerySchema }),
  controller.listar,
);

router.get(
  '/:id',
  validate({ params: publicacionIdParamSchema }),
  controller.obtenerPorId,
);

// Solo ADMIN
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate({ body: crearPublicacionSchema }),
  controller.crear,
);

router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: publicacionIdParamSchema, body: actualizarPublicacionSchema }),
  controller.actualizar,
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: publicacionIdParamSchema }),
  controller.eliminar,
);

export default router;
