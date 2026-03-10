#!/bin/bash
# Simulates a claude-duet session for the demo gif
# Colors
ORANGE='\033[38;5;208m'
YELLOW='\033[33m'
GREEN='\033[32m'
DIM='\033[2m'
ITALIC='\033[3m'
BOLD='\033[1m'
RESET='\033[0m'

sleep 0.8
echo ""
echo -e "  ${BOLD}${ORANGE}✦${RESET} ${BOLD}claude-duet${RESET} session started"
echo -e "  ${DIM}Code: cd-7f3a · Password: ocean-breeze${RESET}"
echo ""
echo -e "  ${DIM}npx claude-duet join cd-7f3a --password ocean-breeze --url ws://192.168.1.5:4567${RESET}"
echo ""
sleep 2

echo -e "  ${GREEN}✦ benji joined the session${RESET}"
echo ""
sleep 1.5

echo -e "  ${DIM}you:${RESET} hey, there's a bug in auth.ts — token never expires"
sleep 1.5
echo -e "  ${BOLD}${YELLOW}benji:${RESET} yeah I saw it, let's ask claude"
echo ""
sleep 1.5

echo -e "  ${BOLD}${YELLOW}benji:${RESET} @claude fix the token expiry bug in src/auth.ts"
echo ""
sleep 0.8

echo -e "  ${DIM}⚡ approve benji's prompt? (y/n)${RESET} ${GREEN}y${RESET}"
echo ""
sleep 1

echo -e "  ${ORANGE}✦${RESET} ${BOLD}${ORANGE}Claude${RESET}"
echo -e "  I'll fix the token expiry bug."
sleep 0.5
echo ""
echo -e "  ${ORANGE}▸${RESET} Edit src/auth.ts"
echo -e "  ${ORANGE}◂${RESET} Edit: added expiry check"
echo -e "  ${GREEN}+${RESET} if (isTokenExpired(token)) throw new AuthError('expired')"
echo ""
sleep 0.5
echo -e "  ${ORANGE}✦${RESET} \$0.004 · 1.8s"
echo ""
sleep 1.5

echo -e "  ${DIM}${ITALIC}  benji is typing...${RESET}"
sleep 0.8
printf "\r\033[K"
echo -e "  ${BOLD}${YELLOW}benji:${RESET} nice, exactly what we needed"
sleep 1.2
echo -e "  ${DIM}you:${RESET} ship it"
echo ""
sleep 3
