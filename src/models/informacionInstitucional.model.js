import { z } from 'zod';

/**
 * Campos de una Autoridad, tal como viajan anidados dentro de la
 * Informacion Institucional (POST, GET, PUT devuelven siempre la lista
 * completa junto con el resto de la informacion).
 */
export const autoridadSelect = {
  id: true,
  nombre: true,
  cargo: true,
  imagen: true,
  orden: true,
  descripcion: true,
};

/**
 * Campos que la API expone de la Informacion Institucional de una sede,
 * con sus autoridades ordenadas por el campo `orden` (y por nombre a
 * igualdad de orden, para que el listado no "parpadee" entre requests).
 */
export const informacionInstitucionalSelect = {
  id: true,
  sedeId: true,
  nombre: true,
  lema: true,
  historia: true,
  mision: true,
  vision: true,
  createdAt: true,
  updatedAt: true,
  autoridades: {
    select: autoridadSelect,
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  },
};

/** Texto obligatorio, normalizado (ver sede.model.js). */
const textoRequerido = (max) => z.string().trim().min(1).max(max);

/** Texto opcional: mismo trim, pero puede faltar. */
const textoOpcional = (max) => z.string().trim().min(1).max(max).optional();

/**
 * Body de una Autoridad dentro del POST/PUT. `orden` es opcional porque no
 * todas las sedes van a querer ordenarlas a mano; por defecto se listan en
 * el orden en que se cargan (ver default en Prisma).
 */
const autoridadSchema = z.strictObject({
  nombre: textoRequerido(120),
  cargo: textoRequerido(120),
  imagen: z.url().max(500).optional(),
  orden: z.coerce.number().int().min(0).optional(),
  descripcion: textoOpcional(500),
});

/**
 * Body del POST /sedes/:sedeId/informacion-institucional.
 *
 * `autoridades` es opcional: una sede puede cargar su informacion antes de
 * tener autoridades definidas. Si viene, se reemplaza la lista completa
 * (ver el comentario en el service sobre por que no hay PATCH parcial de
 * autoridades individuales).
 */
export const crearInformacionInstitucionalSchema = z.strictObject({
  nombre: textoRequerido(150),
  lema: textoOpcional(200),
  historia: textoOpcional(5000),
  mision: textoOpcional(2000),
  vision: textoOpcional(2000),
  autoridades: z.array(autoridadSchema).optional(),
});

/**
 * Body del PUT /sedes/:sedeId/informacion-institucional.
 *
 * A diferencia del PATCH de Sede, este es un PUT: reemplaza todo el recurso,
 * asi que "nombre" sigue siendo requerido (no se usa `.partial()` aca) y
 * `autoridades`, si viene, reemplaza la lista entera en vez de mergear.
 */
export const actualizarInformacionInstitucionalSchema =
  crearInformacionInstitucionalSchema;

/** Valida el :sedeId de la URL. */
export const sedeIdParamSchema = z.object({
  sedeId: z.cuid(),
});
