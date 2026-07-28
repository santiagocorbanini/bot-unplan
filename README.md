# Experto Cerca - WhatsApp Bot POC

Bot de WhatsApp que recibe mensajes de texto o audio, interpreta el problema con IA y devuelve profesionales de Supabase.

## Stack (todo gratis)
- **Groq** → Llama 3 para clasificar + Whisper para transcribir audio
- **Meta WhatsApp Business API** → gratis hasta 1000 conversaciones/mes
- **Supabase** → tu base de datos existente
- **Render/Railway** → deploy gratuito

---

## Setup paso a paso

### 1. Clonar e instalar
```bash
npm install
cp .env.example .env
```

### 2. Obtener Groq API Key (gratis)
1. Ir a https://console.groq.com
2. Crear cuenta
3. Copiar API Key → `GROQ_API_KEY`

### 3. Configurar WhatsApp Business API (Meta)
1. Ir a https://developers.facebook.com
2. Crear app → tipo "Business"
3. Agregar producto "WhatsApp"
4. En "API Setup" copiás el token temporal → `WHATSAPP_TOKEN`
5. El webhook URL va a ser: `https://tu-servidor.com/webhook`
6. El Verify Token es: `experto_cerca_token` (o el que pongas en `.env`)

### 4. Deploy en Render (gratis)
1. Subir este código a GitHub
2. Ir a https://render.com → New Web Service
3. Conectar el repo
4. Agregar las variables de entorno
5. Deploy → te da una URL pública

### 5. Configurar webhook en Meta
Con la URL de Render, volvés a Meta Developers y configurás el webhook.

---

## Flujo del bot

```
Usuario manda mensaje (texto o audio)
        ↓
  [Si audio] Groq Whisper transcribe
        ↓
  Groq Llama 3 clasifica el problema
  → category, serviceDescription, isEmergency
        ↓
  Supabase busca profesionales por
  specialty_category + specialty + description
        ↓
  Bot responde con hasta 3 profesionales
  y links a sus perfiles
```

---

## Probar localmente con ngrok

```bash
# Instalar ngrok (gratis)
npm install -g ngrok

# Correr el servidor
npm run dev

# En otra terminal, exponer el puerto
ngrok http 3000

# La URL de ngrok la usás temporalmente en Meta Developers
```
# bot-unplan
