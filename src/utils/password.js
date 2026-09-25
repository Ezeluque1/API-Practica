import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/** Hashea una contrasena en texto plano. */
export function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/** Compara una contrasena en texto plano contra su hash. */
export function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}
