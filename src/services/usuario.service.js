import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import {
  hashPassword,
  comparePassword,
} from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { usuarioPublicSelect } from '../models/usuario.model.js';
import crypto from 'node:crypto';

export async function registrar(datos) {
  const { nombre, apellido, email, dni, password } = datos;

  const usuarioExistente = await prisma.usuario.findFirst({
    where: {
      OR: [
        { email },
        { dni },
      ],
    },
  });

  if (usuarioExistente) {
    throw ApiError.conflict('Ya existe un usuario con ese email o DNI');
  }

  const passwordHash = await hashPassword(password);

  return prisma.usuario.create({
    data: {
      nombre,
      apellido,
      email,
      dni,
      passwordHash,
    },
    select: usuarioPublicSelect,
  });
}

export async function login(email, password) {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
  });

  if (!usuario) {
    throw ApiError.unauthorized('Email o contraseña incorrectos');
  }

  if (!usuario.activo) {
    throw ApiError.unauthorized('La cuenta está desactivada');
  }

  const passwordCorrecta = await comparePassword(
    password,
    usuario.passwordHash,
  );

  if (!passwordCorrecta) {
    throw ApiError.unauthorized('Email o contraseña incorrectos');
  }

  // Token de acceso de corta duración
  const accessToken = signToken({
    sub: usuario.id,
    rol: usuario.rol,
  });

  // Token aleatorio para mantener/invalidate la sesión
  const refreshToken = crypto.randomBytes(48).toString('hex');

  // Guardamos el refresh token en la base de datos
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      usuarioId: usuario.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    accessToken,
    refreshToken,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      dni: usuario.dni,
      rol: usuario.rol,
      activo: usuario.activo,
    },
  };
}

export async function logout(refreshToken) {
  const token = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!token) {
    throw ApiError.notFound('Refresh token no encontrado');
  }

  if (token.revocado) {
    return;
  }

  await prisma.refreshToken.update({
    where: { token: refreshToken },
    data: { revocado: true },
  });
}

export async function obtenerPerfil(usuarioId) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: usuarioPublicSelect,
  });

  if (!usuario) {
    throw ApiError.notFound('Usuario no encontrado');
  }

  return usuario;
}

export async function actualizarPerfil(usuarioId, datos) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
  });

  if (!usuario) {
    throw ApiError.notFound('Usuario no encontrado');
  }

  return prisma.usuario.update({
    where: { id: usuarioId },
    data: datos,
    select: usuarioPublicSelect,
  });
}

export async function recuperarPassword(email) {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
  });

  if (!usuario) {
    throw ApiError.notFound('Usuario no encontrado');
  }

  if (!usuario.activo) {
    throw ApiError.unauthorized('La cuenta está desactivada');
  }

  // Generamos un token aleatorio seguro.
  const token = crypto.randomBytes(32).toString('hex');

  // El token será válido durante 1 hora.
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      token,
      usuarioId: usuario.id,
      expiresAt,
    },
  });

  return {
    message: 'Token de recuperación generado',
    token,
  };
}

export async function resetPassword(token, password) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken) {
    throw ApiError.notFound('Token de recuperación no encontrado');
  }

  if (resetToken.usado) {
    throw ApiError.badRequest('El token de recuperación ya fue utilizado');
  }

  if (resetToken.expiresAt < new Date()) {
    throw ApiError.badRequest('El token de recuperación expiró');
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: resetToken.usuarioId },
      data: { passwordHash },
    }),

    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usado: true },
    }),
  ]);

  return {
    message: 'Contraseña actualizada correctamente',
  };
}

export async function listarUsuarios() {
  return prisma.usuario.findMany({
    select: usuarioPublicSelect,
    orderBy: [
      { apellido: 'asc' },
      { nombre: 'asc' },
    ],
  });
}

export async function buscarUsuarios(buscar) {
  return prisma.usuario.findMany({
    where: {
      OR: [
        {
          nombre: {
            contains: buscar,
            mode: 'insensitive',
          },
        },
        {
          apellido: {
            contains: buscar,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: buscar,
            mode: 'insensitive',
          },
        },
        {
          dni: {
            contains: buscar,
            mode: 'insensitive',
          },
        },
      ],
    },
    select: usuarioPublicSelect,
    orderBy: [
      { apellido: 'asc' },
      { nombre: 'asc' },
    ],
  });
}

export async function cambiarRol(usuarioId, rol, adminId) {
  // Un administrador no puede quitarse su propio rol
  if (usuarioId === adminId && rol !== 'ADMIN') {
    throw ApiError.badRequest(
      'No podes quitarte tu propio rol de administrador',
    );
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
  });

  if (!usuario) {
    throw ApiError.notFound('Usuario no encontrado');
  }

  // No permitir dejar el sistema sin administradores
  if (usuario.rol === 'ADMIN' && rol !== 'ADMIN') {
    const cantidadAdmins = await prisma.usuario.count({
      where: {
        rol: 'ADMIN',
        activo: true,
      },
    });

    if (cantidadAdmins <= 1) {
      throw ApiError.badRequest(
        'No se puede quitar el rol al último administrador',
      );
    }
  }

  return prisma.usuario.update({
    where: { id: usuarioId },
    data: { rol },
    select: usuarioPublicSelect,
  });
}

export async function desactivarUsuario(usuarioId, adminId) {
  if (usuarioId === adminId) {
    throw ApiError.badRequest(
      'No podes desactivar tu propia cuenta de administrador',
    );
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
  });

  if (!usuario) {
    throw ApiError.notFound('Usuario no encontrado');
  }

  if (!usuario.activo) {
    throw ApiError.badRequest('El usuario ya está desactivado');
  }

  if (usuario.rol === 'ADMIN') {
    const cantidadAdmins = await prisma.usuario.count({
      where: {
        rol: 'ADMIN',
        activo: true,
      },
    });

    if (cantidadAdmins <= 1) {
      throw ApiError.badRequest(
        'No se puede desactivar al último administrador',
      );
    }
  }

  return prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      activo: false,
    },
    select: usuarioPublicSelect,
  });
}