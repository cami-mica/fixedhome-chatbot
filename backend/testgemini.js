require('dotenv').config();
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'embedding-001';
const EMBEDDING_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:embedContent`;

async function testEmbedding() {
  const text = "Hola, esto es una prueba de embedding con Gemini";

  try {
    const resp = await axios.post(
      `${EMBEDDING_API_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      { content: { parts: [{ text }] } },
      { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
    );

    const embedding = resp.data?.embedding?.value || resp.data?.embedding?.values;

    if (embedding) {
      console.log('✅ Embedding obtenido correctamente!');
      console.log('Longitud del embedding:', embedding.length);
      console.log('Primeros 10 valores:', embedding.slice(0, 10));
    } else {
      console.error('❌ No se recibió embedding:', resp.data);
    }
  } catch (err) {
    console.error('❌ Error al llamar a Gemini:', err.response?.data || err.message);
  }
}

testEmbedding();


