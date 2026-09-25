import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import {
  MAX_BYTES_POR_IMAGEN,
  MAX_IMAGENES_POR_REQUEST,
} from './upload.middleware.js';

/** Se monta despues de todas las rutas: cualquier URL que no matcheo cae aca. */
export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

/**
 * Manejador de errores centralizado. Express 5 propaga solo los rejects de los
 * handlers `async`, asi que no hace falta envolverlos en un `asyncHandler`.
 */
// eslint-disable-next-line no-unused-vars -- Express identifica el handler por sus 4 params
export function errorHandler(error, _req, res, _next) {
  let statusCode = 500;
  let message = 'Error interno del servidor';
  let details = null;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Datos de entrada invalidos';
    details = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    ({ statusCode, message, details } = mapPrismaError(error));
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Consulta invalida a la base de datos';
  } else if (error instanceof MulterError) {
    ({ statusCode, message, details } = mapMulterError(error));
  } else if (error.type === 'entity.parse.failed') {
    // Body con JSON mal formado (lo lanza express.json()).
    statusCode = 400;
    message = 'El body no es un JSON valido';
  }

  // Los 5xx son bugs nuestros: se loguean completos aunque no se muestren.
  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { details }),
    ...(env.isDev && { stack: error.stack }),
  });
}

/**
 * Traduce los errores de multer (subida de archivos) a respuestas utiles.
 * Sin esto, un archivo demasiado grande sale como 500 generico y el front no
 * tiene forma de decirle al usuario que achique la foto.
 */
function mapMulterError(error) {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return {
        statusCode: 413,
        message: `Cada imagen puede pesar hasta ${MAX_BYTES_POR_IMAGEN / 1024 / 1024} MB`,
        details: { campo: error.field ?? null },
      };
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_PART_COUNT':
      return {
        statusCode: 400,
        message: `Se pueden subir hasta ${MAX_IMAGENES_POR_REQUEST} imagenes por vez`,
        details: null,
      };
    case 'LIMIT_UNEXPECTED_FILE':
      // Fallback. Normalmente no se llega aca: upload.middleware.js atrapa este
      // caso antes y arma el mensaje con el campo que espera ESA ruta. Aca no
      // se sabe cual era, y hardcodear uno le mentiria a la otra ruta.
      return {
        statusCode: 400,
        message: 'El archivo vino en un campo del formulario que la ruta no espera',
        details: { campoRecibido: error.field ?? null },
      };
    default:
      return {
        statusCode: 400,
        message: 'No se pudo procesar el archivo subido',
        details: env.isDev ? { code: error.code } : null,
      };
  }
}

/** Traduce los codigos de error de Prisma a respuestas HTTP con sentido. */
function mapPrismaError(error) {
  const target = error.meta?.target;
  const campos = Array.isArray(target) ? target.join(', ') : target;

  switch (error.code) {
    case 'P2002':
      return {
        statusCode: 409,
        message: `Ya existe un registro con ese valor${campos ? ` en: ${campos}` : ''}`,
        details: null,
      };
    case 'P2003':
      return {
        statusCode: 409,
        message: 'La operacion viola una relacion con otro registro',
        details: null,
      };
    case 'P2025':
      return {
        statusCode: 404,
        message: 'El registro solicitado no existe',
        details: null,
      };
    default:
      return {
        statusCode: 500,
        message: 'Error de base de datos',
        details: env.isDev ? { code: error.code } : null,
      };
  }
}
