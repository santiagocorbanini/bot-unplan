import Groq from 'groq-sdk';
import { toFile } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Categorías que matchean con tu base de datos
const CATEGORIES_CONTEXT = `
Categorías disponibles en la plataforma:
- electricista / electricidad
- plomero / plomería / termotanque / cañería / agua
- pintor / pintura
- albañil / construcción / remodelación
- carpintero / carpintería / muebles
- cerrajero / cerradura / puerta
- gasista / gas / calefacción
- aire acondicionado / refrigeración / técnico
- limpieza / doméstico
- jardinero / jardinería
- mudanzas / flete
- informática / computación / técnico pc
- profesor / clases particulares / tutor
- contador / contabilidad
- abogado / legal
- psicólogo / psicología
- médico / salud
- diseño / gráfico / web
- fotografía / fotógrafo
- mecánico / auto / vehiculo
`;

export async function classifyMessage(text) {
  const prompt = `Sos un asistente de "Experto Cerca", una plataforma argentina que conecta personas con profesionales locales.

${CATEGORIES_CONTEXT}

El usuario dijo: "${text}"

Respondé SOLO con un JSON (sin markdown, sin explicaciones) con este formato exacto:
{
  "category": "categoría principal del servicio (en minúsculas, una o dos palabras)",
  "serviceDescription": "descripción breve del problema en español (máx 10 palabras)",
  "isEmergency": true solo si el usuario usó palabras como urgente/emergencia/ahora/ya/inundación/peligro/urgente, sino false,
  "keywords": ["keyword1", "keyword2"]
}

Si no es una solicitud de servicio, ponés "category": null.`;

  const response = await groq.chat.completions.create({
    //model: 'llama-3.1-8b-instant', // gratuito en Groq
    model: 'openai/gpt-oss-20b',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 200,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content.trim();

  try {
    return JSON.parse(content);
  } catch {
    // Si falla el parseo, intentar extraer JSON
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('No se pudo parsear la clasificación: ' + content);
  }
}

export async function transcribeAudio(audioBuffer) {
  const transcription = await groq.audio.transcriptions.create({
    file: await toFile(audioBuffer, 'audio.opus', { type: 'audio/opus' }),
    model: 'whisper-large-v3-turbo',
    language: 'es',
    response_format: 'json',
  });
  return transcription.text;
}
