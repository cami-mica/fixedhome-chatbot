const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(express.json());
app.use(cors());

const limpiarTexto = (text) => {
  return text
    .replace(/[¿?¡!.,]/g, '') 
    .toLowerCase()
    .trim();
};

app.get('/faq', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT pregunta, respuesta FROM PreguntasRespuestas');
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener FAQs:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/chatbot', async (req, res) => {
  const { pregunta } = req.body;

  if (!pregunta) return res.status(400).send({ error: 'Falta la pregunta' });

  try {
    const preguntaLimpia = limpiarTexto(pregunta);

    const [rows] = await pool.query(
      `SELECT respuesta 
       FROM PreguntasRespuestas 
       WHERE LOWER(pregunta) LIKE ? 
       LIMIT 1`,
      [`%${preguntaLimpia}%`]
    );

    if (rows.length > 0) {
      res.json({ respuesta: rows[0].respuesta });
    } else {
      res.json({ respuesta: 'Lo siento, no encontré una respuesta para tu consulta.' });
    }
  } catch (error) {
    console.error('❌ Error en chatbot:', error);
    res.status(500).send('Error en el servidor del chatbot');
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

