# 🔒 Security Audit Scripts

Herramientas automatizadas para auditoría de seguridad antes de deployment a producción.

---

## 📋 Comandos Disponibles

### 1. Auditoría Completa (Recomendado)
```bash
npm run audit:full
```
- Ejecuta todos los checks de seguridad
- Genera reportes en formato Markdown, HTML y JSON
- Calcula score de seguridad (0-10)
- Da recomendación de deployment

### 2. Solo Auditoría (Sin reportes visuales)
```bash
npm run audit:security
```
- Ejecuta los checks de seguridad
- Muestra resultados en consola
- Genera reporte Markdown básico

### 3. Solo Generar Reportes
```bash
npm run audit:report
```
- Genera reportes HTML y JSON desde el último audit
- Útil para compartir con el equipo

---

## 📊 Checks de Seguridad Incluidos

### 🔴 CRÍTICOS
1. **Hardcoded Secrets** - Busca contraseñas/API keys en código
2. **JWT Configuration** - Verifica JWT_SECRET configurado
3. **Admin Password** - Verifica hash bcrypt (no plain text)
4. **Admin Authentication** - Verifica implementación JWT

### 🟡 ALTOS
5. **Endpoint Protection** - Verifica todos los endpoints admin protegidos
6. **Rate Limiting** - Busca implementación de rate limiting
7. **RLS Policies** - Verifica políticas restrictivas de base de datos

### 🟠 MEDIOS
8. **Security Headers** - Verifica middleware con CSP, X-Frame-Options, etc.
9. **Dependency Vulnerabilities** - npm audit
10. **Health Endpoint** - Verifica endpoint de monitoreo

---

## 📁 Reportes Generados

Todos los reportes se guardan en `.tmp/`:

| Archivo | Formato | Uso |
|---------|---------|-----|
| `security_audit_report.md` | Markdown | Lectura rápida, Git-friendly |
| `security_audit_report.html` | HTML | Vista visual con gráficos |
| `security_audit_report.json` | JSON | Integración CI/CD |

### Ver Reporte HTML
```bash
# Windows
start .tmp/security_audit_report.html

# Linux/Mac
open .tmp/security_audit_report.html
```

---

## 🎯 Scores y Recomendaciones

### Score 8-10/10: ✅ READY FOR DEPLOYMENT
- Todos los checks críticos pasados
- Seguridad sólida
- Deploy aprobado

### Score 6-7/10: ⚠️ CONDITIONAL GO
- Algunos issues de alta prioridad
- Recomendado fix antes de launch
- Deploy con precaución

### Score 0-5/10: ⛔ BLOCK DEPLOYMENT
- Issues críticos presentes
- NO deployar hasta fix
- Riesgo de seguridad alto

---

## 🔧 Configuración

### Requisitos
- Node.js ≥ 16
- npm o yarn
- Git Bash (Windows) o bash shell (Linux/Mac)

### Opcional (para mejor experiencia)
```bash
# Instalar ripgrep (mejor búsqueda de secrets)
# Windows (con Chocolatey)
choco install ripgrep

# Mac
brew install ripgrep

# Linux
sudo apt install ripgrep
```

---

## 🚀 Uso en CI/CD

### GitHub Actions
```yaml
name: Security Audit

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run audit:security
      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: security-report
          path: .tmp/security_audit_report.html
```

### Vercel (Pre-deployment Hook)
```json
{
  "scripts": {
    "vercel-build": "npm run audit:security && npm run build"
  }
}
```

---

## 📖 Guía de Fixes Rápidos

### 🔴 Critical: Hardcoded Secrets
```bash
# 1. Move secrets to .env
echo "API_KEY=your_secret_here" >> .env

# 2. Add .env to .gitignore
echo ".env" >> .gitignore

# 3. Remove from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
```

### 🔴 Critical: JWT_SECRET Missing
```bash
# Generate secure secret
openssl rand -base64 32

# Add to .env
echo "JWT_SECRET=<generated-secret>" >> .env
```

### 🔴 Critical: Plain Text Admin Password
```bash
# Generate bcrypt hash
node -e "console.log(require('bcryptjs').hashSync('YourNewPassword123!', 12))"

# Add to .env (remove ADMIN_PASSWORD)
echo "ADMIN_PASSWORD_HASH=<hash>" >> .env
```

### 🟡 High: Missing Security Headers
```bash
# Create middleware file
cat > src/middleware.ts << 'EOF'
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Content-Security-Policy', "default-src 'self'");
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
EOF
```

---

## 🆘 Troubleshooting

### Script no ejecuta en Windows
```bash
# Usar Git Bash
"C:\Program Files\Git\bin\bash.exe" scripts/security-audit.sh

# O WSL
wsl bash scripts/security-audit.sh
```

### Permiso denegado
```bash
chmod +x scripts/security-audit.sh
chmod +x scripts/generate-audit-report.js
```

### npm audit tarda mucho
```bash
# Solo production dependencies
npm audit --production

# Skip audit
npm install --no-audit
```

---

## 📚 Referencias

- [production-audit.md](../production-audit.md) - Guía completa de auditoría
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)

---

## 🤝 Contribuir

Para mejorar los scripts de auditoría:

1. Edita `scripts/security-audit.sh` para nuevos checks
2. Actualiza `production-audit.md` con documentación
3. Prueba con `npm run audit:full`
4. Commit y push

---

**Última actualización:** 2026-02-01
**Versión:** 1.0.0
**Mantenido por:** Tu equipo de desarrollo
