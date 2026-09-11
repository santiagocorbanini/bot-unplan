import { classifyMessage, transcribeAudio } from './ai.js';
import { sendWhatsAppMessage, downloadAudioFile } from './whatsapp.js';
import fetch from 'node-fetch';

// Función para obtener los datos de la API de Pampacode
export async function getActualShows() {
  try {
    const response = await fetch('https://api.pampacode.com/shows/actualShows');
    if (!response.ok) {
      throw new Error(`Error al obtener los datos: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data; // Devuelve solo la lista de shows
  } catch (error) {
    console.error('Error al obtener los datos de la API:', error);
    throw error;
  }
}

async function notifyDiscordError(step, from, err) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const content = `🚨 **Error en el proceso**\n📱 **De:** +${from}\n⚙️ **Paso:** ${step}\n❌ **Error:** \`${err?.message || err}\``;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  } catch (notifyErr) {
    console.error('Error enviando alerta de error a Discord:', notifyErr);
  }
}

async function forwardToDiscord(from, type, text, audioBuffer = null) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const content = `**Nuevo mensaje de WhatsApp**\n📱 **De:** +${from}\n📝 **Tipo:** ${type}\n💬 **Mensaje:** ${text || '_(sin texto)_'}`;

  try {
    if (audioBuffer) {
      const form = new FormData();
      form.append('payload_json', JSON.stringify({ content }));
      form.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
      await fetch(webhookUrl, { method: 'POST', body: form });
    } else {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
    }
  } catch (err) {
    console.error('Error enviando a Discord:', err);
  }
}

export async function handleIncomingMessage({ message, from, phoneNumberId }) {
  let userText = '';

  // --- Procesar texto o audio ---
  if (message.type === 'text') {
    userText = message.text.body;
    console.log(`Texto recibido: "${userText}"`);
    await forwardToDiscord(from, 'text', userText);

  } else if (message.type === 'audio') {
    console.log('Audio recibido, transcribiendo...');
    await sendWhatsAppMessage(phoneNumberId, from, '🎙️ Escuché tu mensaje, un segundo que lo proceso...');

    try {
      const audioBuffer = await downloadAudioFile(message.audio.id);
      userText = await transcribeAudio(audioBuffer);
      console.log(`Audio transcripto: "${userText}"`);
      await forwardToDiscord(from, 'audio', userText, audioBuffer);
    } catch (err) {
      console.error('Error transcribiendo audio:', err);
      await notifyDiscordError('Transcripción de audio (Groq)', from, err);
      await sendWhatsAppMessage(phoneNumberId, from, '❌ No pude procesar el audio. ¿Podés escribirme el problema?');
      return;
    }

  } else {
    // Tipo de mensaje no soportado
    await sendWhatsAppMessage(
      phoneNumberId, from,
      '👋 ¡Hola! Contame que evento o comercio queres buscar'
    );
    return;
  }

  // --- Clasificar el problema con IA ---
  let classification;
  try {
    classification = await classifyMessage(userText);
    console.log('Clasificación:', classification);
  } catch (err) {
    console.error('Error clasificando:', err);
    await notifyDiscordError('Clasificación de mensaje (Groq)', from, err);
    await sendWhatsAppMessage(phoneNumberId, from, '⚠️ Hubo un error procesando tu consulta. Intenta de nuevo.');
    return;
  }

  if (!classification.category) {
    await sendWhatsAppMessage(
      phoneNumberId, from,
      '🤔 No entendí bien qué tipo de categoría buscas. ¿Podés darme más detalles? Por ejemplo: "que restaurnates hay abiertos" o "necesito que me digas heladerías".'
    );
    return;
  }

  // --- Buscar shows en Pampacode ---
  let shows;
  try {
    shows = await getActualShows();
    console.log(`Encontrados: ${shows.length} shows`);
  } catch (err) {
    console.error('Error obteniendo shows:', err);
    await notifyDiscordError('Obtención de shows (Pampacode)', from, err);
    await sendWhatsAppMessage(phoneNumberId, from, '⚠️ Hubo un error buscando eventos. Intenta de nuevo más tarde.');
    return;
  }

  // --- Filtrar shows según la clasificación ---
  const filteredShows = shows.filter(show =>
    show.categories.some(category => category.toLowerCase().includes(classification.category.toLowerCase()))
  );

  // --- Armar respuesta ---
  const response = buildResponse(userText, classification, filteredShows);
  console.log('--- MENSAJE A ENVIAR ---\n' + response + '\n---');
  try {
    await sendWhatsAppMessage(phoneNumberId, from, response);
  } catch (err) {
    console.error('Error enviando respuesta por WhatsApp:', err);
    await notifyDiscordError('Envío de respuesta por WhatsApp', from, err);
  }
}

function buildResponse(originalText, classification, shows) {
  if (shows.length === 0) {
    return `🔍 Busqué *${classification.category}* pero no encontré eventos relacionados.\n\n📲 Podés ver todos los eventos disponibles en: https://api.pampacode.com/shows/actualShows`;
  }

  const toShow = shows.slice(0, 5);

  let msg = `✅ Entendí que buscás eventos relacionados con: *${classification.category}*\n\n`;
  msg += `🎭 Encontré ${toShow.length} evento${toShow.length > 1 ? 's' : ''} para vos:\n\n`;

  toShow.forEach((show, i) => {
    msg += `${i + 1}. *${show.title}*\n`;
    if (show.venue) msg += `   📍 Lugar: ${show.venue},${show.address}\n`;
    if (show.event_date) msg += `   📅 Fecha: ${new Date(show.event_date).toLocaleDateString('es-ES')}\n`;
    if (show.category) msg += `   📍 Lugar: ${show.category}\n`;
    if (show.url) msg += `   🔗 Reservar: ${show.url}\n`;
    msg += `   🖼️ Flyer: ${show.image_url}\n\n`;
  });

  return msg;
}