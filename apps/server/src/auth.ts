import jwt from 'jsonwebtoken';
import type { AuthClaims } from './types.js';

export const jwtSecret = process.env.JWT_SECRET ?? 'deskora-dev-secret';

export function signToken(claims: AuthClaims): string {
  return jwt.sign(claims, jwtSecret, { expiresIn: '8h' });
}

export function verifyToken(token: string): AuthClaims {
  return jwt.verify(token, jwtSecret) as AuthClaims;
}
