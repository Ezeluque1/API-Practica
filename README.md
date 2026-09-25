# API Instituto

Backend REST con **Node.js + Express 5 + Prisma 6 + PostgreSQL**, en ESM y organizado por capas.

Produccion: https://api-instituto.onrender.com/api/health

## Requisitos

| | Version | Como verificar |
|---|---|---|
| Node.js | 22 o superior | `node -v` |
| npm | 10 o superior | `npm -v` |
| PostgreSQL | 16 o 17, corriendo en local | `pg_isready` |
| Git | cualquiera | `git --version` |

## Puesta en marcha (primera vez)

### 1. Clonar e instalar

```bash
git clone https://github.com/Ezeluque1/API-Instituto.git
cd API-Instituto
npm install
```

### 2. Crear la base de datos local

Cada uno trabaja contra su propia base local, **no** contra la de produccion.

```bash
# macOS / Linux
createdb instituto

# Windows (si `psql` no esta en el PATH, usar la ruta completa de la instalacion)
"C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres instituto
```

Si `createdb` te pide password, es la que pusiste al instalar PostgreSQL.

### 3. Configurar el entorno

```bash
cp .env.example .env
```

Y editar el `.env` recien creado:

- **`DATABASE_URL`**: reemplazar `TU_PASSWORD` por la password de tu PostgreSQL
  local. Si el usuario no es `postgres` o el puerto no es el 5432, ajustarlos
  tambien.
- **`JWT_SECRET`**: generar uno propio (tiene que tener 16 caracteres como
  minimo o la app no arranca):

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

- **`CLOUDINARY_*`**: son las credenciales de la cuenta de Cloudinary donde se
  suben las fotos de los albums. **El equipo usa una sola cuenta compartida**:
  pedile las tres a quien la creo y pegalas tal cual. Estan en el dashboard de
  Cloudinary, arriba de todo, en *Product Environment Credentials*.

  Son obligatorias: **sin ellas el server no arranca**, aunque no vayas a tocar
  el modulo de albums. Es a proposito, para que nadie descubra que faltan recien
  cuando alguien intenta subir una foto.

El `.env` esta en el `.gitignore`: **nunca** se commitea. Si agregas una
variable nueva, sumala tambien a `.env.example` (sin el valor real) para que al
resto no le falte.

### 4. Crear las tablas

```bash
npx prisma migrate dev
```

Aplica las migraciones que ya estan en `prisma/migrations/` y genera el cliente
de Prisma. **No** le pases `--name`: las migraciones ya existen, ese flag es
solo para cuando creas una nueva.

### 5. Levantar

```bash
npm run dev
```

Y comprobar en otra terminal:

```bash
curl http://localhost:3000/api/health
```

Tiene que responder `{"status":"ok","database":"connected"}`. Si dice
`"database":"disconnected"`, el `DATABASE_URL` esta mal (ver Problemas comunes).

## Trabajo diario

**Despues de cada `git pull`**, si vinieron cambios en `prisma/`:

```bash
npm install          # por si entraron dependencias nuevas
npx prisma migrate dev
```

**Si tocas `prisma/schema.prisma`**, generar la migracion y commitearla:

```bash
npx prisma migrate dev --name descripcion_del_cambio
```

Eso crea una carpeta nueva en `prisma/migrations/`. **Hay que commitearla**: es
lo que Render aplica en produccion durante el build. Si la olvidas, el deploy
levanta con el schema viejo y las queries fallan.

**Para mirar los datos** sin escribir SQL:

```bash
npm run prisma:studio
```

## Respuestas de la API

Para que el front no tenga que adivinar, todas las respuestas siguen esta tabla:

| Caso | Status | Body |
|---|---|---|
| `GET` de un recurso | 200 | el objeto |
| `GET` de un listado | 200 | un array (`[]` si no hay nada, **nunca** 404) |
| `POST` que crea | 201 | el objeto creado + header `Location` |
| `PUT` / `PATCH` | 200 | el objeto actualizado |
| `DELETE` | 204 | vacio, sin body |
| Cualquier error | 4xx / 5xx | `{ success: false, message, details? }` |

**En exito el body es el recurso pelado, sin sobre.** No hay `{ success: true,
data: ... }`: si pediste una sede te llega la sede.

Los controllers no arman esto a mano, usan los atajos que agrega
`src/middlewares/response.middleware.js`:

```js
res.ok(sede);                              // 200 + el objeto
res.ok(sedes);                             // 200 + el array (vacio incluido)
res.created(sede, `/api/sedes/${sede.id}`); // 201 + header Location
res.noContent();                           // 204 sin body
```

### Por que exito y error tienen formas distintas

