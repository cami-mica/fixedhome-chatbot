import mysql from 'mysql2/promise';
import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@xenova/transformers';
import dotenv from 'dotenv';
dotenv.config();

// ---------------- CONFIG ----------------
const client = new QdrantClient({ url: "http://host.docker.internal:6333" });
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

// ---------------- EMBEDDINGS ----------------
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

// ---------------- MIGRATION ----------------
const initCollection = async () => {
  const collections = await client.getCollections();
  if (!collections.collections.find(c => c.name === COLLECTION)) {
    await client.createCollection(COLLECTION, { vectors: { size: 384, distance: 'Cosine' } });
    console.log(`✅ Colección ${COLLECTION} creada en Qdrant`);
  } else {
    console.log(`ℹ️ Colección ${COLLECTION} ya existe`);
  }
};

await initCollection();

const migrate = async () => {
  const [rows] = await pool.query('SELECT id, pregunta, respuesta FROM PreguntasRespuestas');
  console.log(`ℹ️ Migrando ${rows.length} filas...`);

  for (const r of rows) {
    try {
      const emb = await extractor(r.pregunta, { pooling: 'mean', normalize: true });

      await client.upsert(COLLECTION, {
        points: [{
          id: r.id,
          vector: Array.from(emb.data),
          payload: { pregunta: r.pregunta, respuesta: r.respuesta }
        }]
      });
      console.log(`✅ Migrado ID ${r.id}`);
    } catch (err) {
      console.error(`❌ Error migrando ID ${r.id}:`, err.message);
    }
  }

  console.log('🎉 Migración completada');
  process.exit(0);
};

migrate();
