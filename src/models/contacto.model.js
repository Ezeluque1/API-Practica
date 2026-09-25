import { z } from 'zod';

/**
 * Campos que la API expone de un MensajeContacto.
 * No hay updatedAt en el modelo (solo createdAt): respondidoAt cumple ese rol
 * para lo que importa de cara al admin, que es saber cuando se respondio.
 */
export const contactoPublicSelect = {
  id: true,
  nombre: true,
  email: true,
  telefono: true,
  asunto: true,
  mensaje: true,
  estado: true,
  respuesta: true,
  respondidoAt: true,
  createdAt: true,
};

/**
 * Texto obligatorio. El `.trim()` va antes del `.min(1)` a proposito: asi un
 * valor de solo espacios se rechaza en vez de guardarse como string vacio.
 */
const textoRequerido = (max) => z.string().trim().min(1).max(max);

/** Texto opcional con trim y rechazo de string vacio. */
const textoOpcional = (max) => z.string().trim().min(1).max(max);

/**
 * Body del POST /contacto. Es el formulario publico, sin autenticacion:
 * por eso no hay campo `estado` aca, siempre nace en NO_LEIDO.
 */
export const crearMensajeContactoSchema = z.strictObject({
  nombre: textoRequerido(120),
  email: z.email().max(120),
  telefono: textoOpcional(30).optional(),
  asunto: textoOpcional(150).optional(),
  mensaje: textoRequerido(2000),
});

/**
 * Body del PATCH /contacto/:id. Solo un ADMIN llega aca, para marcar el
 * mensaje como leido o para responderlo.
 *
 * `estado` se puede setear a mano (por ejemplo, LEIDO sin responder todavia).
 * Si llega `respuesta`, el service se encarga de fijar `respondidoAt` y forzar
 * `estado: RESPONDIDO` automaticamente, asi que aca no hace falta mandar los
 * dos juntos.
 */
export const actualizarMensajeContactoSchema = z
  .strictObject({
    estado: z.enum(['NO_LEIDO', 'LEIDO', 'RESPONDIDO']),
    respuesta: textoRequerido(2000),
  })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Hay que enviar al menos un campo para modificar',
  });

/**
 * Valida el :id de la URL. Los ids del schema son cuid, asi que un id mal
 * formado se corta con un 400 y nunca llega a consultar la base.
 */
export const mensajeContactoIdParamSchema = z.object({
  id: z.cuid(),
});

/** Query string del GET /contacto. Filtro opcional por estado. */
export const mensajesContactoListadoQuerySchema = z.strictObject({
  estado: z.enum(['NO_LEIDO', 'LEIDO', 'RESPONDIDO']).optional(),
});
