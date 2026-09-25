import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { informacionInstitucionalSelect } from '../models/informacionInstitucional.model.js';

/**
 * Crea la Informacion Institucional de una sede, con sus autoridades si vienen.
 *
 * Cada sede tiene a lo sumo una Informacion Institucional (sedeId es @unique
 * en el schema), asi que un segundo POST para la misma sede choca con P2002.
 *
 * @param {string} sedeId
 * @param {{ nombre: string, lema?: string, historia?: string, mision?: string,
 *           vision?: string, autoridades?: object[] }} datos
 * @throws {ApiError} 404 si la sede no existe.
 * @throws {ApiError} 409 si la sede ya tiene informacion institucional cargada.
 */
export async function crear(sedeId, datos) {
  const { autoridades, ...datosInfo } = datos;

  try {
    return await prisma.informacionInstitucional.create({
      data: {
        ...datosInfo,
        sedeId,
        autoridades: {
          create: autoridades ?? [],
        },
      },
      select: informacionInstitucionalSelect,
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw ApiError.conflict(
        'Ya existe informacion institucional para esta sede',
      );
    }
    if (error?.code === 'P2003') {
      // La FK sedeId no matchea ninguna Sede existente.
      throw ApiError.notFound('Sede no encontrada');
    }
    throw error;
  }
}

/**
 * Busca la Informacion Institucional de una sede, con sus autoridades.
 *
 * @param {string} sedeId
 * @throws {ApiError} 404 si la sede no tiene informacion institucional cargada.
 */
export async function obtenerPorSedeId(sedeId) {
  const informacion = await prisma.informacionInstitucional.findUnique({
    where: { sedeId },
    select: informacionInstitucionalSelect,
  });

  if (!informacion) {
    throw ApiError.notFound(
      'Informacion institucional no encontrada para esta sede',
    );
  }

  return informacion;
}

/**
 * Reemplaza la Informacion Institucional de una sede (PUT: recurso completo).
 *
 * A diferencia del PATCH de Sede, aca no hay actualizacion parcial: el body
 * ya viene validado como completo (ver actualizarInformacionInstitucionalSchema,
 * que es el mismo schema que crear). Las autoridades tambien se reemplazan
 * enteras -se borran todas las viejas y se crean las nuevas- en vez de
 * mergearse una por una, porque el front no manda ids para matchear cuales
 * cambiaron, cuales se borraron y cuales son nuevas.
 *
 * Se actualiza por `sedeId` directo (no por el id propio de la fila) porque
 * `sedeId` es @unique en el schema, asi que Prisma lo acepta como `where`.
 *
 * La transaccion asegura que no quede a mitad de camino -autoridades borradas
 * pero el update fallado- si algo se corta en el medio.
 *
 * @param {string} sedeId
 * @param {{ nombre: string, lema?: string, historia?: string, mision?: string,
 *           vision?: string, autoridades?: object[] }} datos
 * @throws {ApiError} 404 si la sede no tiene informacion institucional cargada.
 */
export async function actualizar(sedeId, datos) {
  const { autoridades, ...datosInfo } = datos;

  const existente = await prisma.informacionInstitucional.findUnique({
    where: { sedeId },
    select: { id: true },
  });

  if (!existente) {
    throw ApiError.notFound(
      'Informacion institucional no encontrada para esta sede',
    );
  }

  await prisma.$transaction([
    prisma.autoridad.deleteMany({
      where: { informacionInstitucionalId: existente.id },
    }),
    prisma.informacionInstitucional.update({
      where: { sedeId },
      data: {
        ...datosInfo,
        autoridades: {
          create: autoridades ?? [],
        },
      },
    }),
  ]);

  // El update de arriba no lleva `select` -Prisma no permite combinar
  // `data.autoridades.create` con `select` en la misma llamada dentro de una
  // transaccion tipo array-, asi que se relee aparte con el shape publico.
  return prisma.informacionInstitucional.findUnique({
    where: { sedeId },
    select: informacionInstitucionalSelect,
  });
}
