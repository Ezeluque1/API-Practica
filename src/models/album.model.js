import { z } from 'zod';

/**
 * Campos que la API expone de una Imagen.
 * `publicId` queda afuera a proposito: es el identificador interno de
 * Cloudinary y el front no lo necesita, borrar es cosa de la API.
 */
export const imagenSelect = {
  id: true,
  url: true,
  width: true,
  height: true,
  formato: true,
  bytes: true,
  createdAt: true,
};

/** Autor, sin datos sensibles. Mismo recorte que usa publicacion.model.js. */
const autorSelect = {
  select: {
    id: true,
    nombre: true,
    apellido: true,
  },
};

/**
 * Campos del listado: cada album viene con su portada y el total de fotos,
 * pero NO con el array completo. Listar 30 albums de 40 fotos con todo adentro
 * son 1200 objetos que nadie va a mostrar en una grilla de tarjetas.
 */
export const albumSelect = {
  id: true,
  titulo: true,
  slug: true,
  descripcion: true,
  fecha: true,
  activo: true,
  portadaId: true,
  portada: { select: imagenSelect },
  autorId: true,
  autor: autorSelect,
  createdAt: true,
  updatedAt: true,
  _count: { select: { imagenes: true } },
};

/**
 * Campos del detalle: lo mismo mas todas las imagenes, en el orden en que se
 * subieron.
 */
export const albumDetalleSelect = {
  ...albumSelect,
  imagenes: {
    select: imagenSelect,
    orderBy: { createdAt: 'asc' },
  },
};

/**
 * Aplana el `_count` de Prisma a un campo plano.
 * Sin esto la respuesta trae `_count: { imagenes: 3 }`, que obliga al front a
 * conocer un detalle de como consultamos la base.
 *
 * @template {{ _count?: { imagenes: number } }} T
 * @param {T} album
 */
export function formatearAlbum(album) {
  if (!album) return album;
  const { _count, ...resto } = album;
  return { ...resto, cantidadImagenes: _count?.imagenes ?? 0 };
}

/**
 * Helper para textos obligatorios: trim antes de min(1) para rechazar
 * solo-espacios y normalizar lo que entra a la base.
 */
const textoRequerido = (max) => z.string().trim().min(1).max(max);

/** Body del POST /albums. Solo metadatos; las fotos van por su propio endpoint. */
export const crearAlbumSchema = z.strictObject({
  titulo: textoRequerido(200),
  descripcion: z.string().trim().min(1).max(2000).optional(),
  /** Fecha del acto/evento que retrata el album, no la de carga. */
  fecha: z.string().datetime({ offset: true }).optional(),
});

/**
 * Body del PATCH /albums/:id. Actualizacion parcial.
 *
 * Contrato, igual que en publicaciones:
 *   - omitir un campo  -> queda como estaba
 *   - mandarlo en null -> se borra (solo los opcionales)
 *   - mandarlo en ""   -> 400, para borrar se usa null
 *
 * El slug NO se puede modificar y tampoco cambia solo al cambiar el titulo:
 * si cambiara, se romperian las URLs ya publicadas.
 */
export const actualizarAlbumSchema = z
  .strictObject({
    titulo: textoRequerido(200),
    descripcion: z.string().trim().min(1).max(2000).nullable(),
    fecha: z.string().datetime({ offset: true }).nullable(),
  })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Hay que enviar al menos un campo para modificar',
  });

/** Body del PATCH /albums/:id/portada. */
export const portadaSchema = z.strictObject({
  imagenId: z.cuid(),
});

/** Valida el :id de la URL. */
export const albumIdParamSchema = z.strictObject({
  id: z.cuid(),
});

/** Valida :id y :imagenId de DELETE /albums/:id/imagenes/:imagenId. */
export const albumImagenParamsSchema = z.strictObject({
  id: z.cuid(),
  imagenId: z.cuid(),
});

/**
 * Se valida como enum de strings y NO con coerce.boolean(): Boolean("false")
 * es true, y cualquier otro valor pasaria en silencio en vez de dar 400.
 * Mismo patron que sede.model.js y publicacion.model.js.
 */
const incluirInactivos = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

/**
 * Query del GET /albums.
 *
 * Va separado del schema del detalle aunque hoy tengan el mismo campo: si
 * fuera uno solo compartido, cualquier filtro que se agregue al listado
 * pasaria a ser aceptado y despues ignorado en silencio por el detalle, que es
 * justo lo que evita `strictObject`.
 */
export const albumsListadoQuerySchema = z.strictObject({ incluirInactivos });

/** Query del GET /albums/:id. */
export const albumDetalleQuerySchema = z.strictObject({ incluirInactivos });
