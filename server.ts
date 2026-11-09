import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

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
  const defaultSupabaseUrl = "https://ckzygdwhihybrdzctdup.supabase.co";
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || defaultSupabaseUrl).replace(/\/$/, "");
  const allowedHost = new URL(supabaseUrl).host;
  
  try {
    const parsedTarget = new URL(targetUrl);
    if (parsedTarget.host !== allowedHost) {
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

// Endpoint to send 2FA verification email to Gmail / external address
app.post("/api/send-2fa-email", async (req: any, res: any) => {
  const { email, code, userName } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: "E-mail e código 2FA são obrigatórios" });
  }

  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || "oportunizahw@gmail.com";
  const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || "vuwlotawwkbrwdhj").replace(/\s+/g, '');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #06b6d4; font-size: 24px; font-weight: bold; margin: 0;">Oportuniza Araucária</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Portal de Emprego e Qualificação</p>
      </div>
      <div style="background-color: #1e293b; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px; border: 1px solid #334155;">
        <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">Código de Verificação de 2 Etapas (2FA)</h2>
        <p style="color: #cbd5e1; font-size: 14px;">Olá, <strong>${userName || 'Administrador'}</strong>. Digite o código abaixo no portal para liberar seu acesso ao Painel de Administração:</p>
        <div style="background-color: #0284c7; color: #ffffff; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 24px; border-radius: 8px; display: inline-block; margin: 16px 0; font-family: monospace;">
          ${code}
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Este código é válido por 10 minutos. Se você não solicitou o acesso, desconsidere este e-mail.</p>
      </div>
      <div style="text-align: center; color: #64748b; font-size: 12px;">
        &copy; ${new Date().getFullYear()} Prefeitura Municipal de Araucária / Oportuniza
      </div>
    </div>
  `;

  try {
    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"Oportuniza Araucária - Segurança" <${smtpUser}>`,
        to: email,
        subject: `[Oportuniza] Código de Verificação 2FA: ${code}`,
        html: htmlContent,
      });

      console.log(`2FA email dispatched via SMTP (${smtpUser}) to ${email}`);
      return res.json({ success: true, delivered: true, message: `E-mail de 2FA enviado com sucesso via ${smtpUser} para ${email}` });
    } else {
      console.log(`2FA Code generated for ${email}: ${code} (SMTP not set in env)`);
      return res.json({
        success: true,
        delivered: false,
        simulated: true,
        message: `Código 2FA (${code}) gerado para ${email}.`,
      });
    }
  } catch (err: any) {
    console.error("Error sending 2FA email:", err);
    return res.status(500).json({
      error: "Falha ao enviar e-mail",
      details: err.message,
      simulatedCode: code
    });
  }
});

// Endpoint to send registration verification email
app.post("/api/send-registration-email", async (req: any, res: any) => {
  const { email, code, userName } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: "E-mail e código de ativação são obrigatórios" });
  }

  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || "oportunizahw@gmail.com";
  const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || "vuwlotawwkbrwdhj").replace(/\s+/g, '');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #06b6d4; font-size: 24px; font-weight: bold; margin: 0;">Oportuniza Araucária</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Ativação de Nova Conta</p>
      </div>
      <div style="background-color: #1e293b; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px; border: 1px solid #334155;">
        <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">Seu Código de Ativação</h2>
        <p style="color: #cbd5e1; font-size: 14px;">Bem-vindo(a), <strong>${userName || 'Novo Usuário'}</strong>! Para concluir seu cadastro e liberar seu acesso, digite o código abaixo no aplicativo:</p>
        <div style="background-color: #0891b2; color: #ffffff; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 24px; border-radius: 8px; display: inline-block; margin: 16px 0; font-family: monospace;">
          ${code}
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Se você não iniciou este cadastro, pode ignorar este e-mail.</p>
      </div>
      <div style="text-align: center; color: #64748b; font-size: 12px;">
        &copy; ${new Date().getFullYear()} Prefeitura Municipal de Araucária / Oportuniza
      </div>
    </div>
  `;

  try {
    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"Oportuniza Araucária - Boas-vindas" <${smtpUser}>`,
        to: email,
        subject: `[Oportuniza] Seu Código de Ativação: ${code}`,
        html: htmlContent,
      });

      console.log(`Registration email sent to ${email}`);
      return res.json({ success: true, delivered: true });
    } else {
      return res.json({ success: true, delivered: false, code });
    }
  } catch (err: any) {
    console.error("Error sending registration email:", err);
    return res.status(500).json({ error: "Falha ao enviar e-mail", details: err.message });
  }
});

