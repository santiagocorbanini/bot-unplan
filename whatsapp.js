const WHATSAPP_API_URL = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.WHATSAPP_TOKEN;

export async function sendWhatsAppMessage(phoneNumberId, to, text) {
  const res = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Error enviando mensaje WhatsApp:', err);
    return null;
  }

  return res.json();
}

export async function downloadAudioFile(mediaId) {
  // 1. Obtener la URL del archivo
  const metaRes = await fetch(`${WHATSAPP_API_URL}/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (!metaRes.ok) throw new Error('No se pudo obtener URL del audio');
  const { url } = await metaRes.json();

  // 2. Descargar el archivo
  const audioRes = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (!audioRes.ok) throw new Error('No se pudo descargar el audio');

  const arrayBuffer = await audioRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
