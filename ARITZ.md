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
