import * as preinscripcionService from '../services/preinscripcion.service.js';

/**
 * Controllers finos: traducen HTTP a llamadas al service y nada mas.
 *
 * No hay try/catch: en Express 5 el reject de un handler async se propaga solo
 * al errorHandler.
 */

/**
 * Sin header Location a proposito: no existe un GET /preinscripciones/:id al
 * que apuntar, y mandar la URL de la coleccion seria mentir sobre donde vive
 * el recurso recien creado.
 */
export async function crear(req, res) {
  res.created(await preinscripcionService.crear(req.body));
}

export async function listar(_req, res) {
  res.ok(await preinscripcionService.listar());
}
