/**
 * Generacion de slugs url-friendly, compartida por todos los modulos que
 * exponen recursos por una URL legible (publicaciones, albums).
 */

/**
 * Convierte un texto en un slug url-friendly.
 * - minusculas
 * - normaliza y elimina acentos
 * - reemplaza todo lo no alfanumerico por "-"
 * - colapsa guiones y recorta extremos
 *
 * @param {string} texto
 * @param {string} [fallback] Que devolver si no queda ningun caracter usable
 *   (por ejemplo un titulo escrito entero en otro alfabeto, o solo simbolos).
 * @returns {string}
 */
export function slugify(texto, fallback = 'item') {
  const base = texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return base || fallback;
}

/**
 * Genera un slug unico a partir de un texto.
 * Si ya existe, agrega sufijo incremental "-2", "-3", etc.
 *
 * La unicidad la decide quien llama, via `existeSlug`, porque cada modulo
 * consulta su propia tabla. Ojo: entre este chequeo y el INSERT hay una
 * carrera, asi que el service igual tiene que atajar el P2002 y reintentar.
 *
 * @param {string} texto Titulo o nombre del que se deriva el slug.
 * @param {(slug: string) => Promise<boolean>} existeSlug
 * @param {string} [fallback] Se pasa a slugify().
 * @returns {Promise<string>}
 */
export async function generarSlugUnico(texto, existeSlug, fallback) {
  const base = slugify(texto, fallback);
  let slug = base;
  let contador = 2;

  // Loop deterministico: busca colision y prueba el siguiente sufijo.
  // Es una sola query por intento, en el caso feliz solo una.
  while (await existeSlug(slug)) {
    slug = `${base}-${contador++}`;
  }

  return slug;
}
