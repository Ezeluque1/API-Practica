-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'USUARIO');

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('PRESENCIAL', 'VIRTUAL', 'HIBRIDA');

-- CreateEnum
CREATE TYPE "TipoPublicacion" AS ENUM ('NOTICIA', 'EVENTO');

-- CreateEnum
CREATE TYPE "EstadoMensaje" AS ENUM ('NO_LEIDO', 'LEIDO', 'RESPONDIDO');

-- CreateTable
CREATE TABLE "Sede" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carrera" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descripcion" TEXT,
    "duracionAnios" INTEGER,
    "tituloOtorgado" TEXT,
    "modalidad" "Modalidad" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carrera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarreraSede" (
    "carreraId" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,

    CONSTRAINT "CarreraSede_pkey" PRIMARY KEY ("carreraId","sedeId")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'USUARIO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revocado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publicacion" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "resumen" TEXT,
    "contenido" TEXT NOT NULL,
    "tipo" "TipoPublicacion" NOT NULL,
    "imagenUrl" TEXT,
    "fechaEvento" TIMESTAMP(3),
    "destacada" BOOLEAN NOT NULL DEFAULT false,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensajeContacto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "asunto" TEXT,
    "mensaje" TEXT NOT NULL,
    "estado" "EstadoMensaje" NOT NULL DEFAULT 'NO_LEIDO',
    "respuesta" TEXT,
    "respondidoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensajeContacto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sede_ciudad_idx" ON "Sede"("ciudad");

-- CreateIndex
CREATE INDEX "Sede_provincia_idx" ON "Sede"("provincia");

-- CreateIndex
CREATE INDEX "Sede_nombre_idx" ON "Sede"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Carrera_slug_key" ON "Carrera"("slug");

-- CreateIndex
CREATE INDEX "Carrera_nombre_idx" ON "Carrera"("nombre");

-- CreateIndex
CREATE INDEX "Carrera_modalidad_idx" ON "Carrera"("modalidad");

-- CreateIndex
CREATE INDEX "Carrera_activa_idx" ON "Carrera"("activa");

-- CreateIndex
CREATE INDEX "CarreraSede_sedeId_idx" ON "CarreraSede"("sedeId");

-- CreateIndex
CREATE INDEX "CarreraSede_carreraId_idx" ON "CarreraSede"("carreraId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_dni_key" ON "Usuario"("dni");

-- CreateIndex
CREATE INDEX "Usuario_nombre_apellido_idx" ON "Usuario"("nombre", "apellido");

-- CreateIndex
CREATE INDEX "Usuario_email_idx" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_dni_idx" ON "Usuario"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_usuarioId_idx" ON "PasswordResetToken"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_usuarioId_idx" ON "RefreshToken"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Publicacion_slug_key" ON "Publicacion"("slug");

-- CreateIndex
CREATE INDEX "Publicacion_tipo_idx" ON "Publicacion"("tipo");

-- CreateIndex
CREATE INDEX "Publicacion_createdAt_idx" ON "Publicacion"("createdAt");

-- CreateIndex
CREATE INDEX "Publicacion_fechaEvento_idx" ON "Publicacion"("fechaEvento");

-- CreateIndex
CREATE INDEX "Publicacion_titulo_idx" ON "Publicacion"("titulo");

-- CreateIndex
CREATE INDEX "Publicacion_destacada_idx" ON "Publicacion"("destacada");

-- CreateIndex
CREATE INDEX "MensajeContacto_nombre_idx" ON "MensajeContacto"("nombre");

-- CreateIndex
CREATE INDEX "MensajeContacto_email_idx" ON "MensajeContacto"("email");

-- CreateIndex
CREATE INDEX "MensajeContacto_estado_idx" ON "MensajeContacto"("estado");

-- AddForeignKey
ALTER TABLE "CarreraSede" ADD CONSTRAINT "CarreraSede_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarreraSede" ADD CONSTRAINT "CarreraSede_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publicacion" ADD CONSTRAINT "Publicacion_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

