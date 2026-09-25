import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { contactoPublicSelect } from '../models/contacto.model.js';

/**
 * Crea un mensaje de contacto. Nace en estado NO_LEIDO (default de Prisma),
 * asi que no hace falta pasarlo explicito aca.
 *
 * @param {{ nombre: string, email: string, telefono?: string, asunto?: string,
 *           mensaje: string }} datos
 */
export async function crear(datos) {
  return prisma.mensajeContacto.create({
    data: datos,
    select: contactoPublicSelect,
  });
}

/**
 * Lista los mensajes de contacto, mas recientes primero. Filtro opcional por
 * estado. Si no hay ninguno devuelve `[]`, nunca un 404.
 *
 * @param {{ estado?: string }} [opciones]
 */
export async function listar({ estado } = {}) {
  const where = {};

  if (estado) {
    where.estado = estado;
  }

  return prisma.mensajeContacto.findMany({
    where,
    select: contactoPublicSelect,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Busca un mensaje de contacto por id.
 * @throws {ApiError} 404 si no existe.
 */
export async function obtenerPorId(id) {
  const mensaje = await prisma.mensajeContacto.findUnique({
    where: { id },
    select: contactoPublicSelect,
  });

  if (!mensaje) {
    throw ApiError.notFound('Mensaje de contacto no encontrado');
  }

  return mensaje;
}

/**
 * Modifica parcialmente un mensaje de contacto: solo los campos que vengan en
 * `datos`.
 *
 * Si llega `respuesta` y el mensaje todavia no tenia `respondidoAt`, se fija
 * `respondidoAt = now()` y `estado = RESPONDIDO` automaticamente, aunque el
 * caller no lo haya pedido: es la forma de que responder deje el estado
 * consistente sin que el admin tenga que acordarse de mandar los dos campos.
 *
 * @throws {ApiError} 404 si no existe.
 */
export async function actualizar(id, datos) {
  const actual = await prisma.mensajeContacto.findUnique({
    where: { id },
    select: { respondidoAt: true },
  });

  if (!actual) {
    throw ApiError.notFound('Mensaje de contacto no encontrado');
  }

  const data = { ...datos };

  if (datos.respuesta !== undefined && !actual.respondidoAt) {
    data.respondidoAt = new Date();
    data.estado = 'RESPONDIDO';
  }

  return prisma.mensajeContacto.update({
    where: { id },
    data,
    select: contactoPublicSelect,
  });
}

/**
 * Elimina fisicamente un mensaje de contacto. No hay soft delete en este
 * modelo: no tiene sentido "reactivar" un mensaje que ya se descarto.
 * @throws {ApiError} 404 si no existe
 */
export async function eliminar(id) {
  try {
    await prisma.mensajeContacto.delete({ where: { id } });
  } catch (error) {
    if (error?.code === 'P2025') {
      throw ApiError.notFound('Mensaje de contacto no encontrado');
    }
    throw error;
  }
}
