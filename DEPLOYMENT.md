# Hugin Deployment Guide

This guide will help you deploy Hugin to Vercel at `hugin.allvitr.no`.

## ✅ Pre-Deployment Checklist

- [x] Next.js application configured
- [x] Supabase database credentials available
- [x] Vercel configuration files created
- [x] Environment variables template prepared

## 🚀 Deployment Steps

### 1. Prepare Your Repository

Make sure all files are committed to your Git repository:

```bash
git add .
git commit -m "Prepare Hugin for production deployment"
git push origin main
```

### 2. Deploy to Vercel

#### Option A: Deploy via Vercel CLI (Recommended)

1. Install Vercel CLI if you haven't already:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy from the project directory:
```bash
vercel --prod
```

#### Option B: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your Git repository
4. Select the `hugin` folder as the root directory
5. Vercel will auto-detect it's a Next.js project

### 3. Configure Environment Variables

In your Vercel dashboard, go to Project Settings → Environment Variables and add:

```bash
# Database (use your actual Supabase credentials)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres
DATABASE_POOLING_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Security (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-generated-secret-key-here
NEXTAUTH_URL=https://hugin.allvitr.no

# Optimization
NEXT_TELEMETRY_DISABLED=1
```

**Important**: Set these for "Production" environment.

### 4. Set Up Custom Domain (hugin.allvitr.no)

#### In Vercel Dashboard:

1. Go to Project Settings → Domains
2. Add custom domain: `hugin.allvitr.no`
3. Vercel will provide DNS configuration instructions

#### In Your DNS Provider (for allvitr.no):

Add these DNS records:

**Option A: CNAME Record (Recommended)**
```
Type: CNAME
Name: hugin
Value: cname.vercel-dns.com
TTL: 300 (or Auto)
```

**Option B: A Record**
```
Type: A
Name: hugin
Value: 76.76.19.61
TTL: 300
```

### 5. Configure SSL

Vercel automatically provides SSL certificates for custom domains. Once DNS propagates (usually 5-10 minutes), your site will be available at `https://hugin.allvitr.no`.

## 🔧 Production Configuration

### Database Connection

Ensure your Supabase instance is configured for production:

1. **Connection Pooling**: Use `DATABASE_POOLING_URL` for better performance
2. **SSL**: Enabled by default (handled in `src/lib/db.ts`)
3. **Timeouts**: Set to 30 seconds (configured in API routes)

### Performance Optimizations

The following are already configured:

- ✅ API route timeouts (30 seconds)
- ✅ Preferred regions (Europe: fra1, arn1, cdg1)
- ✅ CSS optimization
- ✅ Response compression
- ✅ Telemetry disabled

## 🌍 DNS Propagation

After adding DNS records, it may take 5-60 minutes for changes to propagate globally. You can check status at:

- [DNS Checker](https://dnschecker.org)
- [WhatsMyDNS](https://whatsmydns.net)

## 🔍 Verification

Once deployed, verify these endpoints work:

1. **Main App**: `https://hugin.allvitr.no`
2. **API Health**: `https://hugin.allvitr.no/api/businesses`
3. **Industries**: `https://hugin.allvitr.no/api/industries`
4. **Event Types**: `https://hugin.allvitr.no/api/events/types`

## 🐛 Troubleshooting

### Common Issues:

1. **Database Connection Errors**
   - Verify `DATABASE_URL` is correct
   - Check Supabase connection limits
   - Ensure IP allowlist includes Vercel's IPs (or set to 0.0.0.0/0)

2. **Domain Not Working**
   - Check DNS propagation
   - Verify CNAME/A record is correct
   - Wait for SSL certificate generation

3. **API Timeouts**
   - Check Supabase performance
   - Monitor Vercel function logs

### Monitoring:

- **Vercel Dashboard**: Function logs and analytics
- **Supabase Dashboard**: Database performance and connections
- **Browser DevTools**: Network tab for API responses

## 📱 Next Steps

After successful deployment:

1. Test all functionality with production data
2. Set up monitoring and alerts
3. Configure any additional integrations
4. Update any external services to point to the new domain

---

**Support**: If you encounter issues, check Vercel's deployment logs and Supabase connection status.