// Endpoint to send password recovery email from oportunizahw@gmail.com
app.post("/api/send-password-recovery-email", async (req: any, res: any) => {
  const { email, code } = req.body;

  if (!email) {
    return res.status(400).json({ error: "O e-mail é obrigatório para recuperar a senha." });
  }

  const recoveryCode = code || Math.floor(100000 + Math.random() * 900000).toString();
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || "oportunizahw@gmail.com";
  const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || "vuwlotawwkbrwdhj").replace(/\s+/g, '');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #06b6d4; font-size: 24px; font-weight: bold; margin: 0;">Oportuniza Araucária</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Recuperação de Acesso e Redefinição de Senha</p>
      </div>
      <div style="background-color: #1e293b; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px; border: 1px solid #334155;">
        <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">Código de Recuperação de Senha</h2>
        <p style="color: #cbd5e1; font-size: 14px;">Você solicitou a redefinição de senha para a conta <strong>${email}</strong>. Utilize o código de verificação abaixo:</p>
        <div style="background-color: #0284c7; color: #ffffff; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 24px; border-radius: 8px; display: inline-block; margin: 16px 0; font-family: monospace;">
          ${recoveryCode}
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Se você não fez essa solicitação, basta ignorar este e-mail. Sua senha permanecerá inalterada.</p>
      </div>
      <div style="text-align: center; color: #64748b; font-size: 12px;">
        &copy; ${new Date().getFullYear()} Prefeitura Municipal de Araucária / Oportuniza
      </div>
    </div>
  `;

  try {
    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"Oportuniza Araucária - Suporte" <${smtpUser}>`,
        to: email,
        subject: `[Oportuniza] Código para Redefinição de Senha: ${recoveryCode}`,
        html: htmlContent,
      });

      console.log(`Password recovery email dispatched via ${smtpUser} to ${email}`);
      return res.json({ success: true, delivered: true, code: recoveryCode, message: `E-mail de recuperação enviado com sucesso via ${smtpUser} para ${email}!` });
    } else {
      return res.json({
        success: true,
        delivered: false,
        simulated: true,
        code: recoveryCode,
        message: `Código de recuperação (${recoveryCode}) gerado para ${email}.`,
      });
    }
  } catch (err: any) {
    console.error("Error sending password recovery email:", err);
    return res.status(500).json({
      error: "Falha ao enviar e-mail de recuperação",
      details: err.message,
      code: recoveryCode
    });
  }
});

// Endpoint to update user password directly in the database
app.post("/api/update-password", async (req: any, res: any) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: "E-mail e nova senha são obrigatórios." });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const defaultSupabaseUrl = "https://sqqiqmzrhmgrtkborskf.supabase.co";
    const rawUrl = process.env.VITE_SUPABASE_URL || defaultSupabaseUrl;
    
    // Sanitize URL exactly like the client
    const supabaseUrl = rawUrl
      .trim()
      .replace(/\/rest\/v1\/?$/i, '')
      .replace(/\/+$/, '')
      .trim();

    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_QHYzyrfocbKo60XS5EFYBA_Js8u-l0O";
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Update the password in the public.users table
    const { data: updatedData, error: updateError } = await supabase
      .from('users')
      .update({ 
        password: newPassword,
        updated_at: new Date().toISOString()
      })
      .eq('email', cleanEmail)
      .select();

    if (updateError) {
      console.error(`Database update error for ${cleanEmail}:`, updateError);
      return res.status(500).json({ error: "Falha ao atualizar no banco", details: updateError.message });
    }

    console.log(`Password update result for ${cleanEmail}:`, updatedData);

    // 2. If no rows were updated, check if user exists by email and update or insert manually
    if (!updatedData || updatedData.length === 0) {
      console.warn(`No user found with id matching email ${cleanEmail}. Checking email for manual update.`);
      
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (findError) {
        console.error(`Error finding user by email ${cleanEmail}:`, findError);
        return res.status(500).json({ 
          error: "Erro ao buscar usuário no banco", 
          details: findError.message,
          code: findError.code 
        });
      }

      if (existingUser) {
        // Update existing user found by email
        const { error: updateByEmailError } = await supabase
          .from('users')
          .update({ 
            password: newPassword,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id);

        if (updateByEmailError) {
          console.error(`Manual update failed for ${cleanEmail} (ID: ${existingUser.id}):`, updateByEmailError);
          return res.status(500).json({ 
            error: "Falha ao atualizar senha do perfil existente", 
            details: updateByEmailError.message,
            code: updateByEmailError.code 
          });
        }
      } else {
        // Insert new shadow user with a manual UUID to avoid "missing default" errors
        const shadowId = crypto.randomUUID();
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: shadowId,
            name: cleanEmail.split('@')[0],
            email: cleanEmail,
            password: newPassword,
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error(`Manual insert failed for ${cleanEmail}:`, insertError);
          // If it's a uniqueness violation (code 23505), it means the user was found but Select missed it somehow
          const isDuplicate = insertError.code === '23505' || String(insertError.message).includes('already exists');
          
          return res.status(500).json({ 
            error: isDuplicate ? "Este e-mail já possui um vínculo parcial. Tente fazer login normalmente ou entre em contato." : "Falha ao criar perfil de recuperação", 
            details: insertError.message,
            code: insertError.code,
            hint: insertError.code === '23503' ? "O banco de dados ainda possui um vínculo obrigatório com o sistema de login principal. Execute o comando no SQL Editor: ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;" : undefined
          });
        }
      }
    }

    return res.json({ success: true, message: "Senha sincronizada com sucesso." });
  } catch (err: any) {
    console.error("Critical error in /api/update-password:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao processar troca de senha." });
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
