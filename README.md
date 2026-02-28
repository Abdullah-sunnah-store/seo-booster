# SEO Booster - AI SEO and Blog Post

A comprehensive Shopify app for SEO optimization, AI-powered blog post generation, and site performance improvement.

## Features

- **SEO Checker**: Scan and fix SEO issues across your store with one-click suggestions
- **Speed Optimization**: Speed up pages with image compression, lazy loading, and AMP
- **Content Optimization**: Generate blog posts and keyword plans with AI (OpenAI GPT-4)
- **AI Bulk Editor**: Bulk edit meta tags, alt text, and auto-redirect broken links
- **Structured Data**: Add JSON-LD data to help search engines understand your store
- **Image SEO**: One-click image optimization, compression, resizing & ALT text
- **Technical SEO**: Broken link detection, 404 page handling, sitemap, structured data
- **Keyword Research**: AI-powered keyword suggestions and content planning

## Tech Stack

- **Framework**: Remix with Shopify App Remix
- **Database**: PostgreSQL with Prisma ORM
- **UI**: Shopify Polaris
- **AI**: OpenAI GPT-4 for content generation
- **Deployment**: DigitalOcean App Platform

## Setup

### Prerequisites

- Node.js 18.20+ or 20.10+
- PostgreSQL database
- Shopify Partner account
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/seo-booster-ai.git
cd seo-booster-ai
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure:
```bash
cp .env.example .env
```

4. Set up your environment variables in `.env`:
```
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SCOPES=read_products,write_products,read_content,write_content,read_themes,write_themes
SHOPIFY_APP_URL=https://your-app-url.com
DATABASE_URL=postgresql://user:password@localhost:5432/seo_booster
OPENAI_API_KEY=your_openai_api_key
SESSION_SECRET=your_session_secret
```

5. Run database migrations:
```bash
npx prisma migrate dev
```

6. Start the development server:
```bash
npm run dev
```

### Shopify App Setup

1. Create a new app in your Shopify Partner Dashboard
2. Set the app URL to your development/production URL
3. Configure OAuth redirect URLs
4. Copy the API key and secret to your `.env` file
5. Update `shopify.app.toml` with your app details

## Deployment to DigitalOcean

### Using App Platform

1. Fork this repository to your GitHub account
2. Connect your DigitalOcean account to GitHub
3. Create a new App in DigitalOcean App Platform
4. Select your repository
5. Configure environment variables:
   - `DATABASE_URL` (from managed database)
   - `SHOPIFY_API_KEY`
   - `SHOPIFY_API_SECRET`
   - `SHOPIFY_APP_URL`
   - `OPENAI_API_KEY`
   - `SESSION_SECRET`
6. Deploy

### Using Docker

```bash
# Build the Docker image
docker build -t seo-booster-ai .

# Run the container
docker run -p 3000:3000 --env-file .env seo-booster-ai
```

## Project Structure

```
├── app/
│   ├── components/        # Reusable UI components
│   ├── routes/           # Remix routes
│   │   ├── app._index.tsx        # Dashboard
│   │   ├── app.seo-checker.tsx   # SEO Scanner
│   │   ├── app.speed-optimization.tsx
│   │   ├── app.content-optimization.tsx
│   │   ├── app.search-appearance.tsx
│   │   ├── app.link-management.tsx
│   │   ├── app.keyword-research.tsx
│   │   └── app.settings.tsx
│   ├── services/         # Business logic
│   │   ├── openai.server.ts      # AI integration
│   │   ├── seo-analyzer.server.ts
│   │   └── structured-data.server.ts
│   ├── db.server.ts      # Database client
│   └── shopify.server.ts # Shopify app config
├── prisma/
│   └── schema.prisma     # Database schema
├── public/               # Static assets
├── Dockerfile
├── app.yaml             # DigitalOcean config
└── package.json
```

## API Routes

All API routes are protected and require Shopify authentication.

### SEO Scanning
- `POST /app` - Run SEO scan
- `GET /app/seo-checker` - Get scan results

### Content Generation
- `POST /app/content-optimization` - Generate AI blog post
- `POST /app/search-appearance` - Generate meta tags

### Speed Optimization
- `POST /app/speed-optimization` - Update speed settings
- `POST /app/speed-optimization` (action: optimizeImages) - Optimize images

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.

## Support

For support, please open an issue on GitHub or contact support@yourapp.com.
