import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { generarSlugUnico } from '../utils/slug.js';
import {
  albumDetalleSelect,
  albumSelect,
  formatearAlbum,
} from '../models/album.model.js';
import {
  borrarImagenes,
  carpetaDelAlbum,
  subirImagen,
} from './storage.service.js';

/**
 * Genera un slug unico para un album.
 * La logica vive en utils/slug.js; aca solo se aporta como se consulta la
 * existencia en esta tabla.
 */
function generarSlugAlbum(titulo) {
  return generarSlugUnico(
    titulo,
    async (slug) =>
      (await prisma.album.findUnique({
        where: { slug },
        select: { id: true },
      })) !== null,
    'album',
  );
}

/**
 * Lista albums.
 *
 * Orden: primero por la fecha del evento (mas reciente arriba) y despues por
 * fecha de carga. Los albums sin fecha van al final en vez de arriba, que es
 * lo que haria Postgres por defecto en un DESC.
 *
 * @param {{ incluirInactivos?: boolean }} filtros
 */
export async function listar({ incluirInactivos = false } = {}) {
  const where = incluirInactivos ? {} : { activo: true };

  const albums = await prisma.album.findMany({
    where,
    select: albumSelect,
    orderBy: [{ fecha: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  });

  return albums.map(formatearAlbum);
}

/**
 * Obtiene un album con todas sus imagenes.
 *
 * Un album dado de baja devuelve 404 igual que si no existiera: un 403 estaria
 * confirmando que existe, y el listado publico ya lo esconde.
 *
 * @throws {ApiError} 404 si no existe o esta dado de baja
 */
export async function obtenerPorId(id, { incluirInactivos = false } = {}) {
  const album = await prisma.album.findUnique({
    where: { id },
    select: albumDetalleSelect,
  });

  if (!album || (!album.activo && !incluirInactivos)) {
    throw ApiError.notFound('Album no encontrado');
  }

  return formatearAlbum(album);
}

/**
 * Crea un album vacio. Las fotos se suben despues, por su propio endpoint.
 * El slug sale del titulo y el autorId del token, nunca del body.
 *
 * @param {{ titulo: string, descripcion?: string, fecha?: string }} datos
 * @param {string} autorId
 */
export async function crear(datos, autorId) {
  const dataBase = {
    titulo: datos.titulo,
    descripcion: datos.descripcion ?? null,
    fecha: datos.fecha ? new Date(datos.fecha) : null,
    autorId,
  };

  // Entre consultar que el slug este libre y escribirlo hay una carrera.
  // Mismo reintento que publicacion.service.js: se vuelve a pedir el slug, que
  // ahora ve la fila del otro y devuelve el siguiente sufijo.
  for (let intento = 0; intento < 3; intento++) {
    const slug = await generarSlugAlbum(datos.titulo);
    try {
      const album = await prisma.album.create({
        data: { ...dataBase, slug },
        select: albumDetalleSelect,
      });
      return formatearAlbum(album);
    } catch (error) {
      if (error?.code === 'P2002' && intento < 2) continue;
      if (error?.code === 'P2002') {
        throw ApiError.conflict('Ya existe un album con ese slug');
      }
      throw error;
    }
  }

  throw ApiError.conflict('Ya existe un album con ese slug');
}

/**
 * Actualiza parcialmente un album.
 *
 * NO toca el slug aunque cambie el titulo: si cambiara, se romperian las URLs
 * ya publicadas que apuntan al slug viejo.
 *
 * Se usa updateMany con `activo: true` en el where para que un album dado de
 * baja de 404 sin una consulta previa, que abriria una carrera entre el
 * chequeo y la escritura.
 *
 * @throws {ApiError} 404 si no existe o esta dado de baja
 */
export async function actualizar(id, datos) {
  const data = {};

  if (datos.titulo !== undefined) data.titulo = datos.titulo;
  if (datos.descripcion !== undefined) data.descripcion = datos.descripcion;
  if (datos.fecha !== undefined) {
    data.fecha = datos.fecha === null ? null : new Date(datos.fecha);
  }

  const { count } = await prisma.album.updateMany({
    where: { id, activo: true },
    data,
  });

  if (count === 0) {
    throw ApiError.notFound('Album no encontrado o dado de baja');
  }

  const album = await prisma.album.findUnique({
    where: { id },
    select: albumDetalleSelect,
  });

  return formatearAlbum(album);
}

/**
 * Baja logica: el album deja de verse en la parte publica pero no se borra
 * nada. Las imagenes siguen en Cloudinary y se recupera todo con /reactivar.
 *
 * @throws {ApiError} 404 si no existe o ya estaba dado de baja
 */
export async function darDeBaja(id) {
  const { count } = await prisma.album.updateMany({
    where: { id, activo: true },
    data: { activo: false },
  });

  if (count === 0) {
    throw ApiError.notFound('Album no encontrado o ya estaba dado de baja');
  }
}

/**
 * Vuelve a mostrar un album dado de baja. Es idempotente: reactivar uno que ya
 * estaba activo devuelve el album igual, sin error.
 *
 * @throws {ApiError} 404 si no existe
 */
export async function reactivar(id) {
  try {
    const album = await prisma.album.update({
      where: { id },
      data: { activo: true },
      select: albumDetalleSelect,
    });
    return formatearAlbum(album);
  } catch (error) {
    if (error?.code === 'P2025') {
      throw ApiError.notFound('Album no encontrado');
    }
    throw error;
  }
}

/**
 * Sube imagenes a un album y guarda sus URLs.
 *
 * Cloudinary y Postgres son dos sistemas distintos y no hay transaccion que
 * abarque a los dos, asi que se compensa a mano y el criterio es todo o nada:
 *
 *   1. se suben los archivos uno por uno a Cloudinary
 *      -> si falla el k-esimo, se borran los k-1 ya subidos
 *   2. se escriben las filas en una sola transaccion
 *      -> si falla, se borran de Cloudinary los archivos recien subidos
 *
 * Guardar "las que anduvieron" seria peor: el usuario no tendria forma de
 * saber cuales entraron y cuales no.
 *
 * Queda un hueco imposible de cerrar sin una tabla de pendientes: si el proceso
 * se cae justo entre el paso 1 y el 2, los archivos quedan huerfanos en
 * Cloudinary. Con el volumen de un instituto se limpia a mano desde el panel.
 *
 * @param {string} albumId
 * @param {Array<{ buffer: Buffer, originalname: string }>} archivos
 * @throws {ApiError} 404 si el album no existe, 409 si esta dado de baja
 */
export async function agregarImagenes(albumId, archivos) {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, activo: true, portadaId: true },
  });

  if (!album) {
    throw ApiError.notFound('Album no encontrado');
  }

  if (!album.activo) {
    throw ApiError.conflict(
      'No se pueden subir imagenes a un album dado de baja. Reactivalo primero.',
      { albumId },
    );
  }

  const carpeta = carpetaDelAlbum(albumId);
  const subidas = [];

  // Secuencial y no en paralelo: con 5 archivos la diferencia de tiempo es
  // despreciable y el rollback queda trivial de razonar.
  try {
    for (const archivo of archivos) {
      subidas.push(await subirImagen(archivo.buffer, { carpeta }));
    }
  } catch (error) {
    await borrarImagenes(subidas.map((s) => s.publicId));
    throw new ApiError(
      502,
      'No se pudo subir la imagen al servicio de imagenes',
      { detalle: error?.message ?? null },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const creadas = await tx.imagen.createManyAndReturn({
        data: subidas.map((s) => ({
          albumId,
          url: s.url,
          publicId: s.publicId,
          width: s.width,
          height: s.height,
          formato: s.formato,
          bytes: s.bytes,
        })),
        select: { id: true, publicId: true },
      });

      // La primera foto de un album sin portada pasa a ser la portada sola.
      // Si no, todo album recien cargado se ve vacio en el listado hasta que
      // alguien se acuerda de elegir una.
      //
      // Se busca por publicId en vez de tomar creadas[0]: Postgres devuelve las
      // filas de un INSERT multiple en orden de insercion en la practica, pero
      // no lo garantiza, y aca queremos exactamente la primera que subio el
      // usuario, no una cualquiera del lote.
      if (!album.portadaId && creadas.length > 0) {
        const primera =
          creadas.find((c) => c.publicId === subidas[0].publicId) ?? creadas[0];

        await tx.album.update({
          where: { id: albumId },
          data: { portadaId: primera.id },
        });
      }
    });
  } catch (error) {
    await borrarImagenes(subidas.map((s) => s.publicId));
    throw error;
  }

  const actualizado = await prisma.album.findUnique({
    where: { id: albumId },
    select: albumDetalleSelect,
  });

  return formatearAlbum(actualizado);
}

