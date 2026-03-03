#!/bin/bash

# Security Audit Script
# Automated security checks for production readiness
# Based on production-audit.md v2.0

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CRITICAL_ISSUES=0
HIGH_ISSUES=0
MEDIUM_ISSUES=0
LOW_ISSUES=0
CHECKS_PASSED=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🔒 SECURITY AUDIT - PRODUCTION READINESS          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Create temporary report directory
REPORT_DIR=".tmp"
mkdir -p "$REPORT_DIR"
REPORT_FILE="$REPORT_DIR/security_audit_report.md"

# Initialize report
cat > "$REPORT_FILE" << EOF
# Security Audit Report
**Date:** $(date +"%Y-%m-%d %H:%M:%S")
**Project:** $(basename "$(pwd)")

---

## Summary
EOF

echo -e "${BLUE}[1/10]${NC} Scanning for hardcoded secrets..."

# Check 1: Hardcoded Secrets
SECRETS_FOUND=0
if command -v rg &> /dev/null; then
    SECRETS=$(rg -i "(password|api_key|secret|token)\s*=\s*['\"][^'\"]{8,}" --type ts --type js --type py 2>/dev/null || true)
    if [ -n "$SECRETS" ]; then
        echo -e "${RED}  ❌ CRITICAL: Hardcoded secrets found!${NC}"
        ((CRITICAL_ISSUES++))
        SECRETS_FOUND=1
        echo -e "\n## 🔴 CRITICAL: Hardcoded Secrets Found\n" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        echo "$SECRETS" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
    else
        echo -e "${GREEN}  ✅ No hardcoded secrets found${NC}"
        ((CHECKS_PASSED++))
    fi
else
    echo -e "${YELLOW}  ⚠️  ripgrep not installed, skipping secret scan${NC}"
fi

echo -e "${BLUE}[2/10]${NC} Checking .gitignore configuration..."

# Check 2: .gitignore
GITIGNORE_ISSUES=0
if [ -f ".gitignore" ]; then
    if ! grep -q "^\.env$" .gitignore; then
        echo -e "${RED}  ❌ HIGH: .env not in .gitignore${NC}"
        ((HIGH_ISSUES++))
        GITIGNORE_ISSUES=1
    else
        echo -e "${GREEN}  ✅ .env properly ignored${NC}"
        ((CHECKS_PASSED++))
    fi
else
    echo -e "${RED}  ❌ CRITICAL: .gitignore file missing!${NC}"
    ((CRITICAL_ISSUES++))
fi

echo -e "${BLUE}[3/10]${NC} Checking environment variables..."

# Check 3: Environment Variables
ENV_ISSUES=0
if [ -f ".env" ]; then
    echo -e "${YELLOW}  ⚠️  Checking required environment variables...${NC}"

    # Check for JWT_SECRET
    if ! grep -q "^JWT_SECRET=" .env; then
        echo -e "${RED}    ❌ CRITICAL: JWT_SECRET not configured${NC}"
        ((CRITICAL_ISSUES++))
        ENV_ISSUES=1
    else
        echo -e "${GREEN}    ✅ JWT_SECRET configured${NC}"
        ((CHECKS_PASSED++))
    fi

    # Check for ADMIN_PASSWORD_HASH
    if grep -q "^ADMIN_PASSWORD=" .env && ! grep -q "^ADMIN_PASSWORD_HASH=" .env; then
        echo -e "${RED}    ❌ CRITICAL: Plain text ADMIN_PASSWORD found (should use ADMIN_PASSWORD_HASH)${NC}"
        ((CRITICAL_ISSUES++))
        ENV_ISSUES=1
    elif grep -q "^ADMIN_PASSWORD_HASH=" .env; then
        echo -e "${GREEN}    ✅ ADMIN_PASSWORD_HASH configured${NC}"
        ((CHECKS_PASSED++))
    fi
else
    echo -e "${YELLOW}  ⚠️  .env file not found (might be in production only)${NC}"
fi

echo -e "${BLUE}[4/10]${NC} Checking admin authentication..."

# Check 4: Admin Authentication
if [ -f "src/lib/auth-admin.ts" ]; then
    # Check for JWT implementation
    if grep -q "jose" "src/lib/auth-admin.ts" && grep -q "SignJWT" "src/lib/auth-admin.ts"; then
        echo -e "${GREEN}  ✅ JWT authentication implemented${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}  ❌ HIGH: JWT not properly implemented${NC}"
        ((HIGH_ISSUES++))
    fi

    # Check for fallback dev secret
    if grep -q "fallback-dev-secret" "src/lib/auth-admin.ts"; then
        echo -e "${YELLOW}  ⚠️  WARNING: Fallback dev secret present (ensure JWT_SECRET is set in production)${NC}"
    fi
