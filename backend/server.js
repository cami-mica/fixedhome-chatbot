import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@xenova/transformers';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// ---------------- CONFIG ----------------
const qdrant = new QdrantClient({ url: "http://localhost:6333" });
const COLLECTION = 'preguntas_respuestas';

// Conexión MariaDB
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Modelo de embeddings
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

// ---------------- ENDPOINT PRINCIPAL DEL CHATBOT ----------------
app.post('/chat', async (req, res) => {
  try {
    const { pregunta } = req.body;
    if (!pregunta) return res.status(400).json({ error: 'Falta la pregunta del usuario' });

    const emb = await extractor(pregunta, { pooling: 'mean', normalize: true });
    const vector = Array.from(emb.data);

    const results = await qdrant.search(COLLECTION, {
      vector,
      limit: 3
    });

    if (!results.length) {
      return res.json({ respuesta: 'No encontré una respuesta para tu pregunta.' });
    }

    const bestMatchId = results[0].id;

    const [rows] = await pool.query('SELECT respuesta FROM PreguntasRespuestas WHERE id = ?', [bestMatchId]);

    if (!rows.length) {
      return res.json({ respuesta: 'No encontré una respuesta para tu pregunta.' });
    }

    res.json({ respuesta: rows[0].respuesta });

  } catch (err) {
    console.error('❌ Error en /chat:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ---------------- ARRANQUE DEL SERVIDOR ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));

