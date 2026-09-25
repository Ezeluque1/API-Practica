import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { sedePublicSelect, sedeDetalleSelect } from '../models/sede.model.js';

/**
 * Arma el 409 del unique (nombre, ciudad) explicando con QUE choco.
 *
 * Hace falta porque con baja logica una sede dada de baja sigue ocupando su
 * lugar en el indice unico: sin esto el usuario veria "ya existe" de una sede
 * que no aparece en ninguna lista, sin forma de entender el error ni de
 * resolverlo.
 *
 * La consulta extra corre solo en el camino de error, asi que el caso feliz
 * sigue siendo una sola query.
 */
export const conflictoDeNombre = async (nombre, ciudad) => {
  const existente = await prisma.sede.findUnique({
    where: { nombre_ciudad: { nombre, ciudad } },
    select: { id: true, activa: true },
  });

  if (existente && !existente.activa) {
    return ApiError.conflict(
      'Existe una sede dada de baja con ese nombre en esa ciudad. Reactivala en vez de crear una nueva.',
      { sedeId: existente.id },
    );
  }

  return ApiError.conflict('Ya existe una sede con ese nombre en esa ciudad.');
}

/**
 * Crea una sede.
 *
 * No chequea el duplicado con un findFirst previo: seria una condicion de
 * carrera. Se deja fallar el insert y recien ahi se averigua contra que choco.
 *
 * @param {{ nombre: string, ciudad: string, provincia: string,
 *           direccion?: string, telefono?: string, email?: string }} datos
 * @throws {ApiError} 409 si ya existe una sede con ese nombre en esa ciudad.
 */
export async function crear(datos) {
  try {
    return await prisma.sede.create({
      data: datos,
      select: sedePublicSelect,
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw await conflictoDeNombre(datos.nombre, datos.ciudad);
    }
    throw error;
  }
}

/**
 * Lista las sedes, ordenadas por nombre.
 *
 * Por defecto solo las activas. No trae las carreras: son un dato del detalle,
 * no de la grilla. Si no hay ninguna devuelve `[]`, nunca un 404.
 *
 * `buscar` matchea contra ciudad O provincia, parcial y sin distinguir
 * mayusculas. Dos cosas para tener presentes:
 *
 *   - NO ignora tildes: "Cordoba" no encuentra "Cordoba" con acento. Para eso
 *     haria falta la extension unaccent de Postgres.
 *   - Los indices de ciudad y provincia no sirven aca: un `contains` se
 *     traduce a ILIKE '%texto%', que un btree no puede aprovechar. Con la
 *     cantidad de sedes de un instituto da igual, pero que no confunda.
 *
 * @param {{ incluirInactivas?: boolean, buscar?: string }} [opciones]
 */
export async function listar({ incluirInactivas = false, buscar } = {}) {
  const where = {};

  if (!incluirInactivas) {
    where.activa = true;
  }

  if (buscar) {
    // `activa` y `OR` conviven en el mismo nivel: Prisma los combina con AND,
    // asi que la baja logica se sigue aplicando sobre lo que matchea.
    where.OR = [
      { ciudad: { contains: buscar, mode: 'insensitive' } },
      { provincia: { contains: buscar, mode: 'insensitive' } },
    ];
  }

  return prisma.sede.findMany({
    where,
    select: sedePublicSelect,
    orderBy: { nombre: 'asc' },
  });
}

/**
 * Busca una sede por id, con las carreras que se dictan en ella.
 *
 * Una sede dada de baja da 404, indistinguible de que no exista: esa es la
 * idea de la baja logica de cara al front publico. Con `incluirInactivas` se
 * devuelve igual, para que un admin pueda verla y reactivarla.
 *
 * Ver `sedeDetalleSelect` por la forma anidada de `carreras`.
 *
 * @throws {ApiError} 404 si no existe o esta dada de baja.
 */
export async function obtenerPorId(id, { incluirInactivas = false } = {}) {
  const sede = await prisma.sede.findUnique({
    where: { id },
    select: sedeDetalleSelect,
  });

  if (!sede || (!sede.activa && !incluirInactivas)) {
    throw ApiError.notFound('Sede no encontrada');
  }

  return sede;
}

/**
 * Modifica parcialmente una sede: solo los campos que vengan en `datos`.
 * Un campo en `null` borra el valor (ver actualizarSedeSchema).
 *
 * No se puede editar una sede dada de baja: primero hay que reactivarla. El
 * `activa: true` en el where mas el `count` del updateMany cubren de una los
 * dos casos que dan 404 -no existe, esta dada de baja- sin consulta previa ni
 * condicion de carrera. El findUnique posterior es porque updateMany no acepta
 * `select` y hay que devolver la sede ya actualizada.
 *
 * @throws {ApiError} 404 si no existe o esta dada de baja.
 * @throws {ApiError} 409 si el cambio choca con otra sede.
 */
export async function actualizar(id, datos) {
  let count;

  try {
    ({ count } = await prisma.sede.updateMany({
      where: { id, activa: true },
      data: datos,
    }));
  } catch (error) {
    if (error?.code === 'P2002') {
      // Puede chocar aunque el body traiga solo uno de los dos campos del
      // unique, asi que el que falta se completa con el valor actual.
      const actual = await prisma.sede.findUnique({
        where: { id },
        select: { nombre: true, ciudad: true },
      });
      throw await conflictoDeNombre(
        datos.nombre ?? actual?.nombre,
        datos.ciudad ?? actual?.ciudad,
      );
    }
    throw error;
  }

  if (count === 0) {
    throw ApiError.notFound('Sede no encontrada');
  }

  return prisma.sede.findUnique({ where: { id }, select: sedePublicSelect });
}

/**
 * Da de baja una sede. Baja logica: la fila y sus vinculos con carreras quedan
 * en la base, que es lo que permite reactivarla despues.
 *
 * Mismo truco que en actualizar(): el `activa: true` del where hace que el
 * count sea 0 tanto si no existe como si ya estaba dada de baja, y los dos
 * casos dan 404.
 *
 * @throws {ApiError} 404 si no existe o ya estaba dada de baja.
 */
export async function darDeBaja(id) {
  const { count } = await prisma.sede.updateMany({
    where: { id, activa: true },
    data: { activa: false },
  });

  if (count === 0) {
    throw ApiError.notFound('Sede no encontrada');
  }
}

/**
 * Reactiva una sede dada de baja.
 *
 * Es idempotente a proposito: sobre una sede que ya estaba activa devuelve la
 * sede sin error, asi el front no tiene que chequear el estado antes.
 *
 * @throws {ApiError} 404 si no existe.
 */
export async function reactivar(id) {
  try {
    return await prisma.sede.update({
      where: { id },
      data: { activa: true },
      select: sedePublicSelect,
    });
  } catch (error) {
    if (error?.code === 'P2025') {
      throw ApiError.notFound('Sede no encontrada');
    }
    throw error;
  }
}
