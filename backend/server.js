import express from 'express';
import cors from 'cors';
import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@xenova/transformers';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ---------------- QDRANT -----------------
const client = new QdrantClient({ url: 'http://localhost:6333' });
const COLLECTION = 'preguntas_respuestas';

const initCollection = async () => {
  const collections = await client.getCollections();
  if (!collections.collections.find(c => c.name === COLLECTION)) {
    await client.createCollection(COLLECTION, { vectors: { size: 384, distance: 'Cosine' } });
  }
};
await initCollection();

// ---------------- EMBEDDINGS -----------------
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

// ---------------- ENDPOINTS -----------------

// Agregar pregunta/respuesta y generar embedding
app.post('/add', async (req, res) => {
  const { pregunta, respuesta, id } = req.body;
  if (!pregunta || !respuesta || !id) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const emb = await extractor(pregunta, { pooling: 'mean', normalize: true });
    await client.upsert(COLLECTION, {
      points: [{ id, vector: Array.from(emb.data), payload: { pregunta, respuesta } }]
    });
    res.json({ ok: true, message: 'Pregunta y embedding guardados' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Chatbot con búsqueda semántica
app.post('/chatbot', async (req, res) => {
  const { pregunta } = req.body;
  if (!pregunta) return res.status(400).json({ error: 'Falta la pregunta' });

  try {
    const embPregunta = await extractor(pregunta, { pooling: 'mean', normalize: true });

    const result = await client.search(COLLECTION, {
      vector: Array.from(embPregunta.data),
      limit: 3,
      with_payload: true
    });

    if (result.length && result[0].score >= 0.7) {
      return res.json({ respuestas: result.map(r => ({ respuesta: r.payload.respuesta, similitud: r.score })) });
    }

    res.json({ respuestas: [{ respuesta: 'Lo siento, no encontré una respuesta para tu consulta.', similitud: 0 }] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- START SERVER -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en http://localhost:${PORT}`));