Es a proposito, no una inconsistencia que haya que "arreglar". El front decide
por el **status HTTP**, no por una propiedad del body:

```js
const res = await fetch('/api/sedes');
if (!res.ok) {
  const { message } = await res.json();   // forma de error
  throw new Error(message);
}
const sedes = await res.json();           // el recurso, directo
```

Dos detalles que evitan bugs del lado del front:

- Un listado sin resultados devuelve `200 []`, no un 404. El 404 queda
  reservado para cuando el recurso pedido no existe.
- Un `204` no lleva body: llamar a `.json()` sobre esa respuesta explota. Hay
  que chequear el status antes de parsear.

## Documentacion (Swagger)

| | URL |
|---|---|
| Local | http://localhost:3000/api/docs |
| Produccion | https://api-instituto.onrender.com/api/docs |
| Spec crudo (para Postman) | `/api/docs.json` |

**Toda la documentacion se escribe en `docs/openapi.yaml`**, nunca en los
routers: asi los routers quedan solo con logica de ruteo. No hay que configurar
nada, ya esta todo montado.

La primera vez que abras los docs vas a ver **"No operations defined in spec!"**.
No esta roto: `paths` arranca vacio a proposito y se va llenando a medida que se
implementan endpoints. Dentro del YAML hay un ejemplo completo comentado con un
CRUD de `Sede` para copiar y pegar.

Lo que ya viene resuelto y **no hay que volver a escribir**:

- `components/responses`: `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`,
  `Conflict` e `InternalError`. Son las respuestas del `errorHandler`
  centralizado, iguales en todos los endpoints. Se referencian asi:

  ```yaml
  responses:
    "404": { $ref: "#/components/responses/NotFound" }
  ```

- `components/securitySchemes/bearerAuth`: para marcar un endpoint como
  protegido alcanza con `security: [{ bearerAuth: [] }]`. En la UI, el boton
  **Authorize** pide el token (sin el prefijo `Bearer`, lo agrega sola).

Un par de detalles:

- Las rutas se escriben **sin** el prefijo `/api`, porque ya esta en `servers`:
  el endpoint `GET /api/sedes` se documenta como `/sedes`.
- Si el YAML queda mal escrito, **el server no arranca** y te dice el archivo y
  la linea del error. Es a proposito: mejor enterarse al arrancar que servir
  documentacion rota.
- El selector de **Servers** apunta a `localhost` cuando corres en local y a
  produccion cuando entras por la URL de Render, para que "Try it out" no te
  escriba en la base equivocada. Igual conviene mirarlo antes de ejecutar algo.

## Scripts

| Script | Que hace |
|---|---|
| `npm run dev` | Levanta con recarga automatica (`node --watch`, sin nodemon) |
| `npm start` | Levanta en modo produccion |
| `npm run prisma:migrate` | Crea y aplica una migracion (desarrollo) |
| `npm run prisma:deploy` | Aplica migraciones existentes sin crear ninguna (produccion) |
| `npm run prisma:generate` | Regenera el cliente de Prisma |
| `npm run prisma:studio` | Abre el explorador visual de la base |

## Variables de entorno

| Variable | Descripcion | Default |
|---|---|---|
| `NODE_ENV` | `development` \| `production` \| `test` | `development` |
| `PORT` | Puerto de la API | `3000` |
| `DATABASE_URL` | Cadena de conexion a PostgreSQL | — (obligatoria) |
| `JWT_SECRET` | Secreto para firmar los tokens (min. 16 caracteres) | — (obligatoria) |
| `JWT_EXPIRES_IN` | Duracion del token | `1d` |
| `CORS_ORIGIN` | `*` o lista de origenes separada por comas | `*` |
| `CLOUDINARY_CLOUD_NAME` | Cuenta de Cloudinary donde se suben las fotos | — (obligatoria) |
| `CLOUDINARY_API_KEY` | Credencial de Cloudinary | — (obligatoria) |
| `CLOUDINARY_API_SECRET` | Credencial de Cloudinary. **No se comparte fuera del equipo** | — (obligatoria) |
| `CLOUDINARY_FOLDER` | Carpeta raiz dentro de Cloudinary | `instituto/albums` |

`src/config/env.js` las valida con Zod al arrancar: si falta alguna, el proceso
muere con un mensaje claro en vez de fallar despues con un `undefined`.

## Estructura

