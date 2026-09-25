import { z } from 'zod';

/**
 * Campos que la API expone de una Sede. Es lo que devuelven el POST y el
 * listado: sin carreras, porque una grilla de sedes no las necesita y traerlas
 * encarece bastante la consulta.
 */
export const sedePublicSelect = {
  id: true,
  nombre: true,
  ciudad: true,
  provincia: true,
  direccion: true,
  telefono: true,
  email: true,
  activa: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Resumen de una Carrera, para cuando viaja anidada dentro de otro recurso.
 *
 * Se dejan afuera `descripcion` y los timestamps a proposito: son para el
 * detalle de la carrera, no para una lista dentro de una sede.
 */
export const carreraResumenSelect = {
  id: true,
  nombre: true,
  slug: true,
  modalidad: true,
  duracionAnios: true,
  tituloOtorgado: true,
  activa: true,
};

/**
 * Sede con las carreras que se dictan en ella. Lo usa el GET /sedes/:id.
 *
 * OJO con la forma del resultado: `carreras` NO es un array de carreras, es un
 * array de filas de la tabla intermedia CarreraSede, o sea
 * `[{ carrera: {...} }, ...]`. Es deliberado, la relacion es N:M y se expone
 * tal cual la devuelve Prisma. Si lo aplanas aca, rompes el contrato que el
 * front ya tiene documentado en docs/openapi.yaml.
 *
 * Vienen tambien las carreras dadas de baja (`activa: false`); filtrarlas es
 * decision del front.
 */
export const sedeDetalleSelect = {
  ...sedePublicSelect,
  carreras: {
    select: { carrera: { select: carreraResumenSelect } },
    // Sin esto el orden lo decide Postgres y puede cambiar entre requests,
    // que en el front se ve como una lista que parpadea.
    orderBy: { carrera: { nombre: 'asc' } },
  },
};

/**
 * Texto obligatorio. El `.trim()` va antes del `.min(1)` a proposito: asi un
 * valor de solo espacios se rechaza en vez de guardarse como string vacio.
 *
 * Ademas normaliza lo que entra a la base, que importa por el unique de
 * (nombre, ciudad): sin esto, `"Sede Centro "` convivira con `"Sede Centro"`
 * esquivando el constraint.
 */
const textoRequerido = (max) => z.string().trim().min(1).max(max);

/** Body del POST /sedes. */
export const crearSedeSchema = z.strictObject({
  nombre: textoRequerido(120),
  ciudad: textoRequerido(80),
  provincia: textoRequerido(80),
  direccion: textoRequerido(200).optional(),
  telefono: textoRequerido(30).optional(),
  email: z.email().max(120).optional(),
});

/**
 * Se valida como enum de strings y NO con `z.coerce.boolean()`: `Boolean("false")`
 * es `true`, asi que con coerce un `?incluirInactivas=false` traeria justamente
 * las inactivas. Ademas, cualquier otro valor da 400 en vez de interpretarse
 * en silencio.
 *
 * Ver el guard `soloAdminVeInactivas` en sede.routes.js: pedir las inactivas
 * exige rol ADMIN.
 */
const incluirInactivas = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

/** Query string del GET /sedes/:id. */
export const sedeDetalleQuerySchema = z.strictObject({ incluirInactivas });

/**
 * Query string del GET /sedes.
 *
 * Va separado del schema del detalle a proposito: si `buscar` viviera en un
 * schema compartido, `GET /sedes/:id?buscar=x` lo aceptaria y lo ignoraria en
 * silencio, que es justo lo que el strictObject viene a evitar.
 */
export const sedesListadoQuerySchema = z.strictObject({
  incluirInactivas,

  /**
   * Termino de busqueda. Matchea contra ciudad O provincia, parcial y sin
   * distinguir mayusculas.
   *
   * Vacio o solo espacios equivale a no filtrar, no a un 400: un input de
   * busqueda atado al query string manda el parametro vacio apenas el usuario
   * borra el texto. El `.trim()` antes del transform es lo que hace que
   * `"   "` termine en undefined en vez de buscar espacios.
   *
   * OJO: `mode: 'insensitive'` resuelve mayusculas pero NO tildes, asi que
   * "Cordoba" no encuentra "Cordoba" con acento.
   */
  buscar: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || undefined),
});

/**
 * Body del PATCH /sedes/:id. Actualizacion parcial: se manda solo lo que cambia.
 *
 * Contrato de los tres casos que se confunden siempre:
 *   - omitir un campo  -> queda como estaba
 *   - mandarlo en null -> se borra (solo los opcionales)
 *   - mandarlo en ""   -> 400, para borrar se usa null
 *
 * El `.nullable()` va solo en los tres opcionales: nombre, ciudad y provincia
 * son NOT NULL en la base, asi que mandarles null tiene que frenar aca y no
 * llegar a Prisma.
 *
 * El `.partial()` conserva el modo estricto (un campo desconocido sigue dando
 * 400) pero acepta `{}`, de ahi el refine: sin el, un PATCH vacio devolveria
 * un 200 sin haber cambiado nada, que es mentirle al front.
 */
export const actualizarSedeSchema = z
  .strictObject({
    nombre: textoRequerido(120),
    ciudad: textoRequerido(80),
    provincia: textoRequerido(80),
    direccion: textoRequerido(200).nullable(),
    telefono: textoRequerido(30).nullable(),
    email: z.email().max(120).nullable(),
  })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Hay que enviar al menos un campo para modificar',
  });

/**
 * Valida el :id de la URL. Los ids del schema son cuid, asi que un id mal
 * formado se corta con un 400 y nunca llega a consultar la base.
 */
export const sedeIdParamSchema = z.object({
  id: z.cuid(),
});
