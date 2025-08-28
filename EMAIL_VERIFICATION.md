# Email Verification Setup Guide

This guide will help you set up email verification for the Hugin signup process using Resend.

## ✅ Features Implemented

- [x] Email verification for all new user registrations
- [x] Beautiful HTML email templates with Hugin branding
- [x] Secure verification tokens with 24-hour expiration
- [x] Resend verification email functionality
- [x] Email verification status pages (success, error, pending)
- [x] Authentication blocks unverified users
- [x] User-friendly error messages and flows

## 🚀 Setup Instructions

### 1. Get Resend API Key

1. Go to [Resend.com](https://resend.com/)
2. Sign up for a free account (100 emails/day free tier)
3. Create an API key in your dashboard
4. Verify your domain (optional but recommended for production)

### 2. Environment Variables

Add these variables to your `.env.local`:

```bash
# Email Configuration (Resend) - REQUIRED
RESEND_API_KEY=re_your-resend-api-key-here
FROM_EMAIL=Hugin <noreply@yourdomain.com>

# NextAuth URL - REQUIRED for verification links
NEXTAUTH_URL=http://localhost:3000  # In development
NEXTAUTH_URL=https://yourdomain.com # In production
```

### 3. Email Verification Flow

#### For New Users:
1. User signs up with email/password
2. Account is created (unverified)
3. Verification email is sent automatically
4. User is redirected to "Check Your Email" page
5. User clicks verification link in email
6. Email is verified, user can now sign in

#### For Existing Unverified Users:
1. User tries to sign in
2. Authentication is blocked
3. Error message: "Please verify your email address"
4. User can request new verification email

### 4. Email Templates

The system includes beautifully designed HTML email templates with:
- Hugin branding and colors
- Responsive design
- Clear call-to-action buttons
- Security notices and expiration warnings
- Plain text fallbacks

### 5. Security Features

- **Token Expiration**: Verification links expire after 24 hours
- **Single Use**: Tokens are deleted after successful verification
- **Secure Generation**: Cryptographically secure random tokens
- **Rate Limiting**: Built-in protection through Resend
- **SQL Injection Protection**: Parameterized queries

## 📱 User Experience

### Verification Pending Page
- Shows after successful signup
- Clear instructions for next steps
- Resend email functionality
- Links back to sign in

### Verification Success Page
- Confirmation of successful verification
- Direct link to sign in
- Welcome message

### Verification Error Page
- Handles expired/invalid tokens
- Option to request new verification email
- Clear error messaging

## 🔧 API Endpoints

### `POST /api/auth/signup`
- Creates user account (unverified)
- Sends verification email
- Returns success with verification instructions

### `GET /api/auth/verify-email?token=...`
- Verifies email with token
- Redirects to success/error pages
- Handles token expiration

### `POST /api/auth/resend-verification`
- Resends verification email
- Checks user status
- Requires authentication

### `POST /api/auth/check-verification`
- Checks if user exists and verification status
- Used for better error messages

## 🛠️ Database Schema

The email verification uses existing NextAuth tables:

```sql
-- Users table (existing)
users {
  id: UUID
  email: VARCHAR(255) UNIQUE
  emailVerified: TIMESTAMPTZ  -- NULL = unverified
  password_hash: TEXT
  name: VARCHAR(255)
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}

-- Verification tokens table (existing)
verification_tokens {
  identifier: VARCHAR(255)    -- User email
  token: VARCHAR(255) UNIQUE  -- Verification token
  expires: TIMESTAMPTZ        -- Expiration date
}
```

## 🔒 Access Control Integration

Email verification is integrated with the existing access control system:

1. **Authentication Check**: Users must be authenticated AND verified
2. **API Protection**: All API endpoints check email verification
3. **Production Enforcement**: Only verified users from ALLOWED_USERS can access
4. **Session Management**: Verification status stored in JWT tokens

## 🎨 Customization

### Email Templates
Edit `/src/lib/email.ts` to customize:
- Email content and styling
- Branding elements
- Call-to-action text
- Footer information

### Pages
Customize verification pages in `/src/app/auth/verify-email/`:
- `pending/page.tsx` - Check your email page
- `success/page.tsx` - Verification successful
- `error/page.tsx` - Verification failed

### Error Messages
Update error messages in:
- `/src/components/AuthForm.tsx` - Sign-in form errors
- `/src/app/api/auth/signup/route.ts` - Signup API errors

## 🚨 Troubleshooting

### Common Issues:

1. **Emails not sending**
   - Check RESEND_API_KEY is correct
   - Verify FROM_EMAIL domain is verified in Resend
   - Check Resend dashboard for delivery status

2. **Verification links not working**
   - Ensure NEXTAUTH_URL is set correctly
   - Check token hasn't expired (24 hours)
   - Verify database connectivity

3. **Users can't sign in after verification**
   - Check emailVerified field in database
   - Verify JWT token includes verification status
   - Ensure access control allows the user

### Debug Steps:

1. Check server logs for detailed error messages
2. Verify environment variables are loaded
3. Test database connection with `/api/debug`
4. Check Resend dashboard for email delivery logs

## 📈 Production Considerations

1. **Domain Verification**: Verify your domain in Resend for better deliverability
2. **Email Monitoring**: Monitor bounce rates and spam reports
3. **Rate Limiting**: Consider additional rate limiting for verification requests
4. **Backup Email Service**: Have a fallback email service for critical situations
5. **Database Cleanup**: Periodically clean up expired verification tokens

## 🔄 Migration for Existing Users

If you have existing users without email verification:

1. **Option A**: Grandfather existing users (set emailVerified = NOW())
2. **Option B**: Require verification for all users
3. **Option C**: Gradual migration with grace period

Choose based on your user base and security requirements.

---

## 📞 Support

For issues with email verification:
1. Check this documentation
2. Review server logs
3. Test with `/api/debug` endpoint
4. Contact development team

Email verification is now fully integrated and ready for production use! 🎉
