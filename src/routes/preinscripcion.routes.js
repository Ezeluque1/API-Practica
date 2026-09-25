import { Router } from 'express';

import * as controller from '../controllers/preinscripcion.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import {
  crearPreinscripcionSchema,
  preinscripcionesListadoQuerySchema,
} from '../models/preinscripcion.model.js';

const router = Router();

/**
 * Publico y sin token: es el formulario de la web y el aspirante todavia no es
 * alumno, no tiene cuenta. Es el unico endpoint de escritura publica de la
 * API, asi que el schema de Zod es la unica barrera entre el formulario y la
 * base.
 */
router.post(
  '/',
  validate({ body: crearPreinscripcionSchema }),
  controller.crear,
);

/**
 * Solo ADMIN: cada fila tiene documento, fecha de nacimiento, domicilio y
 * telefono de una persona que ni siquiera es alumno todavia. Dejarlo publico
 * expondria esos datos a cualquiera que supiera la URL.
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate({ query: preinscripcionesListadoQuerySchema }),
  controller.listar,
);

export default router;
