import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

// Configuracion global del SDK. Se hace una sola vez al importar el modulo:
// el cliente de Cloudinary es stateless (firma cada request con la api_secret),
// asi que no hace falta el truco del singleton en globalThis que usa prisma.js.
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  // Fuerza https en las URLs que devuelve. Sin esto vienen en http y el
  // navegador las bloquea como contenido mixto en un sitio servido por https.
  secure: true,
});

export { cloudinary };
export default cloudinary;
