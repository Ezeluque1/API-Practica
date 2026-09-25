-- CreateTable
CREATE TABLE "InformacionInstitucional" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "lema" TEXT,
    "historia" TEXT,
    "mision" TEXT,
    "vision" TEXT,
    "sedeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InformacionInstitucional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Autoridad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "imagen" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "descripcion" TEXT,
    "informacionInstitucionalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Autoridad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InformacionInstitucional_sedeId_key" ON "InformacionInstitucional"("sedeId");

-- CreateIndex
CREATE INDEX "InformacionInstitucional_sedeId_idx" ON "InformacionInstitucional"("sedeId");

-- CreateIndex
CREATE INDEX "Autoridad_informacionInstitucionalId_idx" ON "Autoridad"("informacionInstitucionalId");

-- CreateIndex
CREATE INDEX "Autoridad_orden_idx" ON "Autoridad"("orden");

-- AddForeignKey
ALTER TABLE "InformacionInstitucional" ADD CONSTRAINT "InformacionInstitucional_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autoridad" ADD CONSTRAINT "Autoridad_informacionInstitucionalId_fkey" FOREIGN KEY ("informacionInstitucionalId") REFERENCES "InformacionInstitucional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
