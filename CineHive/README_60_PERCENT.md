# CSE 216 - 60% milestone

## What was added

- `CUSTOMER` and `ADMIN` roles are persisted in `APP_USER.ROLE`.
- Passwords use bcrypt with a unique salt per password.
- JWTs identify a session, while every protected request reloads the user and role from Oracle.
- `POST /auth/logout` revokes the current token in `TOKEN_REVOCATION`.
- `GET /admin/dashboard` is protected by both authentication and the `ADMIN` role.
- The React navigation changes by role: customers get Watchlist and My Bookings; admins get Operations dashboard.

## Database setup

1. Back up the development schema.
2. Run `db/60_percent_migration.sql` once as the CINEHIVE schema owner.
3. Replace the administrator email and bcrypt placeholder in the script before executing it.
4. Put valid local database settings in `.env`; use `.env.example` as the template.

## Demonstration script

1. Register and log in as a customer. Show movies, a watchlist action, booking history, and logout.
2. Call `GET /admin/dashboard` with the customer bearer token. It must return `403`.
3. Call the same endpoint with no token. It must return `401`.
4. Log in as the seeded administrator. The UI must show the admin dashboard and must not expose customer actions. Calling `/watchlist`, `/bookings`, review creation, or rating creation with the administrator token must return `403`.
5. Log out, then reuse that same bearer token against any protected endpoint. It must return `401`.
6. With two customer accounts, create a watchlist item/booking in one and demonstrate that the other sees only its own data.

## Important limitations before submission

- The current Oracle credentials return `ORA-01017`; fix them before live testing.
- Do not put real secrets in `.env.example`, `file.txt`, source files, screenshots, or Git commits.
