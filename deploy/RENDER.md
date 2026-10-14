# Render + Neon free demo deployment

This option avoids the Oracle card-verification step. Use it only for a **demo or pilot with test data**. Render explicitly says Free instances are not for production applications: a free web service sleeps after 15 minutes idle and can take about a minute to wake, has a monthly hours allowance, and uses an ephemeral filesystem. Neon Free is limited to 1 GB storage per project, 100 compute-hours, and 5 GB public network transfer; its database scales to zero after inactivity. Free services have no production SLA or reliable backups.

Render Free may suspend services if usage limits are exceeded, and it may suspend unusually high outbound traffic to external services such as Neon. Do not add a payment method unless you intend to accept possible charges.

Do not put real student records, financial information, or confidential school documents on this deployment. Uploaded syllabus and project files are stored in PostgreSQL, so they count against the Neon database storage limit. The initial Prisma migration creates an empty database; it does not import local school data.

## 1. Create the Neon database

1. Create a Neon account and a new PostgreSQL project in the dashboard.
2. Choose the Free plan.
3. Open **Connect** and copy the pooled connection string for `DATABASE_URL` and the direct (unpooled) connection string for `DIRECT_URL`. Keep both private and preserve any `sslmode=require` query parameter. Do not paste these strings into source files or chat.

## 2. Put the code in a private GitHub repository

This workspace currently has no Git repository or remote. Create a **private** GitHub repository, then publish the project source and checked-in Prisma migrations from your computer. Keep `.env`, database exports, uploads, and student data out of Git. `.gitignore` excludes local environment files.

## 3. Create the Render web service

1. Create/sign in to [Render](https://dashboard.render.com/register) and connect your GitHub account. Check the current signup requirements in the dashboard; do not add a payment method for this free pilot.
2. Select **New → Blueprint** and choose the private repository, or select **New → Web Service** and use `render.yaml`.
3. If creating a Blueprint, enter the three requested environment values: `DATABASE_URL`, `DIRECT_URL`, and `NEXTAUTH_SECRET`. Use the rotated Neon connection strings for the database values. The Blueprint sets `NEXTAUTH_URL` to this service's HTTPS URL, `https://albayyanschool.onrender.com`. Generate a fresh secret locally with `openssl rand -base64 48` or another cryptographically secure generator; never reuse the local development secret.
4. Confirm the service uses the **Free** plan and deploy it. With the Node runtime, the build command applies migrations before building Next.js. If using the repository Dockerfile, the container applies migrations before starting Next.js. The database must already exist and the database environment variables must be present.
5. Verify `NEXTAUTH_URL` exactly matches the service URL. If you use a custom domain, set it to that HTTPS domain in Render and redeploy. Do not test account sign-in until this value and `NEXTAUTH_SECRET` are set.

The Blueprint disables demo login. Use the secure local bootstrap script below to create the first administrator in the new Neon database.

## 4. Create the pilot administrator

On your computer, open PowerShell in the project directory, install the project dependencies if needed, and run:

```powershell
npm ci
.\scripts\bootstrap-remote-admin.ps1
```

For each Neon URL prompt, use the **Copy** button in Neon, return to PowerShell, and press Enter without pasting or typing the URL. The script reads the clipboard directly so the connection string is not echoed in the terminal. Then enter the administrator email/name and type a unique password at the hidden password prompt. The script creates or resets that account and clears the temporary environment variables afterward. Only run it when intentionally creating or resetting that administrator.

## 5. Connect a custom domain (optional)

In Render, open the web service's **Settings → Custom Domains**, add the domain, and follow the displayed DNS instructions at your registrar. Render provides TLS certificates and redirects HTTP to HTTPS. Check the current included custom-domain allowance: Render charges $0.25 per month for each custom domain beyond that allowance. Verify HTTPS and set `NEXTAUTH_URL` to the final HTTPS domain in Render, then redeploy. The default `onrender.com` URL can be used for a demo before a domain is purchased.

## 6. Verify the demo

Test administrator sign-in, role-based pages, results, syllabus/project attachments, and sign-out. Confirm the database is the new empty pilot database, not the local school database. Expect a delay on the first request after idle time. Export and protect any data you need to retain; do not treat a free database snapshot as a backup.

For real school operations, move to a paid hosting/database plan with backups, an SLA, and an approved data-protection arrangement before importing school data.
