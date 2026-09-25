import { cloudinary } from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Unico modulo que sabe que existe Cloudinary.
 *
 * El resto de la app habla en terminos de "subi este buffer y dame una url".
 * Si algun dia se cambia de proveedor (S3, Supabase, lo que sea), se reescribe
 * este archivo mas config/cloudinary.js y nada mas.
 */

/** Carpeta donde vive un album dentro de Cloudinary. */
export function carpetaDelAlbum(albumId) {
  return `${env.CLOUDINARY_FOLDER}/${albumId}`;
}

/**
 * Carpeta donde viven las imagenes de las carreras.
 *
 * Sin subcarpeta por carrera: como hay una sola imagen por carrera, una
 * carpeta por id seria una carpeta con un unico archivo adentro. Van todas
 * juntas y Cloudinary asigna el public_id.
 *
 * OJO al leerlo en el panel de Cloudinary: el resultado es
 * "instituto/albums/carreras" y no "instituto/carreras", porque
 * CLOUDINARY_FOLDER arrastra el nombre de cuando lo unico que subiamos eran
 * albums. Es raro pero deliberado: renombrar la variable obligaria a tocar el
 * .env de todo el equipo y el de Render.
 */
export function carpetaDeCarreras() {
  return `${env.CLOUDINARY_FOLDER}/carreras`;
}

/**
 * Sube un buffer a Cloudinary y devuelve solo lo que guardamos en la base.
 *
 * El SDK expone `upload_stream` con callback (no hay version que devuelva
 * promesa), asi que se envuelve a mano. Se usa el stream y no `upload()` con
 * un path porque el archivo nunca toca el disco: en Render el disco es efimero.
 *
 * @param {Buffer} buffer Contenido del archivo, tal como lo dejo multer.
 * @param {{ carpeta: string }} opciones
 * @returns {Promise<{ url: string, publicId: string, width: number|null,
 *   height: number|null, formato: string|null, bytes: number|null }>}
 */
export function subirImagen(buffer, { carpeta }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: carpeta,
        // Esta es la defensa que vale: Cloudinary decodifica el archivo y
        // rechaza lo que no sea una imagen de verdad. El filtro de mimetype de
        // multer es solo la primera barrera y es falsificable, porque el
        // mimetype lo declara el cliente.
        resource_type: 'image',
        // A proposito NO se pasa `transformation` aca: una transformacion en el
        // upload hace que Cloudinary re-codifique y **reemplace el original**,
        // que se pierde para siempre. Se guarda la foto tal cual llego.
        //
        // La optimizacion va en la URL de entrega, donde ademas se adapta al
        // navegador de cada visitante:
        //   .../upload/w_400,q_auto,f_auto/...
        // Eso es trabajo del front y no consume storage extra.
      },
      (error, resultado) => {
        if (error) return reject(error);
        resolve({
          url: resultado.secure_url,
          publicId: resultado.public_id,
          width: resultado.width ?? null,
          height: resultado.height ?? null,
          formato: resultado.format ?? null,
          bytes: resultado.bytes ?? null,
        });
      },
    );

    stream.end(buffer);
  });
}

/**
 * Borra un archivo de Cloudinary.
 *
 * Es idempotente: si el archivo ya no esta, Cloudinary responde
 * `result: 'not found'` en vez de fallar, y para nosotros eso es exito. Lo que
 * importa es el estado final (el archivo no esta), no quien lo borro.
 *
 * @param {string} publicId
 */
export async function borrarImagen(publicId) {
  const resultado = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    // Invalida la copia cacheada en el CDN, si no la imagen sigue accesible
    // por su URL un rato largo despues de borrada.
    invalidate: true,
  });

  if (resultado.result !== 'ok' && resultado.result !== 'not found') {
    throw ApiError.internal('No se pudo borrar la imagen del servicio de imagenes', {
      publicId,
      resultado: resultado.result,
    });
  }
}

/**
 * Borra varios archivos sin cortar ante el primer fallo.
 *
 * Se usa para compensar cuando una subida se cae a mitad de camino: en ese
 * punto ya estamos manejando un error, y hacer fallar la limpieza solo
 * cambiaria el error que ve el usuario por uno peor. Lo que no se pudo borrar
 * queda logueado y se limpia a mano desde el panel de Cloudinary.
 *
 * @param {string[]} publicIds
 */
export async function borrarImagenes(publicIds) {
  await Promise.all(
    publicIds.map(async (publicId) => {
      try {
        await borrarImagen(publicId);
      } catch (error) {
        console.error(
          `[storage] quedo huerfana en Cloudinary la imagen ${publicId}:`,
          error?.message ?? error,
        );
      }
    }),
  );
}
