import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import { env } from './env.js';

// Ruta relativa a ESTE archivo, no al cwd: asi funciona igual arrancando desde
// la raiz del proyecto o desde donde Render ejecute el proceso.
const openapiPath = new URL('../../docs/openapi.yaml', import.meta.url);

// Mismo criterio que config/env.js: si la documentacion esta rota, el proceso
// muere aca con un mensaje claro en vez de servir una UI vacia sin explicacion.
function cargarSpec() {
  let contenido;

  try {
    contenido = readFileSync(openapiPath, 'utf8');
  } catch {
    console.error(`No se encontro el archivo de documentacion: ${openapiPath.pathname}`);
    process.exit(1);
  }

  try {
    return YAML.parse(contenido);
  } catch (error) {
    console.error('Error de sintaxis en docs/openapi.yaml:');
    // El parser de `yaml` incluye la linea y la columna del problema.
    console.error(`  ${error.message}`);
    process.exit(1);
  }
}

const spec = cargarSpec();

// Swagger UI preselecciona el primer server de la lista, y el boton "Try it
// out" dispara requests reales contra el que quede elegido. Corriendo en local
// se pone localhost primero, para que nadie termine escribiendo en la base de
// produccion sin querer; en Render queda el orden del YAML (produccion primero).
if (env.isDev && Array.isArray(spec.servers)) {
  spec.servers = [...spec.servers].sort((a, b) => {
    const local = (s) => (s.url.includes('localhost') ? 0 : 1);
    return local(a) - local(b);
  });
}

export const openapiSpec = spec;

export default openapiSpec;
