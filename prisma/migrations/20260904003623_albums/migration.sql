-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "portadaId" TEXT,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Imagen" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "formato" TEXT,
    "bytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Imagen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Album_slug_key" ON "Album"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Album_portadaId_key" ON "Album"("portadaId");

-- CreateIndex
CREATE INDEX "Album_activo_idx" ON "Album"("activo");

-- CreateIndex
CREATE INDEX "Album_fecha_idx" ON "Album"("fecha");

-- CreateIndex
CREATE INDEX "Album_titulo_idx" ON "Album"("titulo");

-- CreateIndex
CREATE UNIQUE INDEX "Imagen_publicId_key" ON "Imagen"("publicId");

-- CreateIndex
CREATE INDEX "Imagen_albumId_idx" ON "Imagen"("albumId");

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_portadaId_fkey" FOREIGN KEY ("portadaId") REFERENCES "Imagen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Imagen" ADD CONSTRAINT "Imagen_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
