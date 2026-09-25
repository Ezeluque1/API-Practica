-- AlterTable
ALTER TABLE "Sede" ADD COLUMN     "activa" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Sede_activa_idx" ON "Sede"("activa");

