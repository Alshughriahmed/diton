import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.AGE_JWT_SECRET || 'dev-age-secret-change-in-production';
const secret = new TextEncoder().encode(JWT_SECRET);

export async function signAgeJWT(): Promise<string> {
  return await new SignJWT({ age_verified: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1y')
    .sign(secret);
}

export async function verifyAgeJWT(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.age_verified === true;
  } catch {
    return false;
  }
}
