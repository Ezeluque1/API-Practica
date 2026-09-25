import { z } from 'zod';

/**
 * Campos que la API expone de una Publicacion.
 * Incluye el autor sin datos sensibles (sin passwordHash, tokens, etc.).
 */
export const publicacionSelect = {
  id: true,
  titulo: true,
  slug: true,
  resumen: true,
  contenido: true,
  tipo: true,
  imagenUrl: true,
  fechaEvento: true,
  destacada: true,
  autorId: true,
  createdAt: true,
  updatedAt: true,
  autor: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
    },
  },
};

/**
 * Helper para textos obligatorios: trim antes de min(1) para rechazar solo-espacios
 * y normalizar lo que entra a la base.
 */
const textoRequerido = (max) => z.string().trim().min(1).max(max);

/**
 * Texto opcional con trim y rechazo de string vacio.
 * Si viene string vacio despues de trim se corta con min(1); para borrar el valor
 * se debe mandar null (solo en PATCH).
 */
const textoOpcional = (max) => z.string().trim().min(1).max(max);

/** Body del POST /publicaciones. */
export const crearPublicacionSchema = z
  .strictObject({
    titulo: textoRequerido(200),
    resumen: textoOpcional(500).optional(),
    contenido: textoRequerido(10000),
    tipo: z.enum(['NOTICIA', 'EVENTO']),
    imagenUrl: z.string().trim().url().max(500).optional(),
    fechaEvento: z.string().datetime({ offset: true }).optional().nullable(),
    destacada: z.boolean().optional().default(false),
  })
  .superRefine((datos, ctx) => {
    // Regla fundamental: EVENTO requiere fechaEvento, NOTICIA debe quedar sin fecha.
    if (datos.tipo === 'EVENTO' && !datos.fechaEvento) {
      ctx.addIssue({
        code: 'custom',
        path: ['fechaEvento'],
        message: 'fechaEvento es obligatoria cuando tipo es EVENTO',
      });
    }
    if (datos.tipo === 'NOTICIA' && datos.fechaEvento) {
      ctx.addIssue({
        code: 'custom',
        path: ['fechaEvento'],
        message: 'fechaEvento debe ser null cuando tipo es NOTICIA',
      });
    }
  });

/**
 * Body del PATCH /publicaciones/:id. Actualizacion parcial: se manda solo lo que cambia.
 *
 * Contrato:
 *   - omitir un campo -> queda como estaba
 *   - mandarlo en null -> se borra (solo los opcionales que lo permiten)
 *   - mandarlo en "" -> 400, para borrar se usa null
 *
 * El slug, autorId y timestamps no se pueden modificar manualmente.
 * Al menos un campo es obligatorio.
 */
export const actualizarPublicacionSchema = z
  .strictObject({
    titulo: textoRequerido(200),
    resumen: textoOpcional(500).nullable(),
    contenido: textoRequerido(10000),
    tipo: z.enum(['NOTICIA', 'EVENTO']),
    imagenUrl: z.string().trim().url().max(500).nullable(),
    fechaEvento: z.string().datetime({ offset: true }).nullable(),
    destacada: z.boolean(),
  })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Hay que enviar al menos un campo para modificar',
  });

/** Valida el :id de la URL. */
export const publicacionIdParamSchema = z.object({
  id: z.string().cuid(),
});

/**
 * Query string del GET /publicaciones.
 *
 * Filtros combinables:
 *   - tipo: NOTICIA | EVENTO
 *   - buscar: coincidencia parcial case-insensitive en titulo, resumen y contenido
 *   - fechaDesde / fechaHasta: filtran por fechaEvento si tipo=EVENTO y por createdAt si tipo=NOTICIA.
 *     Cuando no se filtra por tipo, se aplica OR: (EVENTO y fechaEvento en rango) OR (NOTICIA y createdAt en rango)
 *   - destacada: true | false
 */
export const publicacionesListadoQuerySchema = z
  .strictObject({
    tipo: z.enum(['NOTICIA', 'EVENTO']).optional(),

    /**
     * Búsqueda parcial, case-insensitive en titulo, resumen y contenido.
     * Vacío o solo espacios equivale a no filtrar (el trim + transform a undefined).
     * Sensible a tildes igual que sedes: mode insensitive no ignora acentos.
     */
    buscar: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((v) => v || undefined),

    /** Fecha desde (ISO datetime). Se valida que no sea posterior a fechaHasta. */
    fechaDesde: z.string().datetime({ offset: true }).optional(),

    /** Fecha hasta (ISO datetime). Se valida que no sea anterior a fechaDesde. */
    fechaHasta: z.string().datetime({ offset: true }).optional(),

    /**
     * Se valida como enum de strings y NO con coerce.boolean(): Boolean("false") es true,
     * y cualquier otro valor daria 400 en vez de interpretarse en silencio.
     * Ver sede.model.js por el mismo patron.
     */
    destacada: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
  })
  .refine(
    (datos) => {
      if (datos.fechaDesde && datos.fechaHasta) {
        return new Date(datos.fechaDesde) <= new Date(datos.fechaHasta);
      }
      return true;
    },
    {
      message: 'fechaDesde no puede ser posterior a fechaHasta',
      path: ['fechaDesde'],
    },
  );
