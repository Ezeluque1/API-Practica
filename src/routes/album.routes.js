import { Router } from 'express';

import * as controller from '../controllers/album.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { recibirImagenes } from '../middlewares/upload.middleware.js';
import {
  authenticate,
  authenticateOptional,
  authorize,
} from '../middlewares/auth.middleware.js';
import { ApiError } from '../utils/ApiError.js';
import {
  actualizarAlbumSchema,
  albumDetalleQuerySchema,
  albumIdParamSchema,
  albumImagenParamsSchema,
  albumsListadoQuerySchema,
  crearAlbumSchema,
  portadaSchema,
} from '../models/album.model.js';

const router = Router();

/**
 * Los GET son publicos, pero ver los albums dados de baja no: sin esto,
 * esconderlos del listado no serviria de nada porque cualquiera los veria
 * agregando el query param.
 *
 * Va despues del validate() porque necesita `incluirInactivos` ya parseado a
 * booleano, y lee `req.validated.query` porque en Express 5 `req.query` es un
 * getter de solo lectura. Mismo guard que en sede.routes.js.
 */
function soloAdminVeInactivos(req, _res, next) {
  if (!req.validated.query.incluirInactivos) return next();

  // Se distinguen los dos casos a proposito. Con un mensaje unico, alguien que
  // manda el request sin token lee "no sos ADMIN" y se pone a revisar su rol,
  // cuando el problema es que el token no viajo.
  if (!req.user) {
    return next(
      ApiError.forbidden(
        'Para ver los albums dados de baja hay que mandar el token: ' +
          'Authorization: Bearer <token>. No llego ningun header de autenticacion.',
      ),
    );
  }

  if (req.user.rol !== 'ADMIN') {
    return next(
      ApiError.forbidden(
        `Solo un ADMIN puede ver los albums dados de baja (tu rol es ${req.user.rol})`,
      ),
    );
  }

  next();
}

router.get(
  '/',
  authenticateOptional,
  validate({ query: albumsListadoQuerySchema }),
  soloAdminVeInactivos,
  controller.listar,
);

router.get(
  '/:id',
  authenticateOptional,
  validate({ params: albumIdParamSchema, query: albumDetalleQuerySchema }),
  soloAdminVeInactivos,
  controller.obtenerPorId,
);

// De aca para abajo, solo ADMIN.

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate({ body: crearAlbumSchema }),
  controller.crear,
);

router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: albumIdParamSchema, body: actualizarAlbumSchema }),
  controller.actualizar,
);

// Baja logica: la fila queda en la base con activo=false y las fotos siguen
// en Cloudinary. Es tambien el switch de visibilidad publica.
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: albumIdParamSchema }),
  controller.eliminar,
);

router.post(
  '/:id/reactivar',
  authenticate,
  authorize('ADMIN'),
  validate({ params: albumIdParamSchema }),
  controller.reactivar,
);

/**
 * Subida de fotos (multipart/form-data).
 *
 * El orden importa: authenticate y authorize van ANTES que multer para que un
 * request sin token no llegue a bufferear 25 MB en memoria antes de que lo
 * rechacemos. El validate de params va antes tambien, es solo la URL.
 */
router.post(
  '/:id/imagenes',
  authenticate,
  authorize('ADMIN'),
  validate({ params: albumIdParamSchema }),
  recibirImagenes,
  controller.agregarImagenes,
);

// Unico borrado fisico del modulo: saca la fila y el archivo de Cloudinary.
router.delete(
  '/:id/imagenes/:imagenId',
  authenticate,
  authorize('ADMIN'),
  validate({ params: albumImagenParamsSchema }),
  controller.eliminarImagen,
);

router.patch(
  '/:id/portada',
  authenticate,
  authorize('ADMIN'),
  validate({ params: albumIdParamSchema, body: portadaSchema }),
  controller.elegirPortada,
);

export default router;
