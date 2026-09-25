import { ApiError } from '../utils/ApiError.js';

/**
 * Valida la request contra schemas de Zod antes de llegar al controller.
 *
 *   router.post('/', validate({ body: crearAlumnoSchema }), controller.crear);
 *
 * El resultado parseado queda en `req.validated.{body,params,query}`.
 * En Express 5 `req.query` es un getter de solo lectura, por eso no se
 * sobrescribe la request original.
 *
 * @param {{ body?: import('zod').ZodType, params?: import('zod').ZodType, query?: import('zod').ZodType }} schemas
 */
export function validate(schemas = {}) {
  return (req, _res, next) => {
    const validated = {};
    const errors = [];

    for (const source of ['body', 'params', 'query']) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);

      if (result.success) {
        validated[source] = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({
            source,
            field: issue.path.join('.') || source,
            message: issue.message,
          });
        }
      }
    }

    if (errors.length > 0) {
      return next(ApiError.badRequest('Datos de entrada invalidos', errors));
    }

    req.validated = validated;
    // El body si se puede sobrescribir, y asi el controller usa el dato parseado
    // (con sus defaults y coerciones) sin tener que acordarse de `req.validated`.
    if (validated.body) req.body = validated.body;

    next();
  };
}

export default validate;
