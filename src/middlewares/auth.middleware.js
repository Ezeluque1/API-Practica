import { prisma } from '../config/prisma.js';
import { verifyToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Valida el token del header y deja el usuario en `req.user`.
 *
 * Devuelve el ApiError que corresponda en vez de lanzarlo, para que los dos
 * middlewares de abajo decidan que hacer con el.
 *
 * @returns {Promise<ApiError|null>} null si salio todo bien.
 */
async function cargarUsuarioDesdeToken(req) {
  const header = req.headers.authorization ?? '';

  if (!header.startsWith('Bearer ')) {
    return ApiError.unauthorized('Falta el header Authorization Bearer');
  }

  const token = header.slice(7).trim();
  if (!token) {
    return ApiError.unauthorized('Token vacio');
  }

  const payload = verifyToken(token);

  // Se relee de la DB para que un usuario dado de baja o con el rol cambiado
  // no siga operando con un token viejo todavia vigente.
  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      rol: true,
      activo: true,
    },
  });

  if (!usuario) {
    return ApiError.unauthorized('El usuario del token ya no existe');
  }

  // `activo` es un soft delete: la fila sigue existiendo pero el usuario
  // no debe poder operar.
  if (!usuario.activo) {
    return ApiError.unauthorized('La cuenta esta desactivada');
  }

  req.user = usuario;
  return null;
}

/**
 * Exige un JWT valido en `Authorization: Bearer <token>`.
 * Deja el usuario (sin passwordHash) en `req.user`.
 */
export async function authenticate(req, _res, next) {
  const error = await cargarUsuarioDesdeToken(req);
  if (error) return next(error);
  next();
}

/**
 * Igual que `authenticate`, pero **sin** header no falla: deja pasar con
 * `req.user` en undefined.
 *
 * Es para rutas publicas que se comportan distinto si quien consulta esta
 * logueado. Ojo con la diferencia: "sin token" pasa, pero un token **invalido
 * o de una cuenta desactivada sigue dando 401**. Ignorarlo en silencio dejaria
 * a alguien que cree estar logueado recibiendo un 403 inexplicable.
 */
export async function authenticateOptional(req, _res, next) {
  const header = req.headers.authorization ?? '';

  if (!header) {
    return next();
  }

  const error = await cargarUsuarioDesdeToken(req);
  if (error) return next(error);
  next();
}

/**
 * Restringe una ruta a ciertos roles. Usar siempre despues de `authenticate`.
 *
 *   router.delete('/:id', authenticate, authorize('ADMIN'), controller.eliminar);
 */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('No autenticado'));
    }
    if (roles.length > 0 && !roles.includes(req.user.rol)) {
      return next(ApiError.forbidden('No tenes permisos para esta accion'));
    }
    next();
  };
}
