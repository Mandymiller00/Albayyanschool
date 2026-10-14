# Oracle Cloud Always Free deployment

This project can run as a Dockerized Next.js Node.js server with PostgreSQL on one Oracle Cloud Always Free VM. Oracle account verification may request payment-card details, free VM capacity is not guaranteed, and the free tier has no production SLA. The VM owner is responsible for security updates, access control, and verified off-site backups. Do not use this arrangement for important student records until backups have been tested and the school has accepted these risks.

The production Compose file keeps PostgreSQL private, binds the app only to `127.0.0.1:3000`, applies versioned Prisma migrations through a separate one-shot service, and expects Caddy on the VM to terminate HTTPS. The initial migration creates a new, empty production database; it does not copy records from a local or development database.

## 1. Create the Oracle VM

Create an Ubuntu ARM (Ampere A1) VM in Oracle Cloud Always Free, if capacity is available in your chosen region. Use an SSH key, restrict SSH ingress to your own IP where practical, and add inbound TCP rules for ports 80 and 443. Do not open PostgreSQL port 5432 or app port 3000 to the internet. Install Docker Engine and the Docker Compose plugin using Docker's official Ubuntu instructions.

## 2. Put the source in a private GitHub repository

Create a private repository for this school source code. Do not upload `.env`, database dumps, student data, or uploaded documents. Configure an SSH deploy key on the VM with read-only access to that repository, then clone it to the VM. Keep the repository private.

## 3. Configure production secrets

In the cloned project on the VM, create `.env.production` from `.env.production.example`. Set the actual domain, database name and username, a URL-safe alphanumeric database password, a unique `NEXTAUTH_SECRET`, and a unique initial administrator email, name, and password. Generate secrets on the VM; do not send them in chat or commit them. Protect the file:

```bash
chmod 600 .env.production
openssl rand -hex 32
openssl rand -base64 48
```

Use the hex output for `POSTGRES_PASSWORD` and a generated random value for `NEXTAUTH_SECRET`. The initial administrator password must be at least 14 characters and must not be reused elsewhere.

## 4. Initialize the database and app

Run these commands from the project directory on the VM. They create a fresh database and apply the checked-in Prisma migration before starting the app:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d db
docker compose --env-file .env.production -f compose.production.yaml --profile tools run --rm migrate
docker compose --env-file .env.production -f compose.production.yaml build web
docker compose --env-file .env.production -f compose.production.yaml up -d web
docker compose --env-file .env.production -f compose.production.yaml --profile tools run --rm bootstrap-admin
```

The admin bootstrap resets the account matching `ADMIN_EMAIL` to the configured password every time it runs. Run it only during initial setup or a deliberate password reset, then change or remove `ADMIN_PASSWORD` from the VM's `.env.production` file.

## 5. Enable HTTPS and connect the domain

Install Caddy on the VM using its official Ubuntu instructions. Copy `deploy/Caddyfile` to `/etc/caddy/Caddyfile`, replace `school.example.com` with the exact domain, validate/reload Caddy, and allow ports 80 and 443 through both the Oracle network rules and the VM firewall. At your domain registrar, point the domain's DNS A record to the VM's public IPv4 address. Caddy will request and renew HTTPS certificates after DNS resolves to the VM and the ports are reachable.

Update `APP_DOMAIN` in `.env.production` to the domain and recreate the web service so `NEXTAUTH_URL` matches:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --force-recreate web
```

## 6. Backups, updates, and verification

Before entering live school records, set up encrypted backups stored **off the VM**, restrict access to them, and test restoring a backup. A database volume on the same VM is not a backup. The database contains uploaded project and syllabus attachments too. Never place backups in the public web directory or a public GitHub repository.

For a code update, pull the reviewed change, back up the database off the VM, build the migration and web images, apply migrations, then restart the app:

```bash
docker compose --env-file .env.production -f compose.production.yaml build web migrate
docker compose --env-file .env.production -f compose.production.yaml --profile tools run --rm migrate
docker compose --env-file .env.production -f compose.production.yaml up -d web
```

Finally, test sign-in, account roles, results, attachments, and password reset over HTTPS. Check `docker compose ... logs` without sharing logs that may contain personal information.
