This is the Albayyan International School management system built with Next.js, TypeScript, Prisma, and PostgreSQL.

## Local PostgreSQL

The local database runs in Docker and stores data in the persistent `school_management_postgres_data` volume. The startup script reads the existing `DATABASE_URL` from `.env`; it does not print or commit the database password.

1. Start Docker Desktop and wait until its engine is running. If Docker reports that its Windows service cannot start, open Docker Desktop with an account permitted to start `com.docker.service`, or ask your device administrator to start that service.
2. From PowerShell in the project folder, run:

	```powershell
	.\scripts\start-database.ps1
	```

The script starts PostgreSQL on `localhost:5432`, waits for its health check, and applies `prisma/schema.prisma` with `prisma db push`. Then start the app with `npm run dev`.

To stop PostgreSQL without deleting data, run `docker compose down`. Do not run `docker compose down -v` unless you intend to permanently delete the local school database.

## Hosted PostgreSQL (No Docker)

For machines that cannot run Docker, create a PostgreSQL project in [Supabase](https://supabase.com/dashboard). Open the project, choose **Connect → ORM → Prisma**. Supabase shows two connection strings:

- Set the transaction-mode pooler URL (port `6543`) as `DATABASE_URL` for app connections.
- Set the session-mode pooler URL (port `5432`) as `DIRECT_URL` for Prisma schema operations.

Replace `[YOUR-PASSWORD]` in each with the database password you created. In the project `.env`, replace only those two values. `.env` is ignored by Git; never commit it or share either URL. If the password contains reserved URL characters, percent-encode them.

From PowerShell in the project folder, run:

```powershell
.\scripts\connect-hosted-database.ps1
```

The script refuses local `localhost` URLs, validates the Prisma schema, and applies it to the configured Supabase database. Use a development project for this app. Keep your connection URL private.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment options

See the [Render + Neon free demo guide](./deploy/RENDER.md) for a pilot deployment. It is not suitable for production school records.

The [Oracle Cloud Always Free guide](./deploy/ORACLE.md) remains available for self-hosting if you can create an Oracle account and VM.
