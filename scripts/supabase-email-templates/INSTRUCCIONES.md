# Configurar plantillas de email en Supabase

## Pasos

1. Ve a **Supabase Dashboard** → tu proyecto → **Authentication** → **Email Templates**
2. Para cada plantilla, copia el **Subject** y el **Body** indicados abajo
3. Pega el HTML del archivo correspondiente en el campo **Body** (reemplaza TODO el contenido)
4. Guarda cada plantilla

---

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

---

## Importante

- La variable `{{ .ConfirmationURL }}` la rellena Supabase automáticamente. NO la cambies.
- Después de guardar, prueba enviando una invitación a un email tuyo.
