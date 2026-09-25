import { Router } from 'express';

import * as controller from '../controllers/contacto.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import {
  crearMensajeContactoSchema,
  actualizarMensajeContactoSchema,
  mensajeContactoIdParamSchema,
  mensajesContactoListadoQuerySchema,
} from '../models/contacto.model.js';

const router = Router();

// Publico: es el formulario de contacto, sin autenticacion.
router.post(
  '/',
  validate({ body: crearMensajeContactoSchema }),
  controller.crear,
);

// De aca para abajo, solo ADMIN.

router.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate({ query: mensajesContactoListadoQuerySchema }),
  controller.listar,
);

router.get(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: mensajeContactoIdParamSchema }),
  controller.obtenerPorId,
);

router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate({
    params: mensajeContactoIdParamSchema,
    body: actualizarMensajeContactoSchema,
  }),
  controller.actualizar,
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: mensajeContactoIdParamSchema }),
  controller.eliminar,
);

export default router;
