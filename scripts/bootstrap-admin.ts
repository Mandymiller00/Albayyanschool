import "dotenv/config";
import { hash } from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";

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
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: Role.ADMIN },
    create: { email, name, passwordHash, role: Role.ADMIN },
    select: { email: true, role: true },
  });

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