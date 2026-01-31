# Guía de Integración: Dashboard ROI AI-Mate

Esta guía explica cómo enviar datos desde tus automatizaciones (n8n, Make, etc.) al Dashboard para rastrear el ahorro en tiempo real.

---

## 📋 Paso 1: Configurar Clientes y Automatizaciones

Antes de conectar tus workflows, debes configurar el sistema desde el **Panel de Administración**.

### Acceso al Panel Admin
- **Local**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Producción**: `https://tudominio.com/admin`

### Crear un Cliente
1. Ve al panel `/admin`.
2. En "Añadir Cliente", escribe el nombre (ej. "Mi Empresa").
3. Click en **Crear Cliente**.
4. **Copia la API Key generada** (ej. `sk_a1b2c3d4...`).

### Crear una Automatización
1. En el mismo panel, baja a "Añadir Automatización".
2. Selecciona el cliente.
3. Escribe el nombre exacto (ej. "Procesado Facturas").
4. Indica el **tiempo manual** (minutos) y **coste/hora** (€).
5. Click en **Añadir**.

> ⚠️ **Importante**: El `automation_name` que envíes desde n8n/Make debe coincidir EXACTAMENTE con el nombre configurado aquí.

---

## 📡 Paso 2: Configurar el Webhook

### Endpoint
**URL:** `https://tudominio.com/api/execution-webhook`  
**Método:** `POST`  
**Headers:** `Content-Type: application/json`

*(En desarrollo local: `http://localhost:3000/api/execution-webhook`)*

### Payload (Datos a enviar)

```json
{
  "api_key": "sk_tu_api_key_aqui",
  "automation_name": "Nombre Exacto de la Automatización",
  "status": "success"
}
```

| Campo | Descripción |
|-------|-------------|
| `api_key` | La clave del cliente (obtenida en Paso 1) |
| `automation_name` | Nombre exacto (debe coincidir con lo configurado) |
| `status` | `"success"` o `"error"` |
| `timestamp` | (Opcional) Fecha ISO. Si no se envía, usa la hora actual |

---

## 🟢 Paso 3: Integración en n8n

1.  Añade un nodo **HTTP Request** al final de tu workflow (rama de éxito).
2.  **Method**: POST.
3.  **URL**: `https://tudominio.com/api/execution-webhook`.
4.  **Body Content Type**: JSON.
5.  **JSON Body**:
    ```json
    {
      "api_key": "sk_a1b2c3d4e5f6...",
      "automation_name": "Clasificador Emails",
      "status": "success"
    }
    ```

---

## 🟣 Paso 4: Integración en Make

1.  Añade un módulo **HTTP / Make a request** al final de tu escenario.
2.  **URL**: `https://tudominio.com/api/execution-webhook`.
3.  **Method**: POST.
4.  **Body Type**: Raw -> Content type: JSON (application/json).
5.  **Request Content**:
    ```json
    {
      "api_key": "sk_a1b2c3d4e5f6...",
      "automation_name": "Gestión Leads",
      "status": "success"
    }
    ```

---

## ✅ Verificación

1. Ejecuta tu workflow de prueba.
2. Abre el Dashboard principal (`/`).
3. Deberías ver la ejecución en la tabla "Últimas Ejecuciones".
4. Las métricas de ahorro se calcularán automáticamente basándose en la configuración de la automatización.

---

## 🧪 Test Rápido con cURL

```bash
curl -X POST http://localhost:3000/api/execution-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "TU_API_KEY",
    "automation_name": "Test Automation",
    "status": "success"
  }'
```
