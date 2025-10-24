import { QdrantClient } from "@qdrant/js-client-rest";

const client = new QdrantClient({
  url: "http://localhost:6333", // tu Qdrant corriendo en Docker
  // checkCompatibility: false // opcional si da errores de versión
});

async function testConnection() {
  try {
    const collections = await client.getCollections();
    console.log("✅ Conectado a Qdrant. Colecciones actuales:", collections);
  } catch (err) {
    console.error("❌ Error de conexión:", err);
  }
}

testConnection();




