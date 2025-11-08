import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@xenova/transformers';

const client = new QdrantClient({ url: 'http://localhost:6333' });

await client.createCollection('preguntas_respuestas', {
  vectors: {
    size: 384,
    distance: 'Cosine'
  }
});

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

const pregunta = "¿Cómo cambio una llave de agua que gotea?";
const respuesta = "Para cambiar una llave que gotea, primero cortá el agua, luego reemplazá el vástago o el sello.";

const emb = await extractor(pregunta, { pooling: 'mean', normalize: true });

await client.upsert('preguntas_respuestas', {
  points: [
    {
      id: 1,
      vector: Array.from(emb.data),
      payload: { pregunta, respuesta }
    }
  ]
});

console.log('✅ Embedding insertado en Qdrant correctamente');
