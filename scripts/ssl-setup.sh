#!/bin/bash
# ============================================================================
# ParkFlow SSL Setup Script
# ============================================================================
# Let's Encrypt 인증서를 발급하고 설정하는 스크립트
#
# Usage:
#   ./scripts/ssl-setup.sh <domain> <email>
#
# Example:
#   ./scripts/ssl-setup.sh admin.parkflow.io admin@parkflow.io
#
# Prerequisites:
#   - 도메인이 서버 IP로 연결되어 있어야 함
#   - 80, 443 포트가 열려 있어야 함
#   - Docker와 Docker Compose가 설치되어 있어야 함
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ -z "$1" ] || [ -z "$2" ]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo "Usage: $0 <domain> <email>"
    echo "Example: $0 admin.parkflow.io admin@parkflow.io"
    exit 1
fi

DOMAIN=$1
EMAIL=$2

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}ParkFlow SSL Setup${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Domain: ${YELLOW}$DOMAIN${NC}"
echo -e "Email:  ${YELLOW}$EMAIL${NC}"
echo ""

# Check if domain resolves
echo -e "${YELLOW}Checking domain resolution...${NC}"
if ! host $DOMAIN > /dev/null 2>&1; then
    echo -e "${RED}Warning: Domain $DOMAIN does not resolve.${NC}"
    echo "Make sure your domain points to this server's IP address."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create necessary directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p ./certbot/www
mkdir -p ./certbot/conf

# Export domain for docker-compose
export DOMAIN_NAME=$DOMAIN

# Stop any running containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose -f docker-compose.prod.yml -f docker-compose.ssl.yml down 2>/dev/null || true

# Start nginx for initial certificate request
echo -e "${YELLOW}Starting nginx for certificate request...${NC}"

# Create a temporary nginx config for initial setup
cat > ./apps/admin-web/nginx.initial.conf << 'EOF'
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'ParkFlow SSL Setup in progress...';
        add_header Content-Type text/plain;
    }
}
EOF

# Start nginx with initial config
docker run -d --name parkflow-nginx-init \
    -p 80:80 \
    -v $(pwd)/apps/admin-web/nginx.initial.conf:/etc/nginx/conf.d/default.conf:ro \
    -v $(pwd)/certbot/www:/var/www/certbot \
    nginx:alpine

echo -e "${YELLOW}Waiting for nginx to start...${NC}"
sleep 5

# Request certificate
echo -e "${YELLOW}Requesting SSL certificate from Let's Encrypt...${NC}"
docker run --rm \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Stop initial nginx
echo -e "${YELLOW}Stopping initial nginx...${NC}"
docker stop parkflow-nginx-init
docker rm parkflow-nginx-init
rm ./apps/admin-web/nginx.initial.conf

# Check if certificate was created
if [ ! -f "./certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${RED}Error: Certificate not found!${NC}"
    echo "Please check the certbot output above for errors."
    exit 1
fi

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}SSL Certificate installed successfully!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "To start the server with HTTPS:"
echo ""
echo -e "  ${YELLOW}export DOMAIN_NAME=$DOMAIN${NC}"
echo -e "  ${YELLOW}docker-compose -f docker-compose.prod.yml -f docker-compose.ssl.yml up -d${NC}"
echo ""
echo "Or add to .env file:"
echo ""
echo -e "  ${YELLOW}echo 'DOMAIN_NAME=$DOMAIN' >> .env${NC}"
echo ""
echo -e "${GREEN}Done!${NC}"
