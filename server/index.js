import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error('APIキーが見つかりませんでした');
}       
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3005;

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, '../client/dist')));

// CORS設定を追加
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

const server = app.listen(PORT, () => {
  console.log(`Server app listening at http://localhost:${PORT}`);
});
process.on('SIGINT', () => server.close(() => process.exit(0)));

app.get('/', (req, res) => {
  res.send('Server is running.');
});
app.post('/api/chat', async (req, res) => {
  try {
    const { systemPrompt, userPrompt, temperature, stream = false } = req.body;

    if (!genAI) {
      return res.status(500).json({
        success: false,
        message:
          'APIキーが設定されていません',
      });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: temperature || 1,
      },
    });

    let fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    fullPrompt +=
      '\n\n注意!!!：必ず回答はHTMLやマークダウン記法を使わず、プレーンテキストで返してください。';

    const abortController = new AbortController();
    res.on('close', () => {
      abortController.abort();
    });

    if (stream) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      const result = await model.generateContentStream(fullPrompt);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        res.write(text);
      }
      res.end();
    } else {
      const result = await model.generateContent(fullPrompt);
      const responseText = result.response.text();
      res.json({ result: responseText });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
});

// フォールバック設定
//app.get(/^(?!\/api\/).*$/, (req, res) => {
//  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
//});
