import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@xenova/transformers';

// 🔹 Conectamos al Qdrant local
const client = new QdrantClient({ url: 'http://localhost:6333' });

// 🔹 Creamos (si no existe) una colección para tus embeddings
await client.createCollection('preguntas_respuestas', {
  vectors: {
    size: 384, // mismo tamaño que el modelo de embeddings
    distance: 'Cosine'
  }
});

// 🔹 Cargamos el modelo local de embeddings
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

// Ejemplo de pregunta y respuesta
const pregunta = "¿Cómo cambio una llave de agua que gotea?";
const respuesta = "Para cambiar una llave que gotea, primero cortá el agua, luego reemplazá el vástago o el sello.";

// Generamos embedding de la pregunta
const emb = await extractor(pregunta, { pooling: 'mean', normalize: true });

// 🔹 Insertamos el embedding en Qdrant
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