else
    echo -e "${RED}  ❌ CRITICAL: Admin authentication file missing${NC}"
    ((CRITICAL_ISSUES++))
fi

echo -e "${BLUE}[5/10]${NC} Checking endpoint protection..."

# Check 5: Endpoint Protection
UNPROTECTED_ENDPOINTS=0
if [ -d "src/app/api/admin" ]; then
    # Check admin routes for requireAdmin
    for route in src/app/api/admin/*/route.ts; do
        if [ -f "$route" ]; then
            if ! grep -q "requireAdmin" "$route"; then
                echo -e "${RED}  ❌ HIGH: Unprotected admin endpoint: $(basename "$(dirname "$route")")${NC}"
                ((HIGH_ISSUES++))
                UNPROTECTED_ENDPOINTS=1
            fi
        fi
    done

    if [ $UNPROTECTED_ENDPOINTS -eq 0 ]; then
        echo -e "${GREEN}  ✅ All admin endpoints protected${NC}"
        ((CHECKS_PASSED++))
    fi
else
    echo -e "${YELLOW}  ⚠️  No admin API routes found${NC}"
fi

echo -e "${BLUE}[6/10]${NC} Checking security headers (middleware)..."

# Check 6: Security Headers
if [ -f "src/middleware.ts" ]; then
    if grep -q "X-Frame-Options" "src/middleware.ts" && grep -q "Content-Security-Policy" "src/middleware.ts"; then
        echo -e "${GREEN}  ✅ Security headers configured${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}  ⚠️  MEDIUM: Security headers incomplete${NC}"
        ((MEDIUM_ISSUES++))
    fi
else
    echo -e "${YELLOW}  ⚠️  MEDIUM: No middleware.ts (security headers missing)${NC}"
    ((MEDIUM_ISSUES++))
fi

echo -e "${BLUE}[7/10]${NC} Checking rate limiting..."

# Check 7: Rate Limiting
if [ -f "src/lib/rate-limit-upstash.ts" ] || grep -rq "Ratelimit" src/lib/ 2>/dev/null; then
    echo -e "${GREEN}  ✅ Rate limiting implemented${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}  ⚠️  HIGH: No rate limiting found (vulnerable to brute force)${NC}"
    ((HIGH_ISSUES++))
fi

echo -e "${BLUE}[8/10]${NC} Running npm audit..."

# Check 8: Dependency Vulnerabilities
if command -v npm &> /dev/null; then
    echo -e "${YELLOW}  ⏳ Running npm audit...${NC}"
    NPM_AUDIT=$(npm audit --production --json 2>/dev/null || echo '{"error": true}')

    # Parse audit results
    CRITICAL_VULN=$(echo "$NPM_AUDIT" | grep -o '"critical":[0-9]*' | cut -d':' -f2 || echo "0")
    HIGH_VULN=$(echo "$NPM_AUDIT" | grep -o '"high":[0-9]*' | cut -d':' -f2 || echo "0")

    if [ "$CRITICAL_VULN" != "0" ] && [ -n "$CRITICAL_VULN" ]; then
        echo -e "${RED}  ❌ CRITICAL: $CRITICAL_VULN critical vulnerabilities found${NC}"
        ((CRITICAL_ISSUES++))
    elif [ "$HIGH_VULN" != "0" ] && [ -n "$HIGH_VULN" ]; then
        echo -e "${YELLOW}  ⚠️  HIGH: $HIGH_VULN high vulnerabilities found${NC}"
        ((HIGH_ISSUES++))
    else
        echo -e "${GREEN}  ✅ No critical/high vulnerabilities${NC}"
        ((CHECKS_PASSED++))
    fi
else
    echo -e "${YELLOW}  ⚠️  npm not found, skipping audit${NC}"
fi

echo -e "${BLUE}[9/10]${NC} Checking RLS policies..."

# Check 9: RLS Policies (for Supabase projects)
if [ -f "execution/rls_policies.sql" ]; then
    if grep -q "USING (true)" "execution/rls_policies.sql"; then
        echo -e "${YELLOW}  ⚠️  WARNING: Permissive RLS policies found (check if v2 is applied)${NC}"
    fi

    if [ -f "execution/rls_policies_v2.sql" ]; then
        echo -e "${GREEN}  ✅ RLS v2 policies file exists${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}  ⚠️  HIGH: No restrictive RLS policies found${NC}"
        ((HIGH_ISSUES++))
    fi
else
    echo -e "${YELLOW}  ⚠️  No RLS policies found (skipping if not using Supabase)${NC}"
fi

echo -e "${BLUE}[10/10]${NC} Checking production configuration..."

# Check 10: Production Config
PROD_ISSUES=0
if [ -f "next.config.ts" ] || [ -f "next.config.js" ]; then
    echo -e "${GREEN}  ✅ Next.js config exists${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}  ⚠️  No Next.js config found${NC}"
fi

# Check for health endpoint
if [ -f "src/app/api/health/route.ts" ]; then
    echo -e "${GREEN}  ✅ Health endpoint exists${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}  ⚠️  MEDIUM: No health endpoint (recommended for monitoring)${NC}"
    ((MEDIUM_ISSUES++))
fi

# Generate final report
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    AUDIT RESULTS                        ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"

# Calculate score
TOTAL_CHECKS=$((CHECKS_PASSED + CRITICAL_ISSUES + HIGH_ISSUES + MEDIUM_ISSUES + LOW_ISSUES))
if [ $TOTAL_CHECKS -gt 0 ]; then
    SCORE=$((CHECKS_PASSED * 10 / TOTAL_CHECKS))
else
    SCORE=0
fi

echo -e "${GREEN}✅ Checks Passed:${NC}     $CHECKS_PASSED"
echo -e "${RED}🔴 Critical Issues:${NC}   $CRITICAL_ISSUES"
echo -e "${YELLOW}🟡 High Issues:${NC}       $HIGH_ISSUES"
echo -e "${YELLOW}🟠 Medium Issues:${NC}     $MEDIUM_ISSUES"
echo -e "${BLUE}🔵 Low Issues:${NC}        $LOW_ISSUES"
echo ""
echo -e "${BLUE}📊 Security Score:${NC}    ${SCORE}/10"

# Update report summary
cat >> "$REPORT_FILE" << EOF

- **Critical Issues:** $CRITICAL_ISSUES
- **High Issues:** $HIGH_ISSUES
- **Medium Issues:** $MEDIUM_ISSUES
- **Low Issues:** $LOW_ISSUES
- **Checks Passed:** $CHECKS_PASSED
- **Overall Score:** ${SCORE}/10

---

## Deployment Recommendation

EOF

# Deployment recommendation
if [ $CRITICAL_ISSUES -gt 0 ]; then
    echo -e "${RED}⛔ BLOCK DEPLOYMENT${NC} - Critical security issues found"
    echo "**⛔ BLOCK DEPLOYMENT** - Fix $CRITICAL_ISSUES critical issue(s) before deploying." >> "$REPORT_FILE"
    EXIT_CODE=2
elif [ $HIGH_ISSUES -gt 0 ]; then
    echo -e "${YELLOW}⚠️  CONDITIONAL GO${NC} - Fix high priority issues before launch"
    echo "**⚠️ CONDITIONAL GO** - Strongly recommend fixing $HIGH_ISSUES high priority issue(s) before deploying." >> "$REPORT_FILE"
    EXIT_CODE=1
else
    echo -e "${GREEN}✅ READY FOR DEPLOYMENT${NC} - All critical checks passed"
    echo "**✅ READY FOR DEPLOYMENT** - All critical security checks passed." >> "$REPORT_FILE"
    EXIT_CODE=0
fi

echo ""
echo -e "${BLUE}📄 Full report saved to:${NC} $REPORT_FILE"
echo ""

# Add detailed recommendations to report
cat >> "$REPORT_FILE" << 'EOF'

---

## Quick Fixes

### If you have critical issues:

1. **Remove hardcoded secrets:** Move all secrets to `.env` file
2. **Configure JWT_SECRET:** Run `openssl rand -base64 32` and add to `.env`
3. **Hash admin password:** Use bcryptjs to generate hash and store in `ADMIN_PASSWORD_HASH`
4. **Fix dependency vulnerabilities:** Run `npm audit fix`

### For high priority issues:

5. **Add security headers:** Create `src/middleware.ts` with CSP, X-Frame-Options, etc.
6. **Implement rate limiting:** Use Upstash Redis for serverless environments
7. **Apply RLS policies:** Run `rls_policies_v2.sql` in Supabase SQL Editor
8. **Protect endpoints:** Add `requireAdmin()` to all admin routes

---

## Next Steps

1. Review this report and prioritize fixes
2. Address critical issues immediately (block deployment)
3. Schedule fixes for high/medium issues
4. Re-run audit: `npm run audit:security`

For detailed guidance, see: `production-audit.md`

EOF

exit $EXIT_CODE