/**
 * Borra una imagen del album, de verdad: la fila y el archivo en Cloudinary.
 * Es el unico lugar del modulo donde algo se borra fisicamente.
 *
 * El orden es a proposito: primero la fila, despues el archivo. Al reves,
 * quedaria una fila apuntando a una URL rota, que el usuario ve como una foto
 * que no carga. Asi, en el peor caso queda un archivo de mas en Cloudinary,
 * invisible para el usuario y borrable a mano.
 *
 * @throws {ApiError} 404 si la imagen no existe dentro de ese album
 */
export async function eliminarImagen(albumId, imagenId) {
  // findFirst con los dos ids: si la imagen existe pero pertenece a otro album,
  // esto devuelve null. Sin ese filtro se podria borrar la foto de otro album
  // pasando su id en la URL.
  const imagen = await prisma.imagen.findFirst({
    where: { id: imagenId, albumId },
    select: { id: true, publicId: true },
  });

  if (!imagen) {
    throw ApiError.notFound('La imagen no existe en este album');
  }

  await prisma.imagen.delete({ where: { id: imagen.id } });

  // Si era la portada, el onDelete: SetNull del schema ya la dejo en null.
  // Se promueve la mas antigua de las que quedan, asi el album no se ve vacio
  // en el listado por haber borrado una sola foto.
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { portadaId: true },
  });

  if (album && album.portadaId === null) {
    const siguiente = await prisma.imagen.findFirst({
      where: { albumId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (siguiente) {
      await prisma.album.update({
        where: { id: albumId },
        data: { portadaId: siguiente.id },
      });
    }
  }

  // Best-effort a proposito: si Cloudinary falla, la imagen ya desaparecio del
  // album, que es lo que pidio el usuario. Devolver 500 lo haria reintentar y
  // comerse un 404. El archivo huerfano queda logueado.
  await borrarImagenes([imagen.publicId]);
}

/**
 * Elige cual de las imagenes del album se muestra como portada.
 *
 * @throws {ApiError} 404 si la imagen no existe dentro de ese album
 */
export async function elegirPortada(albumId, imagenId) {
  const imagen = await prisma.imagen.findFirst({
    where: { id: imagenId, albumId },
    select: { id: true },
  });

  if (!imagen) {
    throw ApiError.notFound('La imagen no existe en este album');
  }

  const album = await prisma.album.update({
    where: { id: albumId },
    data: { portadaId: imagen.id },
    select: albumDetalleSelect,
  });

  return formatearAlbum(album);
}
