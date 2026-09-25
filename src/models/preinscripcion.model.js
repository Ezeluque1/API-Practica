import { z } from 'zod';

import { carreraResumenSelect } from './sede.model.js';

/**
 * Campos que la API expone de una Preinscripcion.
 *
 * La carrera viaja anidada con el mismo recorte que usa GET /sedes/:id
 * (carreraResumenSelect), asi el front no tiene que pedirla por separado para
 * mostrar a que se anoto cada aspirante.
 */
export const preinscripcionSelect = {
  id: true,
  nombre: true,
  apellido: true,
  documento: true,
  fechaNacimiento: true,
  nacionalidad: true,
  direccion: true,
  localidad: true,
  provincia: true,
  telefono: true,
  email: true,
  carreraId: true,
  carrera: { select: carreraResumenSelect },
  createdAt: true,
  updatedAt: true,
};

/**
 * Helper para textos obligatorios: trim antes de min(1) para rechazar
 * solo-espacios y normalizar lo que entra a la base.
 */
const textoRequerido = (max) => z.string().trim().min(1).max(max);

/**
 * Deja el documento en una sola forma canonica: sin puntos, espacios ni
 * guiones, en mayusculas.
 *
 * Es lo que hace que el unique (documento, carreraId) sirva de verdad. Sin
 * esto, la misma persona escribiendo "12.345.678" una vez y "12345678" la otra
 * genera dos filas y el 409 nunca aparece.
 */
const normalizarDocumento = (v) => v.replace(/[\s.-]/g, '').toUpperCase();

/** Nadie del planeta tiene mas de 120 años. */
const MAX_ANIOS = 120;

/**
 * Body del POST /preinscripciones.
 *
 * Es el unico endpoint de escritura publica de la API: no pide token, asi que
 * la validacion es la unica barrera entre el formulario y la base.
 */
export const crearPreinscripcionSchema = z.strictObject({
  nombre: textoRequerido(80),
  apellido: textoRequerido(80),

  /**
   * Permisivo a proposito: se aceptan letras porque no todos los aspirantes
   * van a tener DNI argentino (pasaporte, cedula de otro pais). El regex
   * valida lo que escribio la persona; el transform guarda la forma canonica.
   */
  documento: z
    .string()
    .trim()
    .min(6)
    .max(20)
    .regex(/^[0-9A-Za-z.\-\s]+$/, 'El documento solo admite letras, numeros, puntos y guiones')
    .transform(normalizarDocumento),

  /**
   * Solo la fecha ("1990-05-15"), no un datetime completo: una fecha de
   * nacimiento no tiene hora, y aceptar una obligaria a decidir en que zona
   * horaria interpretarla.
   */
  fechaNacimiento: z
    .iso
    .date()
    .refine((v) => new Date(`${v}T00:00:00Z`) <= new Date(), {
      message: 'La fecha de nacimiento no puede estar en el futuro',
    })
    .refine(
      (v) => {
        const limite = new Date();
        limite.setUTCFullYear(limite.getUTCFullYear() - MAX_ANIOS);
        return new Date(`${v}T00:00:00Z`) >= limite;
      },
      { message: `La fecha de nacimiento no puede ser de hace mas de ${MAX_ANIOS} años` },
    ),

  nacionalidad: textoRequerido(60),

  // Domicilio
  direccion: textoRequerido(150),
  localidad: textoRequerido(80),
  provincia: textoRequerido(80),

  telefono: z
    .string()
    .trim()
    .min(7)
    .max(25)
    .regex(/^[0-9+\-()\s]+$/, 'El telefono solo admite numeros, espacios y los signos + - ( )'),

  /**
   * El trim y el toLowerCase van ANTES del chequeo de email, no despues:
   * z.email().trim() valida primero y recien ahi recorta, asi que un mail
   * pegado con un espacio al final daria 400 en vez de guardarse limpio.
   */
  email: z.string().trim().toLowerCase().pipe(z.email().max(150)),

  carreraId: z.cuid(),
});

/**
 * Query del GET /preinscripciones.
 *
 * Vacio a proposito: hoy el listado no toma filtros. Al ser strictObject,
 * cualquier parametro inventado da 400 en vez de ignorarse en silencio, que es
 * lo que evita que el front crea que esta filtrando cuando no.
 */
export const preinscripcionesListadoQuerySchema = z.strictObject({});
