import express from 'express';
import { handleIncomingMessage } from './handler.js';

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'experto_cerca_token';

// Webhook verification (Meta requiere esto)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado ✓');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Recibe mensajes entrantes
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Responder rápido a Meta

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (value?.statuses) {
      console.log('Status update:', JSON.stringify(value.statuses, null, 2));
    }

    if (!messages || messages.length === 0) return;

    const message = messages[0];
    const from = message.from; // número del usuario
    const phoneNumberId = value.metadata.phone_number_id;

    console.log(`Mensaje de ${from}:`, message.type);

    await handleIncomingMessage({ message, from, phoneNumberId });
  } catch (err) {
    console.error('Error procesando webhook:', err);
  }
});

app.get('/', (req, res) => res.send('Experto Cerca Bot activo ✓'));

app.get('/health', (req, res) => {
  const checks = {
    status: 'ok',
    uptime: process.uptime(),
    env: {
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
      WHATSAPP_TOKEN: !!process.env.WHATSAPP_TOKEN,
      VERIFY_TOKEN: !!process.env.VERIFY_TOKEN,
    },
  };
  const allOk = Object.values(checks.env).every(Boolean);
  res.status(allOk ? 200 : 500).json(checks);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
