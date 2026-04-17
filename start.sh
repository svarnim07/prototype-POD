#!/bin/bash
# ExamShield Local Startup Script
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
AI="$ROOT/ai_service"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ███████╗██╗  ██╗ █████╗ ███╗   ███╗███████╗██╗  ██╗██╗███████╗██╗     ██████╗ "
echo "  ██╔════╝╚██╗██╔╝██╔══██╗████╗ ████║██╔════╝██║  ██║██║██╔════╝██║     ██╔══██╗"
echo "  █████╗   ╚███╔╝ ███████║██╔████╔██║███████╗███████║██║█████╗  ██║     ██║  ██║"
echo "  ██╔══╝   ██╔██╗ ██╔══██║██║╚██╔╝██║╚════██║██╔══██║██║██╔══╝  ██║     ██║  ██║"
echo "  ███████╗██╔╝ ██╗██║  ██║██║ ╚═╝ ██║███████║██║  ██║██║███████╗███████╗██████╔╝"
echo "  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝ "
echo -e "${NC}"
echo -e "${GREEN}Starting ExamShield AI Proctoring Platform...${NC}\n"

# ─── Backend setup ───────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/4] Setting up backend...${NC}"
cd "$BACKEND"
if [ ! -f ".env" ]; then cp .env.example .env 2>/dev/null || true; fi
npx prisma generate --schema=prisma/schema.prisma 2>/dev/null
npx prisma migrate dev --name init --schema=prisma/schema.prisma 2>/dev/null || \
  npx prisma db push --schema=prisma/schema.prisma 2>/dev/null
node prisma/seed.js 2>/dev/null || echo "Seed already applied or skipped"
echo -e "${GREEN}✓ Backend database ready${NC}"

# ─── Frontend install check ───────────────────────────────────────────────────
echo -e "${YELLOW}[2/4] Checking frontend...${NC}"
cd "$FRONTEND"
if [ ! -d "node_modules" ]; then npm install; fi
echo -e "${GREEN}✓ Frontend ready${NC}"

# ─── AI service venv ─────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/4] Checking AI service...${NC}"
cd "$AI"
if [ ! -d "venv" ]; then
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt -q
  echo -e "${GREEN}✓ AI service venv created${NC}"
else
  echo -e "${GREEN}✓ AI service venv exists${NC}"
fi

# ─── Launch all services ──────────────────────────────────────────────────────
echo -e "\n${YELLOW}[4/4] Starting all services...${NC}\n"

# Backend on port 3001
cd "$BACKEND"
echo -e "${CYAN}▶ Backend  → http://localhost:3001${NC}"
node src/server.js &
BACKEND_PID=$!

# AI service on port 8000
cd "$AI"
echo -e "${CYAN}▶ AI       → http://localhost:8000${NC}"
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
AI_PID=$!

# Frontend dev server on port 5173
cd "$FRONTEND"
echo -e "${CYAN}▶ Frontend → http://localhost:5173${NC}"
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  All services started!${NC}"
echo -e "${GREEN}  Open: http://localhost:5173${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Demo Credentials:"
echo "  Student : alice@student.com    / student123"
echo "  Faculty : faculty@examshield.com / faculty123"
echo "  Admin   : admin@examshield.com   / admin123"
echo ""
echo "  Press Ctrl+C to stop all services"

# Cleanup on exit
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $AI_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
