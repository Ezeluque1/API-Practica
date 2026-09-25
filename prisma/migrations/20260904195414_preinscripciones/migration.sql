-- CreateTable
CREATE TABLE "Preinscripcion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "fechaNacimiento" DATE NOT NULL,
    "nacionalidad" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "carreraId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preinscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Preinscripcion_carreraId_idx" ON "Preinscripcion"("carreraId");

-- CreateIndex
CREATE INDEX "Preinscripcion_createdAt_idx" ON "Preinscripcion"("createdAt");

-- CreateIndex
CREATE INDEX "Preinscripcion_apellido_nombre_idx" ON "Preinscripcion"("apellido", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Preinscripcion_documento_carreraId_key" ON "Preinscripcion"("documento", "carreraId");

-- AddForeignKey
ALTER TABLE "Preinscripcion" ADD CONSTRAINT "Preinscripcion_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
