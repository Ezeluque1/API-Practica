import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import sedeRoutes from './sede.routes.js';
import usuarioRoutes from './usuario.routes.js';
import publicacionRoutes from './publicacion.routes.js';
import contactoRoutes from './contacto.routes.js';
import carreraRoutes from './carrera.routes.js';
import albumRoutes from './album.routes.js';
import preinscripcionRoutes from './preinscripcion.routes.js';
import informacionInstitucionalRoutes from './informacionInstitucional.routes.js';

const router = Router();

// Health check: no alcanza con responder "ok", tambien verifica que la
// conexion a PostgreSQL este viva.
router.get('/health', async (_req, res) => {
  let database = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'disconnected';
  }
  res.status(database === 'connected' ? 200 : 503).json({
    status: database === 'connected' ? 'ok' : 'degraded',
    database,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Un router por recurso. Mirar sede.routes.js como referencia.
router.use('/sedes', sedeRoutes);
router.use('/sedes', informacionInstitucionalRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/publicaciones', publicacionRoutes);
router.use('/contacto', contactoRoutes);
router.use('/carreras', carreraRoutes);
router.use('/albums', albumRoutes);
router.use('/preinscripciones', preinscripcionRoutes);

export default router;