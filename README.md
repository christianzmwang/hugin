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

## Database Dependencies

This application requires the following PostgreSQL tables:
- `Business` - Company information
- `FinancialReport` - Financial data
- `CEO` - Executive information
- `public.events_public` - Events data
- `public.business_filter_matrix` - For filtering

## Features

- Real-time business data search and filtering
- Event-based company scoring
- Industry and revenue filtering
- Advanced sorting and pagination
- Event type weighting system
