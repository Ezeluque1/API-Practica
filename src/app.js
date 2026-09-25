import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { openapiSpec } from './config/swagger.js';
import routes from './routes/index.js';
import { responseHelpers } from './middlewares/response.middleware.js';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware.js';

const app = express();

// Render (y cualquier PaaS) corre la app detras de un proxy: sin esto `req.ip`
// y morgan registran la IP del proxy en vez de la del cliente real.
app.set('trust proxy', 1);

// Seguridad y logging
app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(morgan(env.isDev ? 'dev' : 'combined'));

// Parseo del body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Atajos res.ok() / res.created() / res.noContent() para que las respuestas
// exitosas salgan todas iguales. Tiene que ir antes de las rutas.
app.use(responseHelpers);

// Documentacion. La fuente es docs/openapi.yaml, los routers quedan limpios.
// Se monta antes que las rutas para que /api/docs no caiga en el router de /api.
app.get('/api/docs.json', (_req, res) => res.json(openapiSpec));
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'API Instituto - Docs',
  }),
);

// Rutas de la API
app.use('/api', routes);

// 404 y manejo de errores: siempre al final, en este orden.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