```
src/
├── controllers/   Leen la request, llaman al service, arman la response
├── models/        Schemas de Zod + `select` de Prisma reutilizables
├── routes/        Definen endpoints y encadenan middlewares
├── services/      Logica de negocio + consultas Prisma
├── middlewares/   Errores, validacion, autenticacion, respuestas, subida de archivos
├── config/        Variables de entorno, clientes de Prisma y Cloudinary, carga del spec
├── utils/         ApiError, JWT, hashing de passwords, slugs
├── app.js         Arma la app de Express y la exporta
└── server.js      Hace el listen() y el apagado ordenado

docs/
└── openapi.yaml   Documentacion de la API (se sirve en /api/docs)

prisma/
├── schema.prisma  Modelos de datos
└── migrations/    Migraciones versionadas (commitear siempre)
```

Los **modelos de datos** viven en `prisma/schema.prisma` (esa es la fuente de
verdad de Prisma). La carpeta `src/models/` guarda los schemas de Zod y los
`select` reutilizables de cada entidad.

## Como agregar un recurso nuevo

Los modelos ya estan definidos en `prisma/schema.prisma`. Ejemplo con `Sede`,
recorriendo las 5 capas:

**1. `src/models/sede.model.js`** — validacion (Zod) y campos expuestos:

```js
import { z } from 'zod';

export const sedePublicSelect = {
  id: true, nombre: true, ciudad: true, provincia: true,
  direccion: true, telefono: true, email: true,
};

export const crearSedeSchema = z.object({
  nombre: z.string().min(1),
  ciudad: z.string().min(1),
  provincia: z.string().min(1),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.email().optional(),
});

export const idParamSchema = z.object({ id: z.string().cuid() });
```

**2. `src/services/sede.service.js`** — logica de negocio y acceso a datos:

```js
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { sedePublicSelect } from '../models/sede.model.js';

export async function listar() {
  return prisma.sede.findMany({ select: sedePublicSelect, orderBy: { nombre: 'asc' } });
}

export async function obtenerPorId(id) {
  const sede = await prisma.sede.findUnique({ where: { id }, select: sedePublicSelect });
  if (!sede) throw ApiError.notFound('Sede no encontrada');
  return sede;
}

export async function crear(datos) {
  return prisma.sede.create({ data: datos, select: sedePublicSelect });
}
```

**3. `src/controllers/sede.controller.js`** — fino, sin logica de negocio:

```js
import * as sedeService from '../services/sede.service.js';

export async function listar(_req, res) {
  res.ok(await sedeService.listar());
}

export async function crear(req, res) {
  const sede = await sedeService.crear(req.body);
  res.created(sede, `/api/sedes/${sede.id}`);
}

export async function eliminar(req, res) {
  await sedeService.eliminar(req.params.id);
  res.noContent();
}
```

**4. `src/routes/sede.routes.js`** — endpoints y middlewares:

```js
import { Router } from 'express';
import * as controller from '../controllers/sede.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { crearSedeSchema } from '../models/sede.model.js';

const router = Router();

router.get('/', controller.listar);
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate({ body: crearSedeSchema }),
  controller.crear,
);

export default router;
```

**5. `src/routes/index.js`** — montarlo:

```js
import sedeRoutes from './sede.routes.js';
router.use('/sedes', sedeRoutes);
```

**6. `docs/openapi.yaml`** — documentar los endpoints nuevos (ver la seccion
Documentacion, mas arriba). Un endpoint sin documentar es un endpoint que el
resto del equipo no sabe que existe.

Si ademas cambias `prisma/schema.prisma`, correr `npm run prisma:migrate` para
generar la migracion y commitear la carpeta `prisma/migrations/`: es lo que
Render aplica en produccion.

## Imagenes (albums)

Las fotos **no se guardan en el servidor**. El flujo es:

```
navegador --(multipart)--> API --> Cloudinary
                            |
                            +--> Postgres: solo la URL
```

El disco de Render es efimero y se borra en cada deploy, asi que una foto
escrita ahi se perderia. La API recibe el archivo en memoria, lo manda a
Cloudinary por stream y guarda en la base la URL publica mas el identificador
interno que hace falta para poder borrarlo despues.

Limites, definidos en `src/middlewares/upload.middleware.js`:

| | |
|---|---|
| Tamano por archivo | 5 MB |
| Archivos por request | 5 |
| Formatos | JPEG, PNG, WebP, AVIF |

Los numeros son bajos a proposito: los archivos viven **enteros en RAM** hasta
que terminan de subirse, y la instancia free de Render tiene 512 MB.

**Miniaturas: no hay que generarlas.** Cloudinary las arma desde la misma URL
insertando transformaciones. Para una tarjeta de 400px de ancho:

```
https://res.cloudinary.com/<cuenta>/image/upload/w_400,q_auto,f_auto/<resto>
```

No consume storage extra y es trabajo del front.

**Que se borra y que no.** `DELETE /api/albums/:id` es una **baja logica**: el
album deja de verse, pero sus fotos siguen ocupando lugar en Cloudinary. El
unico borrado real es `DELETE /api/albums/:id/imagenes/:imagenId`, que saca la
fila *y* el archivo de la nube.

