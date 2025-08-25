# Authentication Setup Guide

This guide will help you set up password authentication and Google OAuth login for Hugin.

## ✅ Features Implemented

- [x] Email/password authentication with secure password hashing
- [x] Google OAuth integration for Gmail login
- [x] User registration and login pages
- [x] Session management with NextAuth.js
- [x] PostgreSQL adapter for user data storage
- [x] Password strength validation
- [x] Responsive authentication UI

## 🚀 Setup Instructions

### 1. Database Setup

First, run the authentication schema SQL script to create the required tables:

```bash
# Connect to your PostgreSQL database and run:
psql -h your-host -d your-database -f sql/auth-schema.sql
```

Or execute the SQL manually in your database client:

```sql
-- The SQL creates these tables:
-- - users (for user accounts)
-- - accounts (for OAuth providers)
-- - sessions (for user sessions)
-- - verification_tokens (for email verification)
```

### 2. Environment Variables

Copy the example environment file and configure your values:

```bash
cp .env.example .env.local
```

Configure the following variables in `.env.local`:

#### Required Variables

```bash
# Database (use your existing DATABASE_URL)
DATABASE_URL=postgresql://postgres:password@host:5432/database

# NextAuth Secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-generated-secret-key-here

# NextAuth URL (use your domain in production)
NEXTAUTH_URL=http://localhost:3000
```

#### Google OAuth Setup (Optional but Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - For development: `http://localhost:3000/api/auth/callback/google`
   - For production: `https://yourdomain.com/api/auth/callback/google`

Add the credentials to your `.env.local`:

```bash
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

#### reCAPTCHA Enterprise Setup (Required for Signup)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the reCAPTCHA Enterprise API
4. Go to "reCAPTCHA Enterprise" → "Site Keys" → "Create Site Key"
5. Choose "Website" and configure:
   - **For Development Key:**
     - Domain: `localhost`
     - reCAPTCHA type: "Score-based (v3)"
   - **For Production Key:**
     - Domain: `allvitr.com`, `allvitr.no` (your production domains)
     - reCAPTCHA type: "Score-based (v3)"
   
   **Note:** Google recommends separate keys for development and production. If you get a "localhost not supported" error, you need to add `localhost` to your site key's supported domains list.
6. Create an API key:
   - Go to "APIs & Services" → "Credentials" → "Create Credentials" → "API Key"
   - Restrict the key to "reCAPTCHA Enterprise API"

Add the reCAPTCHA configuration to your `.env.local`:

```bash
# reCAPTCHA Enterprise Configuration
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-site-key-here
RECAPTCHA_PROJECT_ID=your-google-cloud-project-id
RECAPTCHA_API_KEY=your-api-key-here

# For separate dev/prod keys (recommended):
# Development: Use the site key that includes localhost
# Production: Use the site key that includes your production domains
```

### 3. Install Dependencies

The required dependencies are already installed:

- `next-auth` - Authentication framework
- `@auth/pg-adapter` - PostgreSQL adapter
- `bcryptjs` - Password hashing

### 4. Test the Setup

1. Start the development server:
```bash
pnpm dev
```

2. Visit the application at `http://localhost:3000`

3. Try the authentication features:
   - Click "Sign Up" to create a new account
   - Click "Sign In" to log in with existing credentials
   - Try "Continue with Google" (if configured)

## 🔧 Troubleshooting

### reCAPTCHA "localhost not supported" Error

If you see an error that "localhost domains are not supported by default":

