import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { publicacionSelect } from '../models/publicacion.model.js';
import { generarSlugUnico } from '../utils/slug.js';

/**
 * Genera un slug unico para una publicacion.
 * La logica vive en utils/slug.js; aca solo se aporta como se consulta la
 * existencia en esta tabla.
 */
function generarSlugPublicacion(titulo) {
  return generarSlugUnico(
    titulo,
    async (slug) =>
      (await prisma.publicacion.findUnique({
        where: { slug },
        select: { id: true },
      })) !== null,
    'publicacion',
  );
}

/**
 * Normaliza un texto para busqueda accent-insensitive:
 * - NFD + strip diacriticos
 * - lower case
 * Cubre vocales con acento y dieresis del español (áéíóúàèìòùâêîôûäëïöü).
 */
function normalizarParaBusqueda(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Escapa metacaracteres de LIKE para que se busquen como literales.
 * Orden importante: primero \ luego % y _ para no doble-escapar.
 */
function escaparLike(texto) {
  return texto.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Obtiene IDs que matchean `buscar` de forma parcial, case y accent-insensitive
 * en titulo, resumen y contenido. Usa SQL parametrizado con translate() (no requiere extension).
 * No concatena el valor del usuario; lo pasa como parametro a $queryRaw.
 * Escapa %, _ y \ como literales mediante ESCAPE '\'.
 */
async function buscarIdsPorTexto(buscar) {
  const normalizado = normalizarParaBusqueda(buscar);
  const escapado = escaparLike(normalizado);
  // translate() normaliza tildes en la BD del lado de Postgres (sin extension unaccent)
  // lower() + translate() cubre case + accent. COALESCE evita null en resumen.
  const fromChars = 'áàâäãéèêëíìîïóòôöúùûü';
  const toChars = 'aaaaaeeeeiiiiooooouuuu';
  // Parametrizado: ${escapado} es placeholder, no concatenacion; ESCAPE '\' hace que \% \_ \\ sean literales.
  const ids = await prisma.$queryRaw`
    SELECT id FROM "Publicacion"
    WHERE translate(lower(titulo), ${fromChars}, ${toChars}) LIKE '%' || ${escapado} || '%' ESCAPE '\\'
       OR translate(lower(COALESCE(resumen, '')), ${fromChars}, ${toChars}) LIKE '%' || ${escapado} || '%' ESCAPE '\\'
       OR translate(lower(contenido), ${fromChars}, ${toChars}) LIKE '%' || ${escapado} || '%' ESCAPE '\\'
  `;
  return ids.map((r) => r.id);
}

/**
 * Lista publicaciones con filtros combinables.
 *
 * Orden: mas recientes primero (createdAt desc). Es consistente con haber
 * filtrado por fecha y evita que el orden lo decida Postgres de forma no deterministica.
 *
 * Filtro de fechas:
 *   - si tipo=EVENTO  -> filtra por fechaEvento
 *   - si tipo=NOTICIA  -> filtra por createdAt
 *   - si no hay tipo   -> trae donde (tipo=EVENTO y fechaEvento en rango) OR (tipo=NOTICIA y createdAt en rango)
 *
 * Busqueda `buscar` es parcial, case-insensitive y accent-insensitive (via translate + normalizacion JS).
 *
 * @param {{ tipo?: string, buscar?: string, fechaDesde?: string, fechaHasta?: string, destacada?: boolean }} filtros
 */
export async function listar({ tipo, buscar, fechaDesde, fechaHasta, destacada } = {}) {
  const where = {};
  const andConditions = [];

  if (tipo) {
    where.tipo = tipo;
  }

  if (destacada !== undefined) {
    where.destacada = destacada;
  }

  if (buscar) {
    const ids = await buscarIdsPorTexto(buscar);
    // Si no hay coincidencias, no hace falta seguir; Prisma con `in: []` tambien devuelve [].
    if (ids.length === 0) {
      return [];
    }
    andConditions.push({ id: { in: ids } });
  }

  if (fechaDesde || fechaHasta) {
    const rango = {};
    if (fechaDesde) rango.gte = new Date(fechaDesde);
    if (fechaHasta) rango.lte = new Date(fechaHasta);

    if (tipo === 'EVENTO') {
      andConditions.push({ fechaEvento: rango });
    } else if (tipo === 'NOTICIA') {
      andConditions.push({ createdAt: rango });
    } else {
      // Sin tipo: OR entre la fecha relevante de cada tipo
      andConditions.push({
        OR: [
          { tipo: 'EVENTO', fechaEvento: rango },
          { tipo: 'NOTICIA', createdAt: rango },
        ],
      });
    }
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return prisma.publicacion.findMany({
    where,
    select: publicacionSelect,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Obtiene una publicacion por id.
 * @throws {ApiError} 404 si no existe
 */
export async function obtenerPorId(id) {
  const publicacion = await prisma.publicacion.findUnique({
    where: { id },
    select: publicacionSelect,
  });

  if (!publicacion) {
    throw ApiError.notFound('Publicacion no encontrada');
  }

  return publicacion;
}

/**
 * Crea una publicacion.
 * El slug se genera automaticamente a partir del titulo.
 * El autorId viene del usuario autenticado, nunca del body.
 *
 * Regla: EVENTO requiere fechaEvento, NOTICIA fuerza fechaEvento=null.
 *
 * @param {{ titulo: string, resumen?: string, contenido: string, tipo: string, imagenUrl?: string, fechaEvento?: string|null, destacada?: boolean }} datos
 * @param {string} autorId
 */
export async function crear(datos, autorId) {
  const dataBase = {
    titulo: datos.titulo,
    resumen: datos.resumen ?? null,
    contenido: datos.contenido,
    tipo: datos.tipo,
    imagenUrl: datos.imagenUrl ?? null,
    destacada: datos.destacada ?? false,
    autorId,
  };

  // Manejo de fechaEvento segun tipo (segunda capa de validacion ademas del Zod)
  if (datos.tipo === 'EVENTO') {
    if (!datos.fechaEvento) {
      throw ApiError.badRequest('fechaEvento es obligatoria cuando tipo es EVENTO');
    }
    dataBase.fechaEvento = new Date(datos.fechaEvento);
  } else {
    // NOTICIA
    dataBase.fechaEvento = null;
  }

  // Reintento pequeño para condicion de carrera en slug (P2002).
  // Sin dependencia extra: genera siguiente sufijo incremental y reintenta.
  for (let intento = 0; intento < 3; intento++) {
    const slug = await generarSlugPublicacion(datos.titulo);
    try {
      return await prisma.publicacion.create({
        data: { ...dataBase, slug },
        select: publicacionSelect,
      });
    } catch (error) {
      if (error?.code === 'P2002' && intento < 2) {
        // Colision por carrera: loop buscará el siguiente "-2", "-3", etc.
        continue;
      }
      if (error?.code === 'P2002') {
        throw ApiError.conflict('Ya existe una publicacion con ese slug');
      }
      throw error;
    }
  }
  throw ApiError.conflict('Ya existe una publicacion con ese slug');
}

/**
 * Actualiza parcialmente una publicacion.
 * NO modifica el slug aunque cambie el titulo, para no romper URLs existentes.
 *
 * Garantiza que el estado FINAL siga siendo consistente:
 *   - EVENTO -> fechaEvento obligatoria
 *   - NOTICIA -> fechaEvento null
 *
 * Si solo llega uno de los campos implicados (solo tipo o solo fechaEvento),
 * se combina con los valores actuales para validar el resultado final.
 *
 * @throws {ApiError} 404 si no existe
 * @throws {ApiError} 400 si el estado final es inconsistente
 * @throws {ApiError} 400 si el body vino vacio (ya lo frena Zod, pero doble chequeo)
 */
export async function actualizar(id, datos) {
  if (!datos || Object.keys(datos).length === 0) {
    throw ApiError.badRequest('Hay que enviar al menos un campo para modificar');
  }

  const actual = await prisma.publicacion.findUnique({ where: { id } });
  if (!actual) {
    throw ApiError.notFound('Publicacion no encontrada');
  }

  // Calcular estado final para validar regla tipo/fechaEvento
  const tipoFinal = datos.tipo ?? actual.tipo;
  const tieneFechaEnBody = Object.prototype.hasOwnProperty.call(datos, 'fechaEvento');
  const fechaFinalRaw = tieneFechaEnBody ? datos.fechaEvento : actual.fechaEvento;

  // Validacion de estado final
  if (tipoFinal === 'EVENTO' && !fechaFinalRaw) {
    throw ApiError.badRequest('fechaEvento es obligatoria cuando tipo es EVENTO');
  }

  const data = {};

  if (datos.titulo !== undefined) data.titulo = datos.titulo;
  if (datos.resumen !== undefined) data.resumen = datos.resumen;
  if (datos.contenido !== undefined) data.contenido = datos.contenido;
  if (datos.tipo !== undefined) data.tipo = datos.tipo;
  if (datos.imagenUrl !== undefined) data.imagenUrl = datos.imagenUrl;
  if (datos.destacada !== undefined) data.destacada = datos.destacada;

  // Manejo de fechaEvento segun estado final
  if (tipoFinal === 'NOTICIA') {
    data.fechaEvento = null;
  } else if (tieneFechaEnBody) {
    // EVENTO y vino fecha en el body
    if (datos.fechaEvento === null) {
      throw ApiError.badRequest('fechaEvento es obligatoria cuando tipo es EVENTO');
    }
    data.fechaEvento = new Date(datos.fechaEvento);
  } else if (datos.tipo === 'EVENTO' && !actual.fechaEvento) {
    // Cambio a EVENTO pero no mando fecha y el actual no tenia (era NOTICIA)
    throw ApiError.badRequest('fechaEvento es obligatoria cuando tipo es EVENTO');
  }
  // Si es EVENTO y no vino fecha en body pero ya tenia, se deja como esta (no se toca data.fechaEvento)

  // No se permite modificar slug ni autorId aunque vengan en el body (strictObject ya los frena,
  // pero por si acaso no los copiamos).

  try {
    return await prisma.publicacion.update({
      where: { id },
      data,
      select: publicacionSelect,
    });
  } catch (error) {
    if (error?.code === 'P2025') {
      throw ApiError.notFound('Publicacion no encontrada');
    }
    if (error?.code === 'P2002') {
      throw ApiError.conflict('Conflicto al actualizar la publicacion');
    }
    throw error;
  }
}

/**
 * Elimina fisicamente una publicacion. No hay soft delete en este modelo.
 * @throws {ApiError} 404 si no existe
 */
export async function eliminar(id) {
  try {
    await prisma.publicacion.delete({ where: { id } });
  } catch (error) {
    if (error?.code === 'P2025') {
      throw ApiError.notFound('Publicacion no encontrada');
    }
    throw error;
  }
}
