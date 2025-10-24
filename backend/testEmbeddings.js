import { pipeline } from '@xenova/transformers';

// Cargamos el modelo gratuito all-MiniLM-L6-v2 (muy rápido y bueno)
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

const text = "Hola, este es un ejemplo de texto para convertir en embedding.";

// Obtenemos el embedding
const output = await extractor(text, { pooling: 'mean', normalize: true });

console.log('Embedding generado (primeros 5 valores):', output.data.slice(0, 5));
console.log('Dimensión total:', output.data.length);