Todo lo que sabe que existe Cloudinary vive en `src/config/cloudinary.js` y
`src/services/storage.service.js`. Cambiar de proveedor toca esos dos archivos
y ninguno mas.

## Problemas comunes

**`Authentication failed against database server`**
La password del `DATABASE_URL` no coincide con la de tu PostgreSQL local. Es el
error mas frecuente al arrancar: revisa que hayas reemplazado `TU_PASSWORD` en
el `.env`. Si la password tiene caracteres raros (`@`, `:`, `/`, `#`), hay que
escaparlos en URL: una `@` se escribe `%40`.

**`Can't reach database server at localhost:5432`**
PostgreSQL no esta corriendo. En Windows se levanta desde Servicios
(`services.msc` → `postgresql-x64-17`); en macOS con `brew services start
postgresql@17`; en Linux con `sudo systemctl start postgresql`.

**`database "instituto" does not exist`**
Falto el paso 2 de la puesta en marcha: crear la base con `createdb`.

**`Error en las variables de entorno (.env)`**
La validacion de `src/config/env.js` corto el arranque y lista abajo que
variable falta o esta mal. Lo mas comun es un `JWT_SECRET` de menos de 16
caracteres. Compara tu `.env` contra `.env.example`.

**`EADDRINUSE: address already in use :::3000`**
Hay otro proceso en el puerto 3000, casi siempre un `npm run dev` que quedo
colgado. Cambia el `PORT` en tu `.env` o cerra el proceso viejo.

**Cambiaste el `schema.prisma` y el codigo no ve el modelo nuevo**
El cliente de Prisma es codigo generado, no se actualiza solo: correr
`npx prisma migrate dev` (o `npm run prisma:generate` si no hubo cambios de
tablas). El editor puede necesitar recargar la ventana para tomar los tipos.

**`The migration ... was modified after it was applied`**
Alguien edito un archivo de `prisma/migrations/` que ya estaba aplicado. Las
migraciones son inmutables: para corregir algo se crea una migracion nueva. Si
es tu base local y no te importan los datos, `npx prisma migrate reset` la
recrea de cero.

**Queres mirar la base de produccion**
Usar la **External** Database URL de Render (la Internal solo funciona dentro de
Render):

```bash
DATABASE_URL="<External Database URL>" npx prisma studio
```

En PowerShell: `$env:DATABASE_URL="<External>"; npx prisma studio`.

## Deploy (Render)

El servicio esta configurado a mano en el dashboard de Render. Cada push a
`main` dispara un deploy automatico.

| Campo | Valor |
|---|---|
| Runtime | Node |
| Build Command | `npm ci && npx prisma generate && npx prisma migrate deploy` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Variables de entorno en Render: `NODE_ENV=production`, `DATABASE_URL` (Internal
Database URL de la base de Render), `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`
y las tres de `CLOUDINARY_*`. **`PORT` no se define**: Render la inyecta sola.

> Las de Cloudinary hay que cargarlas en el dashboard **antes** del primer
> deploy que incluya el modulo de albums, o el servicio no levanta.

Cosas a tener en cuenta con el plan free:

- El servicio **se duerme tras 15 minutos sin trafico**; el primer request
  despues tarda ~50 segundos. No es un bug.
- La **base free de Render se elimina a los 30 dias de creada.** Hay que migrar
  a un plan pago (o a Neon/Supabase) antes de esa fecha o se pierden los datos.
- La **Internal** Database URL solo funciona dentro de Render. Para correr
  `prisma studio` o migraciones desde tu maquina, usar la **External** URL.

## Notas

- **Express 5** propaga automaticamente los errores de los handlers `async` al
  `errorHandler`, asi que no hace falta envolverlos en un `asyncHandler`.
- **`req.query` es de solo lectura en Express 5.** El middleware `validate()`
  deja lo parseado en `req.validated.query` en lugar de sobrescribirlo.
- El manejo de errores esta centralizado en `src/middlewares/error.middleware.js`:
  desde un service alcanza con `throw ApiError.notFound(...)`. Ademas traduce los
  codigos de Prisma (`P2002` → 409, `P2025` → 404).
- Para emitir tokens, firmar con el id del usuario en `sub`:
  `signToken({ sub: usuario.id, rol: usuario.rol })`, que es lo que espera
  `authenticate`. Ese middleware relee el `Usuario` de la base en cada request y
  rechaza con 401 si esta `activo: false` (soft delete).
- Los ids del schema son `String` con `@default(cuid())`, no enteros: validar los
  path params con `z.string().cuid()`.
