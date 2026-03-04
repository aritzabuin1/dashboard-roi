# Configurar plantillas de email en Supabase

## IMPORTANTE — Cambio respecto a la versión anterior

Las plantillas ahora usan `{{ .TokenHash }}` en vez de `{{ .ConfirmationURL }}`.
Esto hace que el enlace vaya DIRECTAMENTE a nuestra app (sin pasar por el servidor de Supabase como intermediario), lo que soluciona el problema de que el usuario acababa en el login sin sesión.

## Pasos

1. Ve a **Supabase Dashboard** → tu proyecto → **Authentication** → **Email Templates**
2. Para cada plantilla, cambia el **Subject** y reemplaza TODO el **Body** con el HTML del archivo correspondiente
3. Guarda cada una

## 1. Invite (Invitación)

- **Subject:** `Te han invitado a AI-Mate`
- **Body:** Copia el contenido de `invite.html`

## 2. Reset Password (Restablecer contraseña)

- **Subject:** `Restablecer contraseña — AI-Mate`
- **Body:** Copia el contenido de `reset-password.html`

## 3. Magic Link (Enlace mágico)

- **Subject:** `Tu enlace de acceso a AI-Mate`
- **Body:** Copia el contenido de `magic-link.html`

## 4. Confirm Signup (Confirmación de registro)

- **Subject:** `Confirma tu cuenta en AI-Mate`
- **Body:** Copia el contenido de `confirm-signup.html`

## Verificación

Después de guardar las 4 plantillas:
1. Desde el admin, invita a un cliente con tu email
2. Revisa que el email llegue con el diseño correcto
3. Haz clic en "Crear mi contraseña"
4. Deberías llegar a la pantalla de establecer contraseña (NO al login)
