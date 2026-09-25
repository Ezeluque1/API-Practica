/**
 * Error de aplicacion con codigo HTTP. Cualquier error lanzado con esta clase
 * es tratado como "esperado" por el errorHandler y se devuelve tal cual al
 * cliente; el resto se responde como 500 generico.
 */
export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Solicitud invalida', details = null) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'No autenticado', details = null) {
    return new ApiError(401, message, details);
  }

  static forbidden(message = 'No autorizado', details = null) {
    return new ApiError(403, message, details);
  }

  static notFound(message = 'Recurso no encontrado', details = null) {
    return new ApiError(404, message, details);
  }

  static conflict(message = 'El recurso ya existe', details = null) {
    return new ApiError(409, message, details);
  }

  static internal(message = 'Error interno del servidor', details = null) {
    return new ApiError(500, message, details);
  }
}

export default ApiError;
