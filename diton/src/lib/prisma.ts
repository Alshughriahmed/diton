/** Optional Prisma client to avoid build-time failure when @prisma/client isn't generated */
let PrismaClient: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ({ PrismaClient } = require("@prisma/client"));
} catch {
  // no generated client at build time
}
const g: any = globalThis as any;
const prisma = PrismaClient ? (g.__prisma ?? new PrismaClient()) : null;
if (PrismaClient && process.env.NODE_ENV !== "production") g.__prisma = prisma;
export default prisma;
