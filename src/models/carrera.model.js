import { z } from 'zod';

export const carreraPublicSelect = {
  id: true,
  nombre: true,
  slug: true,
  descripcion: true,
  duracionAnios: true,
  tituloOtorgado: true,
  modalidad: true,
  activa: true,

  // Solo la URL. El imagenPublicId NO se expone: es el identificador interno
  // de Cloudinary, el front no lo necesita y borrar es cosa de la API.
  // Mismo criterio que imagenSelect en album.model.js.
  imagenUrl: true,

  createdAt: true,
  updatedAt: true,
};

export const carreraIdParamSchema = z.object({
  id: z.cuid(),
});

export const carrerasListadoQuerySchema = z.strictObject({
  buscar: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || undefined),

  modalidad: z
    .enum(['PRESENCIAL', 'VIRTUAL', 'HIBRIDA'])
    .optional(),

  sede: z
    .string()
    .cuid()
    .optional(),
});


// ============================================================
// ADMIN: crear / editar / dar de baja / eliminar
// ============================================================

/**
 * Texto obligatorio. El `.trim()` va antes del `.min(1)` a proposito: asi un
 * valor de solo espacios se rechaza en vez de guardarse como string vacio.
 * Mismo patron que sede.model.js.
 */
const textoRequerido = (max) => z.string().trim().min(1).max(max);

/** Body del POST /carreras. El slug se genera solo, a partir del nombre. */
export const crearCarreraSchema = z.strictObject({
  nombre: textoRequerido(150),
  descripcion: textoRequerido(2000).optional(),
  duracionAnios: z.number().int().min(1).max(15).optional(),
  tituloOtorgado: textoRequerido(150).optional(),
  modalidad: z.enum(['PRESENCIAL', 'VIRTUAL', 'HIBRIDA']),

  // IDs de las sedes donde se dicta. Opcional: se puede crear sin asignar
  // sedes todavia y vincularlas despues con un PATCH.
  sedes: z.array(z.cuid()).optional(),
});

/**
 * Body del PATCH /carreras/:id. Actualizacion parcial: se manda solo lo que
 * cambia. Mismo contrato que actualizarSedeSchema:
 *   - omitir un campo  -> queda como estaba
 *   - mandarlo en null -> se borra (solo los opcionales)
 *   - mandarlo en ""   -> 400, para borrar se usa null
 *
 * El slug NO se puede editar aca: se genera una sola vez al crear, para no
 * romper URLs que ya lo referencien.
 *
 * `sedes`, si viene, REEMPLAZA por completo el conjunto de sedes asignadas
 * (no se agrega/quita una por una).
 */
export const actualizarCarreraSchema = z
  .strictObject({
    nombre: textoRequerido(150),
    descripcion: textoRequerido(2000).nullable(),
    duracionAnios: z.number().int().min(1).max(15).nullable(),
    tituloOtorgado: textoRequerido(150).nullable(),
    modalidad: z.enum(['PRESENCIAL', 'VIRTUAL', 'HIBRIDA']),
    sedes: z.array(z.cuid()),
  })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Hay que enviar al menos un campo para modificar',
  });