1. **Quick Fix**: Add `localhost` to your existing site key
   - Go to [Google Cloud Console](https://console.cloud.google.com/) → reCAPTCHA Enterprise
   - Find your site key and click on it
   - Under "Domains", click "Add a domain"
   - Enter `localhost` and save

2. **Best Practice**: Create separate development and production keys
   - **Development key**: Only includes `localhost`
   - **Production key**: Only includes your production domains (`allvitr.com`, `allvitr.no`)
   - Use the appropriate key in each environment

### Environment Variables Not Loading

- Make sure your `.env.local` file is in the project root
- Restart your development server after adding new environment variables
- Check that variable names match exactly (case-sensitive)

### Database Connection Issues

- Verify your `DATABASE_URL` is correct
- Ensure the database is running and accessible
- Run the auth schema SQL script if tables don't exist

## 📋 Authentication Features

### Password Authentication

- **Email/Password Registration**: Users can sign up with email and password
- **Password Requirements**: 
  - Minimum 8 characters
  - Must contain uppercase, lowercase, and numeric characters
- **Secure Password Storage**: Passwords are hashed using bcryptjs with 12 salt rounds
- **Login Validation**: Email and password verification during sign-in

### Google OAuth

- **One-Click Login**: Users can sign in with their Google account
- **Gmail Integration**: Seamless integration with Gmail accounts
- **Auto Account Creation**: First-time Google users automatically get accounts created
- **Profile Information**: Name and profile picture from Google account

### Session Management

- **JWT Sessions**: Secure session tokens for authenticated users
- **Persistent Login**: Users stay logged in across browser sessions
- **Secure Logout**: Proper session cleanup on logout
- **Session Expiration**: Automatic handling of expired sessions

## 🔐 Security Features

- **Password Hashing**: bcryptjs with 12 salt rounds
- **CSRF Protection**: Built-in CSRF protection with NextAuth.js
- **Secure Cookies**: HTTP-only, secure cookies for session management
- **SQL Injection Protection**: Parameterized queries throughout
- **Input Validation**: Email format and password strength validation

## 🎨 User Interface

- **Responsive Design**: Works on desktop and mobile devices
- **Dark Theme Integration**: Matches the existing Hugin design
- **Loading States**: Visual feedback during authentication
- **Error Handling**: Clear error messages for failed authentication
- **Navigation Integration**: Auth status shown in main navigation

## 📁 File Structure

```
src/
├── app/
│   ├── api/auth/
│   │   ├── [...nextauth]/route.ts    # NextAuth.js API routes
│   │   └── signup/route.ts           # User registration endpoint
│   ├── auth/
│   │   ├── signin/page.tsx           # Sign-in page
│   │   └── signup/page.tsx           # Sign-up page
│   └── layout.tsx                    # Updated with auth providers
├── components/
│   ├── AuthForm.tsx                  # Reusable auth form component
│   ├── AuthNav.tsx                   # Navigation auth buttons
│   └── Providers.tsx                 # Session provider wrapper
└── lib/
    ├── auth.ts                       # NextAuth.js configuration
    └── auth-helpers.ts               # Authentication utility functions
```

## 🚀 Production Deployment

For production deployment, update your environment variables:

```bash
# Production environment variables
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-production-secret-key
DATABASE_URL=your-production-database-url
GOOGLE_CLIENT_ID=your-production-google-client-id
GOOGLE_CLIENT_SECRET=your-production-google-client-secret
```

Don't forget to:
1. Update Google OAuth redirect URIs to use your production domain
2. Use a strong, unique `NEXTAUTH_SECRET` in production
3. Ensure your database is accessible from your production environment

## 🐛 Troubleshooting

### Common Issues

1. **"Configuration invalid" error**: Check that `NEXTAUTH_SECRET` is set
2. **Google OAuth not working**: Verify Google OAuth credentials and redirect URIs
3. **Database connection issues**: Ensure `DATABASE_URL` is correct and database is accessible
4. **Sign-up failing**: Check database tables exist and user doesn't already exist

### Debugging

Enable NextAuth.js debug mode in development:

```bash
# Add to .env.local
NEXTAUTH_DEBUG=true
```

This will provide detailed logging for authentication flows.

## 📞 Support

If you encounter issues with authentication setup, check:

1. Database tables were created successfully
2. Environment variables are properly configured
3. Google OAuth settings match your domain
4. NextAuth.js secret is properly generated

The authentication system is now fully integrated with your Hugin application!
