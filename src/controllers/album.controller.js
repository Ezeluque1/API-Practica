import * as albumService from '../services/album.service.js';
import { ApiError } from '../utils/ApiError.js';
import { CAMPO_IMAGENES } from '../middlewares/upload.middleware.js';

/**
 * Controllers finos: traducen HTTP a llamadas al service y nada mas. Las
 * reglas viven en album.service.js.
 *
 * No hay try/catch: en Express 5 el reject de un handler async se propaga solo
 * al errorHandler.
 */

export async function listar(req, res) {
  res.ok(await albumService.listar(req.validated.query));
}

export async function obtenerPorId(req, res) {
  const album = await albumService.obtenerPorId(
    req.validated.params.id,
    req.validated.query,
  );
  res.ok(album);
}

export async function crear(req, res) {
  // El autor sale del token, nunca del body.
  const album = await albumService.crear(req.body, req.user.id);
  res.created(album, `/api/albums/${album.id}`);
}

export async function actualizar(req, res) {
  const album = await albumService.actualizar(
    req.validated.params.id,
    req.body,
  );
  res.ok(album);
}

export async function eliminar(req, res) {
  await albumService.darDeBaja(req.validated.params.id);
  res.noContent();
}

export async function reactivar(req, res) {
  res.ok(await albumService.reactivar(req.validated.params.id));
}

/**
 * Devuelve el album entero y no solo las imagenes creadas: subir una foto
 * puede cambiar la portada (la primera de un album vacio pasa a serlo sola),
 * asi el front se entera sin tener que pedir el album de nuevo.
 */
export async function agregarImagenes(req, res) {
  const archivos = req.files ?? [];

  // multer deja req.files vacio si no vino ningun archivo. Sin este chequeo,
  // el request seguiria hasta el service y devolveria un 201 sin haber subido
  // nada, que es lo peor que puede pasar: parece que funciono.
  if (archivos.length === 0) {
    throw ApiError.badRequest(
      `Hay que mandar al menos una imagen en el campo "${CAMPO_IMAGENES}"`,
    );
  }

  const album = await albumService.agregarImagenes(
    req.validated.params.id,
    archivos,
  );

  res.created(album, `/api/albums/${album.id}`);
}

export async function eliminarImagen(req, res) {
  const { id, imagenId } = req.validated.params;
  await albumService.eliminarImagen(id, imagenId);
  res.noContent();
}

export async function elegirPortada(req, res) {
  const album = await albumService.elegirPortada(
    req.validated.params.id,
    req.body.imagenId,
  );
  res.ok(album);
}
