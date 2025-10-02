require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const pool = require('./db'); // tu archivo db.js con mysql2/promise

const app = express();
app.use(express.json());
app.use(cors());

// ---------------- CONFIG ----------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log('GEMINI_API_KEY:', GEMINI_API_KEY);
const EMBEDDING_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embed';

if (!GEMINI_API_KEY) {
  console.error('❌ Falta GEMINI_API_KEY en el archivo .env');
  process.exit(1);
}

// ---------------- UTILS ----------------
const limpiarTexto = (t) =>
  (t || '')
    .normalize('NFD') // quita acentos
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,]/g, '')
    .toLowerCase()
    .trim();

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  return Math.sqrt(a.reduce((acc, v) => acc + v * v, 0));
}

function cosineSim(a, b) {
  return dot(a, b) / (norm(a) * norm(b) + 1e-10);
}

// Función para obtener embedding con retry
async function obtenerEmbedding(text, retries = 2) {
  const payload = { input: text };
  const url = `${EMBEDDING_API_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000
      });

      // La respuesta de gemini-embedding-001 devuelve embedding en resp.data.embedding
      const emb = resp.data?.embedding;
      if (!emb) {
        throw new Error('Respuesta inesperada de Gemini: ' + JSON.stringify(resp.data).slice(0, 200));
      }

      return emb;
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`⚠️ Retry ${i + 1} para obtener embedding...`);
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

// ---------------- ENDPOINTS ----------------

// Vectorizar una fila por ID
app.post('/vectorize/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT pregunta FROM PreguntasRespuestas WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Pregunta no encontrada' });

    const pregunta = limpiarTexto(rows[0].pregunta);
    const emb = await obtenerEmbedding(pregunta);

    await pool.query(
      'UPDATE PreguntasRespuestas SET embedding = ?, embedding_model = ?, embedding_updated_at = NOW() WHERE id = ?',
      [JSON.stringify(emb), 'gemini-embedding-001', id]
    );

    res.json({ ok: true, id, embedding_length: emb.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Vectorizar todas las filas
app.post('/vectorize-all', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, pregunta FROM PreguntasRespuestas');
    let success = 0, failed = 0;
    const failedIds = [];

    for (const r of rows) {
      try {
        const emb = await obtenerEmbedding(limpiarTexto(r.pregunta));
        await pool.query(
          'UPDATE PreguntasRespuestas SET embedding = ?, embedding_model = ?, embedding_updated_at = NOW() WHERE id = ?',
          [JSON.stringify(emb), 'gemini-embedding-001', r.id]
        );
        success++;
      } catch (err) {
        console.error(`❌ Error vectorizando ID ${r.id}:`, err.message);
        failed++;
        failedIds.push(r.id);
      }
    }
    res.json({ ok: true, total: rows.length, success, failed, failedIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chatbot con similitud semántica (top 3)
app.post('/chatbot', async (req, res) => {
  const { pregunta } = req.body;
  if (!pregunta) return res.status(400).json({ error: 'Falta la pregunta' });

  try {
    const embPregunta = await obtenerEmbedding(limpiarTexto(pregunta));
    const [rows] = await pool.query(
      'SELECT id, pregunta, respuesta, embedding FROM PreguntasRespuestas WHERE embedding IS NOT NULL'
    );

    const candidatos = rows.map(r => {
      try {
        const stored = JSON.parse(r.embedding);
        return {
          id: r.id,
          respuesta: r.respuesta,
          sim: cosineSim(embPregunta, stored)
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    candidatos.sort((a, b) => b.sim - a.sim);

    if (candidatos.length > 0 && candidatos[0].sim >= 0.70) {
      return res.json({
        respuestas: candidatos.slice(0, 3).map(c => ({
          respuesta: c.respuesta,
          similitud: c.sim
        }))
      });
    }

    res.json({ respuestas: [{ respuesta: 'Lo siento, no encontré una respuesta para tu consulta.', similitud: 0 }] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en http://localhost:${PORT}`));

