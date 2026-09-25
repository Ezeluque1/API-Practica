import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';

/** Firma un JWT con el payload dado (no incluir datos sensibles). */
export function signToken(payload, options = {}) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    ...options,
  });
}

/** Verifica un JWT y devuelve su payload. Lanza ApiError 401 si no es valido. */
export function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('El token expiro');
    }
    throw ApiError.unauthorized('Token invalido');
  }
}
