import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { preinscripcionSelect } from '../models/preinscripcion.model.js';

/**
 * Crea una preinscripcion.
 *
 * Se consulta la carrera antes de insertar solo para poder dar un mensaje
 * entendible: sin ese chequeo, un carreraId inventado saldria como el P2003
 * generico ("La operacion viola una relacion con otro registro"), que no le
 * dice nada a quien esta llenando el formulario.
 *
 * El catch del P2002 se mantiene igual: entre el chequeo y el insert hay una
 * carrera, y el indice unico es la unica garantia real contra el duplicado.
 *
 * @param {object} datos Body ya validado por Zod (documento normalizado).
 * @throws {ApiError} 404 si la carrera no existe
 * @throws {ApiError} 409 si la carrera esta dada de baja
 * @throws {ApiError} 409 si ya se preinscribio a esa carrera con ese documento
 */
export async function crear(datos) {
  const carrera = await prisma.carrera.findUnique({
    where: { id: datos.carreraId },
    select: { id: true, activa: true, nombre: true },
  });

  if (!carrera) {
    throw ApiError.notFound('La carrera no existe');
  }

  if (!carrera.activa) {
    throw ApiError.conflict(
      `La carrera "${carrera.nombre}" no esta abierta a preinscripcion`,
      { carreraId: carrera.id },
    );
  }

  try {
    return await prisma.preinscripcion.create({
      data: {
        nombre: datos.nombre,
        apellido: datos.apellido,
        documento: datos.documento,
        // El string llega como "1990-05-15". Se fija el mediodia UTC a
        // proposito: con T00:00:00Z, un servidor en una zona horaria negativa
        // puede guardar el dia anterior al convertir.
        fechaNacimiento: new Date(`${datos.fechaNacimiento}T12:00:00Z`),
        nacionalidad: datos.nacionalidad,
        direccion: datos.direccion,
        localidad: datos.localidad,
        provincia: datos.provincia,
        telefono: datos.telefono,
        email: datos.email,
        carreraId: datos.carreraId,
      },
      select: preinscripcionSelect,
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw ApiError.conflict(
        'Ya hay una preinscripcion con ese documento para esta carrera',
        { documento: datos.documento, carreraId: datos.carreraId },
      );
    }
    throw error;
  }
}

/**
 * Lista todas las preinscripciones, de la mas nueva a la mas vieja.
 *
 * Es lo que quiere ver un ADMIN al entrar: quien se anoto ultimo. El endpoint
 * esta restringido a ADMIN porque cada fila tiene documento, fecha de
 * nacimiento, domicilio y telefono de una persona.
 */
export async function listar() {
  return prisma.preinscripcion.findMany({
    select: preinscripcionSelect,
    orderBy: { createdAt: 'desc' },
  });
}
