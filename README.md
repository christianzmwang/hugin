# Hugin - Real Time Market Research

Hugin is a real-time market research platform that indexes internet data to provide real-time insights about your market.

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Add your DATABASE_URL and other environment variables
```

3. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `DATABASE_POOLING_URL` - Optional pooled connection string
- `NEXTAUTH_SECRET` - Secret key for NextAuth.js (generate with: openssl rand -base64 32)
- `NEXTAUTH_URL` - Base URL for the application (http://localhost:3000 for development)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (optional, for Gmail login)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (optional, for Gmail login)

## Database Dependencies

This application requires the following PostgreSQL tables:

**Business Data:**
- `Business` - Company information
- `FinancialReport` - Financial data
- `CEO` - Executive information
- `public.events_public` - Events data
- `public.business_filter_matrix` - For filtering

**Authentication (auto-created by setup script):**
- `users` - User accounts and password hashes
- `accounts` - OAuth provider accounts (Google, etc.)
- `sessions` - User session management
- `verification_tokens` - Email verification and password reset tokens

## Features

**Market Research:**
- Real-time business data search and filtering
- Event-based company scoring
- Industry and revenue filtering
- Advanced sorting and pagination
- Event type weighting system

**Authentication & Security:**
- Email/password user registration and login
- Google OAuth integration (Gmail login)
- Secure password hashing with bcryptjs
- Session management with NextAuth.js
- Password strength validation
- User profile management
 - Role-based admin access (admin, manager, user)

### Roles

- `admin`: Full access to the admin panel and all admin APIs.
- `manager`: Limited admin access: can view the admin dashboard and perform all actions except deleting other managers or the admin.
- `user`: Regular application user.

To apply the roles migration and seed initial roles (marks `christian@allvitr.com` as admin, `christianwang39@gmail.com` as manager):

```bash
pnpm db:migrate
```

Notes:
- The migration adds a `role` column to the `users` table with default `user`.
- You can change a user's role manually in SQL, for example:

```sql
UPDATE users SET role = 'manager' WHERE lower(email) = lower('someone@example.com');
UPDATE users SET role = 'admin' WHERE id = '...';
```

## 🔐 Authentication Setup

To set up user authentication:

1. **Copy environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Configure authentication variables in .env.local:**
   ```bash
   NEXTAUTH_SECRET=your-secret-key-here  # Generate with: openssl rand -base64 32
   NEXTAUTH_URL=http://localhost:3000
   ```

3. **Run authentication setup script:**
   ```bash
   node setup-auth.js
   ```

4. **Optional - Configure Google OAuth:**
   - Create a project in [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Google+ API and create OAuth 2.0 credentials
   - Add `http://localhost:3000/api/auth/callback/google` as authorized redirect URI
   - Add credentials to .env.local:
     ```bash
     GOOGLE_CLIENT_ID=your-google-client-id
     GOOGLE_CLIENT_SECRET=your-google-client-secret
     ```

For detailed authentication setup instructions, see [AUTHENTICATION.md](./AUTHENTICATION.md).
