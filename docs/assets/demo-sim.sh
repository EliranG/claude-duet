#!/bin/bash
# Simulates a claude-duet session for the demo gif
# Colors
CYAN='\033[36m'
YELLOW='\033[33m'
MAGENTA='\033[35m'
GREEN='\033[32m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

sleep 0.8
echo ""
echo -e "  ${BOLD}✦ claude-duet${RESET} session started"
echo -e "  ${DIM}Code: cd-7f3a · Password: ocean-breeze${RESET}"
echo ""
echo -e "  ${DIM}npx claude-duet join cd-7f3a --password ocean-breeze --url ws://192.168.1.5:4567${RESET}"
echo ""
sleep 2

echo -e "  ${GREEN}✦ benji joined the session${RESET}"
echo ""
sleep 1.5

echo -e "  ${CYAN}eliran >${RESET} hey, there's a bug in auth.ts — token never expires"
sleep 1.5
echo -e "  ${YELLOW}benji  >${RESET} yeah I saw it, let's ask claude"
echo ""
sleep 1.5

echo -e "  ${YELLOW}benji  >${RESET} ${MAGENTA}@claude${RESET} fix the token expiry bug in src/auth.ts"
echo ""
sleep 0.8

echo -e "  ${DIM}⚡ approve benji's prompt? (y/n)${RESET} ${GREEN}y${RESET}"
echo ""
sleep 1

echo -e "  ${MAGENTA}claude ✦${RESET} I'll fix the token expiry bug."
sleep 0.5
echo ""
echo -e "  ${GREEN}✎ Edit${RESET} src/auth.ts"
echo -e "  ${GREEN}+${RESET} if (isTokenExpired(token)) throw new AuthError('expired')"
echo ""
sleep 0.5
echo -e "  ${DIM}✓ Turn complete · \$0.004 · 1.8s${RESET}"
echo ""
sleep 1.5

echo -e "  ${YELLOW}benji  >${RESET} nice, exactly what we needed"
sleep 1.2
echo -e "  ${CYAN}eliran >${RESET} ship it"
echo ""
sleep 3
