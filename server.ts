import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper to call generateContent with retry capability for transient errors (like 503 or 429)
async function generateContentWithRetry(
  aiInstance: GoogleGenAI,
  params: any,
  retries = 3,
  delayMs = 1000
): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await aiInstance.models.generateContent(params);
    } catch (error: any) {
      console.error(`Gemini Attempt ${attempt} failed:`, error);
      const errStr = String(error?.message || error).toLowerCase();
      const code = error?.status || error?.code;
      const isTransient = 
        code === 503 || 
        code === 429 || 
        errStr.includes("503") || 
        errStr.includes("429") || 
        errStr.includes("unavailable") || 
        errStr.includes("high demand") || 
        errStr.includes("temporary");

      if (isTransient && attempt < retries) {
        const backoffDelay = delayMs * Math.pow(2, attempt - 1);
        console.warn(`Transient/High demand error. Retrying in ${backoffDelay}ms... (Attempt ${attempt} of ${retries})`);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        continue;
      }
      throw error;
    }
  }
}

// Supabase Proxy to prevent CORS/Failed to fetch errors in browser iframe
app.all("/api/supabase-proxy", async (req: any, res: any) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: "Missing Target URL" });
  }

  // Permite apenas requisições ao projeto Supabase do usuário
  const allowedProjectUrl = process.env.VITE_SUPABASE_URL || "https://sqqiqmzrhmgrtkborskf.supabase.co";
  const allowedHost = new URL(allowedProjectUrl).host;
  
  try {
    const parsedTarget = new URL(targetUrl);
    if (parsedTarget.host !== allowedHost && parsedTarget.host !== "sqqiqmzrhmgrtkborskf.supabase.co") {
      return res.status(403).json({ error: "Forbidden Target Domain" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid Target URL format" });
  }

  try {
    const targetUri = new URL(targetUrl);
    const headers: Record<string, string> = {
      'host': targetUri.host
    };
    
    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      // Forward standard Supabase and Auth headers
      const allowedHeaders = ['authorization', 'apikey', 'content-type', 'prefer', 'range', 'x-client-info', 'if-match', 'if-none-match'];
      if (allowedHeaders.includes(lowerKey) && value) {
        headers[lowerKey] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    }

    const hasBody = !['GET', 'HEAD'].includes(req.method);
    let bodyContent = undefined;
    
    if (hasBody) {
      if (req.body && Object.keys(req.body).length > 0) {
        bodyContent = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }
    }

    // Add a timeout to the fetch to prevent hangs
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: bodyContent,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    res.status(response.status);
    
    // Forward standard headers
    const headersToForward = ['content-type', 'cache-control', 'preference-applied', 'content-range', 'location'];
    for (const h of headersToForward) {
      const val = response.headers.get(h);
      if (val) {
        res.setHeader(h, val);
      }
    }

    return res.send(responseText);
  } catch (err: any) {
    console.error("Supabase Proxy Error:", err);
    return res.status(500).json({ error: err.message || "Proxy failed" });
  }
});

// API endpoint for smart career chat mentor
app.post("/api/mentor", async (req: any, res: any) => {
  const { messages } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid messages format" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({
      text: "Olá! Para que eu possa te ajudar a estruturar sua carreira agora, é preciso adicionar a sua GEMINI_API_KEY no painel de configurações (Settings > Secrets). Após adicionar, é só me enviar uma mensagem novamente!"
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const systemInstruction = 
      "Você é o Mentor de Carreira Inteligente do Oportuniza | App. " +
      "Seu objetivo é guiar jovens e profissionais a encontrarem emprego, estruturarem currículos, escolherem cursos e se saírem bem em entrevistas de emprego. " +
      "Como você está rodando no Oportuniza, mencione que o aplicativo oferece seções de 'Vagas', 'Cursos' e 'Perfil' que automatizam e ajudam nesses objetivos. " +
      "Mantenha as respostas sempre amigáveis, pragmáticas, objetivas e diretas ao ponto. " +
      "Organize as respostas com tópicos curtos, ideais para leitura rápida em telas de celulares. " +
      "Evite introduções longas. Vá direto à solução ou resposta da dúvida. Use emojis moderadamente.";

    const chatContents = messages.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: chatContents,
      config: {
        systemInstruction,
        temperature: 0.5,
      },
    });

    const reply = response.text || "Desculpe, não consegui processar sua resposta agora. Qual é a sua principal dúvida de carreira?";
    return res.json({ text: reply });

  } catch (error: any) {
    console.error("Gemini API Error after retries:", error);
    return res.status(500).json({ 
      error: "Error generating response",
      text: "Olá! Tive uma pequena interrupção técnica ao acessar meu cérebro de inteligência artificial, mas estou aqui offline para te ajudar a estruturar sua carreira. De qual área você gostaria de saber mais?"
    });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
