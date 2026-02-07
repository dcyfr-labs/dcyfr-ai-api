# Deployment Guide

Production deployment guide for the DCYFR AI API.

## Prerequisites

- Node.js 20+ installed
- PostgreSQL or SQLite database
- HTTPS/SSL certificate
- Domain name configured

## Environment Setup

### 1. Create Production .env File

```bash
# Copy example env
cp .env.example .env.production

# Edit with production values
nano .env.production
```

Required variables:
```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
JWT_SECRET=your-very-strong-random-secret-min-32-chars
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
```

### 2. Install Dependencies

```bash
npm ci --production
```

### 3. Build Application

```bash
npm run build
```

### 4. Run Database Migrations

```bash
npm run db:push
npm run db:seed # Optional: seed initial data
```

## Deployment Options

### Option 1: PM2 (Recommended)

PM2 is a production process manager for Node.js.

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start dist/index.js --name dcyfr-api

# Monitor
pm2 monit

# View logs
pm2 logs dcyfr-api

# Restart
pm2 restart dcyfr-api

# Stop
pm2 stop dcyfr-api

# Startup script (runs on boot)
pm2 startup
pm2 save
```

**PM2 Ecosystem File** (`ecosystem.config.js`):

```javascript
module.exports = {
  apps: [{
    name: 'dcyfr-api',
    script: './dist/index.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};
```

Start with ecosystem file:
```bash
pm2 start ecosystem.config.js
```

### Option 2: Docker

**Dockerfile:**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy source
COPY . .

# Build
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start
CMD ["node", "dist/index.js"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/mydb
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=mydb
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - db-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  db-data:
```

Build and run:
```bash
docker-compose up -d
```

### Option 3: Kubernetes

**deployment.yaml:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dcyfr-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dcyfr-api
  template:
    metadata:
      labels:
        app: dcyfr-api
    spec:
      containers:
      - name: api
        image: your-registry/dcyfr-api:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: dcyfr-api
spec:
  selector:
    app: dcyfr-api
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

Deploy:
```bash
kubectl apply -f deployment.yaml
```

## Reverse Proxy (Nginx)

Configure Nginx as reverse proxy:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Monitoring & Logging

### Health Checks

The `/health` endpoint provides system health:

```bash
curl https://api.yourdomain.com/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-07T00:00:00.000Z",
  "uptime": 12345
}
```

### Application Logs

Logs are written to:
- **Console**: Structured JSON logs
- **Files**: `logs/error.log` and `logs/out.log` (with PM2)

View logs:
```bash
# PM2
pm2 logs dcyfr-api

# Docker
docker-compose logs -f api

# Direct
tail -f logs/error.log
```

### Performance Monitoring

Install monitoring tools:

```bash
# Application Performance Monitoring
npm install @sentry/node

# Prometheus metrics
npm install prom-client
```

## Security Checklist

Before going live:

- [ ] HTTPS/SSL enabled
- [ ] Strong JWT secret configured
- [ ] CORS limited to your domain
- [ ] Rate limiting enabled
- [ ] Helmet middleware active
- [ ] Environment variables set
- [ ] Database backups configured
- [ ] Error logging configured
- [ ] Monitoring setup
- [ ] Firewall configured

## Scaling

### Horizontal Scaling

PM2 Cluster Mode:
```bash
pm2 start ecosystem.config.js
pm2 scale dcyfr-api 4  # Scale to 4 instances
```

Docker Swarm:
```bash
docker service scale dcyfr-api=5
```

Kubernetes:
```bash
kubectl scale deployment dcyfr-api --replicas=5
```

### Load Balancing

Use Nginx, HAProxy, or cloud load balancers:
- AWS ALB/NLB
- Google Cloud Load Balancing
- Azure Load Balancer

## Backup Strategy

### Database Backups

```bash
# PostgreSQL
pg_dump -U user -d mydb > backup_$(date +%Y%m%d).sql

# SQLite
cp data/db.sqlite data/db_backup_$(date +%Y%m%d).sqlite
```

Automate with cron:
```bash
0 2 * * * /usr/local/bin/backup-db.sh
```

### Application Files

Backup configuration and uploaded files regularly.

## Troubleshooting

### Application Won't Start

1. Check logs: `pm2 logs dcyfr-api`
2. Verify environment variables
3. Check database connection
4. Ensure port not in use: `lsof -i :3001`

### Performance Issues

1. Check CPU/memory usage: `pm2 monit`
2. Review slow queries in logs
3. Enable connection pooling
4. Add caching layer (Redis)

### Database Connection Errors

1. Verify DATABASE_URL
2. Check database is running
3. Verify network/firewall rules
4. Check connection limits

## Support

- Documentation: [GitHub Wiki](https://github.com/dcyfr/dcyfr-ai-api/wiki)
- Issues: [GitHub Issues](https://github.com/dcyfr/dcyfr-ai-api/issues)
- Security: security@dcyfr.ai
