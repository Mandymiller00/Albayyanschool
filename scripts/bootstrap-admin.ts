import "dotenv/config";
import { hash } from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";

async function upsertAdministrator(email: string, name: string, passwordHash: string) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.user.upsert({
        where: { email },
        update: { name, passwordHash, role: Role.ADMIN },
        create: { email, name, passwordHash, role: Role.ADMIN },
        select: { email: true, role: true },
      });
    } catch (error) {
      const isNeonWakeupTimeout =
        error instanceof Prisma.PrismaClientInitializationError && error.errorCode === "P1001";
      if (!isNeonWakeupTimeout || attempt >= 4) throw error;

      const delayMs = attempt * 5000;
      console.warn(`Database is not ready yet; retrying in ${delayMs / 1000} seconds.`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !name || !password) {
    throw new Error("Set ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD before bootstrapping an admin.");
  }
  if (password.length < 14) {
    throw new Error("ADMIN_PASSWORD must be at least 14 characters long.");
  }

  const passwordHash = await hash(password, 12);
  const user = await upsertAdministrator(email, name, passwordHash);

  console.log(`Administrator account ready: ${user.email} (${user.role})`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Failed to bootstrap administrator.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });