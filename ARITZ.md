# Aprendizajes: Dashboard ROI AI-Mate

Este documento resume las lecciones clave de arquitectura y desarrollo aprendidas durante la construcción de este Dashboard. El objetivo es consolidar el conocimiento para futuros proyectos de Soluciones de IA.

## 1. Arquitectura de Solución (AI Solution Architecture)

Hemos aplicado una arquitectura **Determinista para Datos** y **Agentica para el Desarrollo**.

### A. La Filosofia "Data-First"
En lugar de intentar que una IA "adivine" el ahorro, hemos construido un sistema matemático irrefutable:
*   **Log (Ejecución)**: "He hecho esto a tal hora".
*   **Metadata (Configuración)**: "Esto vale X dinero y Y tiempo".
*   **Resultado**: `Ahorro = Log * Metadata`.

**Lección**: Para métricas financieras, **NO** uses IA generativa. Usa cálculos deterministas (SQL/Código). La IA se usa para *ejecutar* la tarea, no para *auditarl*.

### B. Flujo de Datos (Data Flow)
El flujo es unidireccional y simple:
1.  **Trigger (n8n/Make)**: La automatización termina y envía un JSON al Webhook.
2.  **Ingestión (Next.js API)**: Valida la API Key y guarda el registro en `executions`.
3.  **Visualización (Server Components)**: Next.js lee de Supabase y renderiza los gráficos.
4.  **Consumo (Cliente)**: El cliente ve datos en tiempo real sin recargar (o con revalidación).

## 2. Stack Tecnológico Moderno

### Next.js 16 (App Router)
*   **Server Actions / API Routes**: Hemos usado `route.ts` para el webhook. Es backend puro dentro del frontend.
*   **Server Components**: El Dashboard (`page.tsx`) es asíncrono (`async function`). Hace las peticiones a la base de datos *en el servidor*, lo que es más seguro y rápido que hacerlas desde el navegador del cliente.

### Supabase (Postgres)
*   **Relacional**: Hemos separado `executions` (miles de filas) de `automation_metadata` (pocas filas). Esto ahorra espacio y permite cambiar el precio/hora de una automatización y que se actualice el cálculo retroactivamente (o mantener histórico si complicáramos el modelo).
*   **Foreign Keys**: `client_id` y `automation_id` aseguran la integridad de los datos.

### Shadcn/ui + Tailwind
*   **Componentes Reusables**: En lugar de escribir CSS, hemos "instanciado" componentes (`Card`, `Table`). Esto acelera el desarrollo x10.
*   **Estética**: "Slate" como base da un toque corporativo y limpio, alineado con software SaaS moderno.

## 3. Patrones de Código

### Directives Layer (Capa de Directivas)
Antes de escribir código, escribimos **SOPs** (`directives/`). Esto obliga a pensar antes de actuar.
*   Ayuda a que el Agente (yo) no alucine.
*   Sirve de documentación técnica inmediata.

### Self-Annealing (Auto-Recuperación)
Cuando falló la instalación de Next.js en la raíz (porque la carpeta no estaba vacía), no nos detuvimos. Creamos una carpeta temporal y movimos los archivos.
**Lección**: Un Arquitecto de IA debe diseñar sistemas que sepan recuperarse de errores esperados.

## 4. Estrategia de Despliegue (Ahorro Máximo)

Para desplegar este proyecto a coste **CERO** y compartirlo con clientes, la mejor estrategia es:

### Vercel (Frontend + Backend Limitado)
*   **Plan**: Hobby (Gratis).
*   **Por qué**: Next.js es de Vercel. La integración es nativa.
*   **Limitaciones**: Funciones serverless tienen un timeout de 10s (suficiente para nuestro webhook) y hay límites de ancho de banda (generoso para empezar).

### Supabase (Base de Datos)
*   **Plan**: Free Tier.
*   **Por qué**: Postgres gestionado gratis con 500MB de espacio (suficiente para miles de ejecuciones).
*   **Limitaciones**: Se pausa si no se usa en una semana (pero se reactiva al instante).

**Proceso de Despliegue**:
1.  Subir código a GitHub.
2.  Importar proyecto en Vercel.com.
3.  Añadir Variables de Entorno en Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4.  Redeploy.

---
**Resumen**: Un buen Arquitecto de IA no solo sabe de Prompts. Sabe de **Bases de Datos, APIs, Estructura y Costes**. La IA es el motor, pero la Nube es la carretera.

---

## 5. Autenticación Multi-Tenant Profesional

### El Flujo Correcto de Invitación de Usuarios

**❌ MAL (Anti-patrón)**: El admin crea usuario con contraseña → El admin comparte la contraseña al cliente.
- Inseguro (la contraseña viaja en texto plano)
- No profesional (el admin conoce las credenciales)
- Problemas de responsabilidad

**✅ BIEN (Patrón Profesional)**: El admin invita por email → El cliente crea su propia contraseña.
- El admin solo necesita el email del cliente
- El cliente recibe un email de invitación
- El cliente elige su propia contraseña (nunca la ve el admin)

### Implementación con Supabase Auth

```typescript
// ❌ MAL - El admin pone la contraseña
await supabaseAdmin.auth.admin.createUser({
  email,
  password: passwordPuestasPorAdmin, // INSEGURO
  email_confirm: true
});

// ✅ BIEN - Invitación por email
await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  redirectTo: 'https://tuapp.com/login'
});
// El cliente recibe email para crear su contraseña
```

### Arquitectura de Roles

| Rol | Acceso | Autenticación |
|-----|--------|---------------|
| **Admin** | Panel `/admin`, ve todos los clientes | JWT firmado + contraseña hasheada |
| **Cliente** | Dashboard `/`, solo sus datos | Supabase Auth (email + contraseña propia) |

### Service Role Key

Para operaciones de admin (crear/invitar usuarios), necesitas la **Service Role Key**:

1. **Dónde obtenerla**: Supabase → Settings → API → `service_role` (secreta)
2. **NUNCA exponerla en frontend** (solo en variables de servidor)
3. **Añadir a Vercel**: Environment Variables → `SUPABASE_SERVICE_ROLE_KEY`

### RLS (Row Level Security) para Multi-Tenant

Cada cliente debe ver **solo sus datos**:

```sql
-- El cliente autenticado solo ve sus propias ejecuciones
CREATE POLICY "Clients see own data"
ON executions FOR SELECT
TO authenticated
USING (
  automation_id IN (
    SELECT id FROM automation_metadata
    WHERE client_id IN (
      SELECT id FROM clients WHERE auth_user_id = auth.uid()
    )
  )
);
```

### Lección Clave

> La seguridad en SaaS multi-tenant no es opcional. El patrón de **"invitación por email + contraseña propia"** es el estándar de la industria. Nunca diseñes un sistema donde el admin conozca las contraseñas de los usuarios.

## 6. Hardening Proactivo y Seguridad en Producción

### El Mito de "El Email Siempre Llega"
Confiar ciegamente en servicios de terceros (como el SMTP de Supabase) para procesos críticos (Login/Recuperación) es un error de novato.
*   **Problema**: Rate Limits (30 emails/hora) o IP reputation mala pueden bloquear el acceso a TODA tu base de usuarios.
*   **Solución (Patrón "God Mode")**: Implementar siempre **Herramientas de Emergencia en el Admin Panel** que permitan:
    1.  Generar links de recuperación manualmente (Bypass SMTP).
    2.  Forzar cambio de contraseña manualmente (Bypass Auth Tokens).
    This ensures que como Admin/Soporte, NUNCA estás bloqueado por un proveedor externo.

### Usuarios Huérfanos (Data Integrity)
En sistemas desacoplados (Auth en Supabase vs Perfiles en tu DB `clients`):
*   **Riesgo**: Se crea el Auth User pero falla el INSERT en `clients`. Resultado: El usuario puede loguearse pero la app explota o sale vacía.
*   **Solución**: La API de creación (`/api/client`) debe ser **Idempotente y Reparadora**.
    - Si detecta que el Auth User ya existe, no debe fallar, debe verificar si falta el perfil y crearlo ("Self-Healing").

### Seguridad en Vercel
*   **Service Role Key**: Es distinta de la Anon Key. Es CRÍTICA para que funcionen las APIs de administración (`/api/admin/*`).
*   **Error Común**: Olvidar añadirla en Vercel > Settings > Env Vars provoca errores 500 silenciosos que el frontend interpreta como "Error de Conexión".
*   **Debug**: En producción, asegúrate de que tus APIs devuelvan errores claros (sin exponer secretos) en lugar de morir silenciosamente.

### Auditoría de Logs (PII)
*   **Peligro**: Dejar `console.log(email)` o `console.log(user)` en producción viola GDPR y seguridad.
*   **Regla**: Audita tu código buscando `console.log` antes de desplegar. Nunca loguees datos personales identificables (PII) en los logs del servidor.

## 7. Seguridad de Tokens y Autenticación de Admin (CRÍTICO)

### El Error Fatal: Tokens Falsiﬁcables
**❌ MAL (Lo que teníamos antes)**:
```typescript
// Token que cualquier hacker puede crear
const token = Buffer.from(`admin:${Date.now()}`).toString('base64');
```
Problema: Un atacante solo tiene que generar `btoa("admin:123456789")` y ya tiene acceso admin.

**✅ BIEN (Lo que tenemos ahora)**:
```typescript
// Token JWT firmado con secreto del servidor
import { SignJWT } from 'jose';
const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
```
Sin conocer `JWT_SECRET`, es imposible falsificar el token.

### Patrón de Middleware para Proteger Endpoints
Crear un helper `requireAdmin()` que:
1. Lee la cookie de sesión
2. Verifica el JWT
3. Devuelve 401 si no es válido

```typescript
// En cada endpoint admin:
export async function POST(request: Request) {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;
    
    // ... resto del código protegido
}
```

### API Keys: Nunca Exponer en GET Públicos
**❌ MAL**: `/api/clients` devuelve `{ id, name, api_key }` a cualquiera.
**✅ BIEN**: `/api/clients` devuelve `{ id, name }`. Para ver la key hay un endpoint separado `/api/clients/[id]/key` que require admin auth.

### Variables de Entorno Obligatorias para Producción
| Variable | Propósito | Cómo Generar |
|----------|-----------|--------------|
| `JWT_SECRET` | Firmar tokens admin | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones admin DB | Supabase Dashboard → Settings → API |
| `ADMIN_PASSWORD` | Login admin (mínimo) | Elegir contraseña fuerte |

### Checklist de Seguridad Pre-Deploy
- [ ] ¿Usas JWT en lugar de base64 para sesiones?
- [ ] ¿Todos los endpoints `/api/admin/*` tienen `requireAdmin()`?
- [ ] ¿Las API keys están ocultas en GET responses?
- [ ] ¿`JWT_SECRET` está en Vercel Environment Variables?
- [ ] ¿No hay `console.log(email)` ni datos PII en logs?

> **Lección Final**: La seguridad no es "opcional cuando tengamos tiempo". Cada proyecto que sale a producción sin JWT firmados, con tokens base64, o exponiendo API keys en GET públicos es una bomba de tiempo. Arréglalo ANTES de tener usuarios reales.
