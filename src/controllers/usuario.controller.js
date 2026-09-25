import * as usuarioService from '../services/usuario.service.js';

export async function registrar(req, res) {
  const usuario = await usuarioService.registrar(req.body);

  res.status(201).json({
    success: true,
    data: usuario,
  });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const resultado = await usuarioService.login(email, password);

  res.json({
    success: true,
    data: resultado,
  });
}

export async function logout(req, res) {
  const { refreshToken } = req.body;

  await usuarioService.logout(refreshToken);

  res.json({
    success: true,
    message: 'Sesión cerrada correctamente',
  });
}

export async function obtenerPerfil(req, res) {
  const usuario = await usuarioService.obtenerPerfil(req.user.id);

  res.json({
    success: true,
    data: usuario,
  });
}

export async function actualizarPerfil(req, res) {
  const usuario = await usuarioService.actualizarPerfil(
    req.user.id,
    req.body,
  );

  res.json({
    success: true,
    data: usuario,
  });
}

export async function recuperarPassword(req, res) {
  const resultado = await usuarioService.recuperarPassword(req.body.email);

  res.json({
    success: true,
    data: resultado,
  });
}

export async function resetPassword(req, res) {
  const { token, password } = req.body;

  const resultado = await usuarioService.resetPassword(token, password);

  res.json({
    success: true,
    message: resultado.message,
  });
}

export async function listarUsuarios(_req, res) {
  const usuarios = await usuarioService.listarUsuarios();

  res.json({
    success: true,
    data: usuarios,
  });
}

export async function buscarUsuarios(req, res) {
  const { buscar } = req.validated.query;

  const usuarios = await usuarioService.buscarUsuarios(buscar);

  res.json({
    success: true,
    data: usuarios,
  });
}

export async function cambiarRol(req, res) {
  const usuario = await usuarioService.cambiarRol(
    req.validated.params.id,
    req.body.rol,
    req.user.id,
  );

  res.json({
    success: true,
    data: usuario,
  });
}

export async function desactivarUsuario(req, res) {
  const usuario = await usuarioService.desactivarUsuario(
    req.validated.params.id,
    req.user.id,
  );

  res.json({
    success: true,
    data: usuario,
  });
}