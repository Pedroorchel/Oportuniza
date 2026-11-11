import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.disable("x-powered-by");
const PORT = Number(process.env.PORT || 3000);

// Global security headers (keeps iframe compatibility for AI Studio preview)
app.use((_req: any, res: any, next: any) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), payment=(), usb=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// CORS support for /api/* routes (allows external static frontend via VITE_API_BASE_URL)
app.use("/api", (req: any, res: any, next: any) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

function getClientIp(req: any): string {
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

interface RateBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: any) => string;
}) {
  const buckets = new Map<string, RateBucket>();

  return (req: any, res: any, next: any) => {
    const now = Date.now();
    if (buckets.size > 5000) {
      for (const [k, v] of buckets.entries()) {
        if (now > v.resetAt) buckets.delete(k);
      }
    }

    const key = options.keyGenerator ? options.keyGenerator(req) : getClientIp(req);
    const current = buckets.get(key);
    if (!current || now > current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (current.count >= options.max) {
      const retrySec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      return res.status(429).json({
        error: `${options.message} Aguarde ${retrySec}s e tente novamente.`,
        retryAfterSeconds: retrySec
      });
    }

    current.count += 1;
    return next();
  };
}

const mailRateLimitByIp = createRateLimiter({
  windowMs: 2 * 60 * 1000,
  max: 8,
  message: "Muitos envios de e-mail em sequência."
});

const mailRateLimitByEmail = createRateLimiter({
  windowMs: 2 * 60 * 1000,
  max: 5,
  message: "Muitos códigos solicitados para este e-mail.",
  keyGenerator: (req: any) => {
    const mail = String(req.body?.email || '').trim().toLowerCase();
    return `${getClientIp(req)}:${mail || 'none'}`;
  }
});

const verifyRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: "Muitas tentativas de verificação."
});

const adminAuthRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 6,
  message: "Muitas tentativas inválidas de acesso administrativo."
});

const passwordUpdateRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 6,
  message: "Muitas tentativas de alteração de senha."
});

const mentorRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: "Limite temporário do Mentor de Carreira atingido."
});

const proxyRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 160,
  message: "Limite de requisições ao proxy atingido."
});

// Server-side CSPRNG OTP & Recovery Verification Stores
interface SecurityChallenge {
  id: string;
  email: string;
  kind: 'login-2fa' | 'admin-2fa' | 'registration' | 'recovery';
  salt: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

interface VerifiedResetToken {
  email: string;
  expiresAt: number;
}

const securityChallenges = new Map<string, SecurityChallenge>();
const verifiedResetTokens = new Map<string, VerifiedResetToken>();
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;

function sweepSecurityStores(): void {
  const now = Date.now();
  for (const [id, ch] of securityChallenges.entries()) {
    if (now > ch.expiresAt) securityChallenges.delete(id);
  }
  for (const [hash, rt] of verifiedResetTokens.entries()) {
    if (now > rt.expiresAt) verifiedResetTokens.delete(hash);
  }
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function createServerSecurityChallenge(
  email: string,
  kind: SecurityChallenge['kind']
): { challengeId: string; code: string } {
  sweepSecurityStores();
  const cleanEmail = email.trim().toLowerCase();
  const code = String(crypto.randomInt(10000000, 100000000));
  const challengeId = crypto.randomBytes(18).toString("hex");
  const salt = crypto.randomBytes(16).toString("hex");
  const codeHash = sha256Hex(`${salt}:${code}`);

  securityChallenges.set(challengeId, {
    id: challengeId,
    email: cleanEmail,
    kind,
    salt,
    codeHash,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
    attempts: 0
  });

  return { challengeId, code };
}

function isValidServerEmail(email: string): boolean {
  if (!email || email.length > 254 || /[\r\n\0]/.test(email)) return false;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email);
}

function sanitizeHeaderText(val: string): string {
  return String(val || "").replace(/[\r\n\0]+/g, " ").trim().slice(0, 140);
}

function validateServerPasswordStrength(password: string, email: string): { valid: boolean; error?: string } {
  const pwd = String(password || "");
  if (pwd.length < 8) {
    return { valid: false, error: "Por segurança, a nova senha deve ter pelo menos 8 caracteres." };
  }
  if (!/[a-zA-ZÀ-ÿ]/.test(pwd) || !/[0-9]/.test(pwd)) {
    return { valid: false, error: "A nova senha deve combinar letras e números." };
  }
  const lower = pwd.toLowerCase();
  const prefix = email.trim().toLowerCase().split("@")[0];
  const weakSet = new Set([
    "12345678", "123456789", "87654321", "00000000", "11111111",
    "qwertyui", "qwertyuiop", "password", "senha123", "oportuniza123", "admin123"
  ]);
  if (weakSet.has(lower) || /(.)\1{4,}/.test(pwd) || (prefix.length >= 4 && lower.includes(prefix))) {
    return { valid: false, error: "Essa senha é muito previsível. Escolha uma combinação mais forte." };
  }
  return { valid: true };
}

function hashPasswordPbkdf2Server(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 100000;
  const derived = crypto.pbkdf2Sync(plainPassword, Buffer.from(salt, "hex"), iterations, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${iterations}$${salt}$${derived}`;
}

const ADMIN_FALLBACK_SALT = "optz-adm-v2-1750ded1892039cc";
const ADMIN_FALLBACK_SHA256 = "ae2cd42eebcc662cea2170ed524f8f50481f40c6b9bc5380aff7a67e8ded7734";

let failedSmtpAuthCache: { signature: string; at: number } | null = null;
const SMTP_AUTH_FAIL_CACHE_MS = 5 * 60 * 1000;
type SmtpTransporter = ReturnType<typeof nodemailer.createTransport>;
const smtpTransporterPool = new Map<string, SmtpTransporter>();

function resetSmtpTransporterPool(specificKey?: string) {
  if (specificKey) {
    const existing = smtpTransporterPool.get(specificKey);
    if (existing) {
      try { existing.close(); } catch {}
      smtpTransporterPool.delete(specificKey);
    }
    return;
  }
  for (const [k, transporter] of smtpTransporterPool.entries()) {
    try { transporter.close(); } catch {}
    smtpTransporterPool.delete(k);
  }
}

function getPooledSmtpTransporter(
  cfg: { smtpHost: string; smtpUser: string; smtpPass: string },
  attempt: { port: number; secure: boolean; requireTLS?: boolean }
): { key: string; transporter: SmtpTransporter } {
  const signature = getSmtpSignature(cfg);
  const key = `${signature}:${attempt.port}`;

  // Purge stale entries from outdated credentials
  for (const existingKey of Array.from(smtpTransporterPool.keys())) {
    if (!existingKey.startsWith(`${signature}:`)) {
      resetSmtpTransporterPool(existingKey);
    }
  }

  let transporter = smtpTransporterPool.get(key);
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: attempt.port,
      secure: attempt.secure,
      requireTLS: attempt.requireTLS,
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      connectionTimeout: 4500,
      greetingTimeout: 4500,
      socketTimeout: 8000,
      auth: {
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
      },
    });
    smtpTransporterPool.set(key, transporter);
  }

  return { key, transporter };
}

function getSmtpConfig() {
  const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER || "oportunizahw@gmail.com").trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || "")
    .replace(/\s+/g, '')
    .trim();
  const smtpHost = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const primaryPort = Number(process.env.SMTP_PORT || 465);
  return { smtpUser, smtpPass, smtpHost, primaryPort };
}

function getSmtpSignature(cfg: { smtpHost: string; smtpUser: string; smtpPass: string }): string {
  return `${cfg.smtpHost}:${cfg.smtpUser}:${cfg.smtpPass}`;
}

function isSmtpAuthError(err: any): boolean {
  const code = String(err?.code || '').toUpperCase();
  const responseCode = Number(err?.responseCode || 0);
  const msg = String(err?.message || '').toLowerCase();
  return (
    responseCode === 535 ||
    code === 'EAUTH' ||
    msg.includes('535') ||
    msg.includes('invalid login') ||
    msg.includes('username and password not accepted') ||
    msg.includes('badcredentials')
  );
}

app.get("/api/health", (_req: any, res: any) => {
  const cfg = getSmtpConfig();
  const signature = getSmtpSignature(cfg);
  const isCachedInvalid =
    failedSmtpAuthCache &&
    failedSmtpAuthCache.signature === signature &&
    Date.now() - failedSmtpAuthCache.at < SMTP_AUTH_FAIL_CACHE_MS;

  return res.json({
    ok: true,
    smtpConfigured: Boolean(cfg.smtpUser && cfg.smtpPass && !isCachedInvalid),
    timestamp: new Date().toISOString()
  });
});

async function sendSmtpMail(options: {
  fromLabel: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ delivered: boolean; smtpUser: string; reason?: string }> {
  const cfg = getSmtpConfig();
  const { smtpUser, smtpPass, smtpHost, primaryPort } = cfg;

  if (!smtpUser || !smtpPass) {
    return { delivered: false, smtpUser: "", reason: "smtp-not-configured" };
  }

  const signature = getSmtpSignature(cfg);
  if (
    failedSmtpAuthCache &&
    failedSmtpAuthCache.signature === signature &&
    Date.now() - failedSmtpAuthCache.at < SMTP_AUTH_FAIL_CACHE_MS
  ) {
    return { delivered: false, smtpUser, reason: "smtp-auth-unavailable" };
  }

  const safeFromLabel = sanitizeHeaderText(options.fromLabel).replace(/"/g, "");
  const safeTo = sanitizeHeaderText(options.to);
  const safeSubject = sanitizeHeaderText(options.subject);

  const attempts = primaryPort === 465
    ? [
        { port: 465, secure: true },
        { port: 587, secure: false, requireTLS: true }
      ]
    : [
        { port: primaryPort, secure: primaryPort === 465 },
        { port: 465, secure: true }
      ];

  let lastError: any = null;
  for (const cfgAttempt of attempts) {
    const { key: poolKey, transporter } = getPooledSmtpTransporter(cfg, cfgAttempt);
    try {
      await transporter.sendMail({
        from: `"${safeFromLabel}" <${smtpUser}>`,
        to: safeTo,
        subject: safeSubject,
        html: options.html,
      });

      failedSmtpAuthCache = null;
      return { delivered: true, smtpUser };
    } catch (err: any) {
      lastError = err;
      resetSmtpTransporterPool(poolKey);
      console.warn(`SMTP attempt on port ${cfgAttempt.port} failed for ${safeTo}:`, err?.message || err);
      if (isSmtpAuthError(err)) {
        failedSmtpAuthCache = { signature, at: Date.now() };
        return { delivered: false, smtpUser, reason: "smtp-auth-unavailable" };
      }
    }
  }

  throw lastError || new Error("Falha ao conectar ao servidor SMTP.");
}

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
app.all("/api/supabase-proxy", proxyRateLimit, async (req: any, res: any) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: "Missing Target URL" });
  }

  const defaultSupabaseUrl = "https://ckzygdwhihybrdzctdup.supabase.co";
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || defaultSupabaseUrl).replace(/\/$/, "");
  const allowedHost = new URL(supabaseUrl).host;
  const allowedPathPrefixes = ['/rest/v1/', '/auth/v1/', '/storage/v1/', '/functions/v1/'];

  try {
    const parsedTarget = new URL(targetUrl);
    if (parsedTarget.protocol !== 'https:' || parsedTarget.host !== allowedHost) {
      return res.status(403).json({ error: "Forbidden Target Domain" });
    }
    if (!allowedPathPrefixes.some((prefix) => parsedTarget.pathname.startsWith(prefix))) {
      return res.status(403).json({ error: "Forbidden Target Path" });
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: bodyContent,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    res.status(response.status);
    
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
app.post("/api/mentor", mentorRateLimit, async (req: any, res: any) => {
  const { messages } = req.body;
  
  if (!messages || !Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    return res.status(400).json({ error: "Invalid messages format" });
  }

  const sanitizedMessages = messages
    .filter((m: any) => m && typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-20)
    .map((m: any) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content.slice(0, 4000) }]
    }));

  if (sanitizedMessages.length === 0) {
    return res.status(400).json({ error: "Empty messages" });
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

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: sanitizedMessages,
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

function escapeHtmlText(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatFriendlyEmailName(rawName: string | undefined, email: string): string {
  const cleaned = (rawName || '').trim().slice(0, 80);
  if (cleaned) return cleaned;
  const localPart = String(email || '').split('@')[0] || 'Usuário';
  const firstToken = localPart.split(/[._-]+/)[0] || 'Usuário';
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase();
}

function buildOportunizaEmailHtml(params: {
  preheader: string;
  badge: string;
  title: string;
  greetingName: string;
  introHtml: string;
  code: string;
  codeLabel: string;
  validityNote: string;
  accentColor?: string;
}): string {
  const safePreheader = escapeHtmlText(params.preheader);
  const safeBadge = escapeHtmlText(params.badge);
  const safeTitle = escapeHtmlText(params.title);
  const safeName = escapeHtmlText(params.greetingName);
  const safeCode = escapeHtmlText(params.code);
  const safeCodeLabel = escapeHtmlText(params.codeLabel);
  const safeValidity = escapeHtmlText(params.validityNote);
  const accent = params.accentColor || '#06B6D4';
  const logoUrl = 'https://www.image2url.com/r2/default/images/1781824138816-3fd9702f-4521-41d2-8411-d8fc61114350.png';

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;background-color:#EEF3F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
      ${safePreheader}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F8;padding:32px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border-radius:24px;overflow:hidden;border:1px solid #DCE5F0;">
            <tr>
              <td style="height:5px;background-color:${accent};font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="background-color:#090F1E;padding:30px 28px 26px 28px;text-align:center;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px auto;">
                  <tr>
                    <td style="background-color:#111D36;border:1px solid #1E3A5F;border-radius:18px;padding:10px;">
                      <img src="${logoUrl}" alt="Oportuniza Araucária" width="46" height="46" style="display:block;border-radius:12px;" />
                    </td>
                  </tr>
                </table>
                <div style="font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;line-height:1.2;">
                  Oportuniza <span style="color:#38BDF8;">Araucária</span>
                </div>
                <div style="font-size:11px;font-weight:700;color:#94A3B8;letter-spacing:1.6px;text-transform:uppercase;margin-top:6px;">
                  Portal de Empregos &amp; Qualificação
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 28px 28px;">
                <div style="text-align:center;margin-bottom:16px;">
                  <span style="display:inline-block;background-color:#ECFEFF;color:#0E7490;border:1px solid #A5F3FC;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;padding:6px 14px;border-radius:999px;">
                    ● ${safeBadge}
                  </span>
                </div>
                <h1 style="margin:0 0 12px 0;font-size:25px;line-height:1.25;font-weight:800;color:#0F172A;text-align:center;letter-spacing:-0.3px;">
                  ${safeTitle}
                </h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#334155;text-align:center;">
                  Olá, <strong style="color:#0F172A;">${safeName}</strong>! ${params.introHtml}
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#090F1E;border-radius:20px;border:1px solid #1E293B;overflow:hidden;margin-bottom:22px;">
                  <tr>
                    <td style="height:3px;background-color:#0EA5E9;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:24px 16px 22px 16px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.8px;color:#38BDF8;margin-bottom:14px;">
                        ${safeCodeLabel}
                      </div>
                      <div style="display:inline-block;background-color:#111D36;border:1px solid #0EA5E9;border-radius:14px;padding:14px 24px;font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:800;letter-spacing:5px;color:#FFFFFF;white-space:nowrap;">
                        ${safeCode}
                      </div>
                      <div style="font-size:12px;color:#94A3B8;margin-top:14px;">
                        ${safeValidity}
                      </div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;margin-bottom:18px;">
                  <tr>
                    <td width="33%" style="padding:12px 8px;text-align:center;font-size:12px;color:#334155;border-right:1px solid #E2E8F0;">
                      <strong style="display:block;color:#0284C7;font-size:13px;margin-bottom:2px;">1. Copie</strong>
                      os 8 dígitos
                    </td>
                    <td width="34%" style="padding:12px 8px;text-align:center;font-size:12px;color:#334155;border-right:1px solid #E2E8F0;">
                      <strong style="display:block;color:#0284C7;font-size:13px;margin-bottom:2px;">2. Cole</strong>
                      na tela 2FA
                    </td>
                    <td width="33%" style="padding:12px 8px;text-align:center;font-size:12px;color:#334155;">
                      <strong style="display:block;color:#059669;font-size:13px;margin-bottom:2px;">3. Pronto</strong>
                      acesso liberado
                    </td>
                  </tr>
                </table>
                <div style="text-align:center;margin-bottom:20px;">
                  <a href="https://oportunizaehw.com.br" style="display:inline-block;background-color:#0284C7;color:#FFFFFF;font-size:13px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:12px;">
                    Acessar Oportuniza Araucária &rarr;
                  </a>
                </div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:14px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:12px;line-height:1.6;color:#78350F;">
                      <strong>Não foi você?</strong> Pode ficar tranquilo(a): sem este código de 8 dígitos ninguém entra na sua conta. Basta ignorar este e-mail — nossa equipe nunca solicita códigos por WhatsApp ou ligação.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:#F8FAFC;padding:20px 28px;border-top:1px solid #E2E8F0;text-align:center;">
                <div style="font-size:13px;font-weight:700;color:#0F172A;">
                  <a href="https://oportunizaehw.com.br" style="color:#0284C7;text-decoration:none;">oportunizaehw.com.br</a>
                </div>
                <div style="font-size:11px;color:#64748B;margin-top:5px;">
                  Oportuniza · Araucária / Paraná · Proteção de Conta 2FA
                </div>
                <div style="font-size:11px;color:#94A3B8;margin-top:3px;">
                  &copy; ${new Date().getFullYear()} Oportuniza Araucária · E-mail automático, não responda
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Endpoint to verify Admin credentials safely on server (rate-limited, timing-safe)
app.post("/api/admin-verify", adminAuthRateLimit, (req: any, res: any) => {
  const cleanEmail = String(req.body?.email || 'oportunizahw@gmail.com').trim().toLowerCase();
  const candidate = String(req.body?.password || '');

  if (cleanEmail !== 'oportunizahw@gmail.com' || !candidate) {
    return res.status(401).json({ ok: false, error: "Credenciais administrativas inválidas." });
  }

  const configuredCode = process.env.ADMIN_ACCESS_CODE?.trim();
  let valid = false;
  if (configuredCode) {
    valid = timingSafeHexEqual(sha256Hex(candidate), sha256Hex(configuredCode));
  } else {
    const computed = sha256Hex(`${ADMIN_FALLBACK_SALT}:${candidate}`);
    valid = timingSafeHexEqual(computed, ADMIN_FALLBACK_SHA256);
  }

  if (!valid) {
    return res.status(401).json({ ok: false, error: "E-mail ou senha do administrador incorretos." });
  }

  return res.json({ ok: true });
});

// Endpoint to verify server-generated 8-digit OTP codes (2FA, registration, recovery)
app.post("/api/verify-security-code", verifyRateLimit, (req: any, res: any) => {
  sweepSecurityStores();
  const challengeId = String(req.body?.challengeId || '').trim();
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  const cleanCode = String(req.body?.code || '').replace(/\D/g, '');
  const expectedKind = req.body?.kind ? String(req.body.kind).trim() : undefined;

  if (!challengeId || !cleanEmail || cleanCode.length !== 8 || !/^\d{8}$/.test(cleanCode)) {
    return res.status(400).json({ verified: false, error: "Dados de verificação inválidos." });
  }

  const challenge = securityChallenges.get(challengeId);
  if (!challenge) {
    return res.status(410).json({
      verified: false,
      expired: true,
      error: "Código expirado ou inválido. Clique em Reenviar Código."
    });
  }

  if (Date.now() > challenge.expiresAt) {
    securityChallenges.delete(challengeId);
    return res.status(410).json({
      verified: false,
      expired: true,
      error: "Este código expirou após 10 minutos. Solicite um novo código."
    });
  }

  if (challenge.email !== cleanEmail || (expectedKind && challenge.kind !== expectedKind)) {
    return res.status(400).json({ verified: false, error: "Código não corresponde ao usuário." });
  }

  if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) {
    securityChallenges.delete(challengeId);
    return res.status(429).json({
      verified: false,
      locked: true,
      error: "Limite de tentativas incorretas atingido. Por segurança, o código foi invalidado."
    });
  }

  const computedHash = sha256Hex(`${challenge.salt}:${cleanCode}`);
  if (!timingSafeHexEqual(computedHash, challenge.codeHash)) {
    challenge.attempts += 1;
    const remaining = MAX_CHALLENGE_ATTEMPTS - challenge.attempts;
    if (remaining <= 0) {
      securityChallenges.delete(challengeId);
      return res.status(429).json({
        verified: false,
        locked: true,
        attemptsRemaining: 0,
        error: "Código bloqueado após 5 tentativas incorretas. Clique em Reenviar Código para gerar um novo."
      });
    }
    return res.status(400).json({
      verified: false,
      attemptsRemaining: remaining,
      error: `Código incorreto. Você tem mais ${remaining} tentativa(s) antes do bloqueio preventivo.`
    });
  }

  // Valid single-use verification -> destroy challenge
  securityChallenges.delete(challengeId);

  if (challenge.kind === 'recovery') {
    const rawResetToken = crypto.randomBytes(32).toString("hex");
    verifiedResetTokens.set(sha256Hex(rawResetToken), {
      email: challenge.email,
      expiresAt: Date.now() + CHALLENGE_TTL_MS
    });
    return res.json({ verified: true, resetToken: rawResetToken });
  }

  return res.json({ verified: true });
});

// Endpoint to send 2FA verification email to Gmail / external address
app.post("/api/send-2fa-email", mailRateLimitByIp, mailRateLimitByEmail, async (req: any, res: any) => {
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  const { userName, isAdmin, accountType } = req.body || {};

  if (!isValidServerEmail(cleanEmail)) {
    return res.status(400).json({ error: "E-mail válido é obrigatório." });
  }

  const kind: SecurityChallenge['kind'] = isAdmin ? 'admin-2fa' : 'login-2fa';
  const { challengeId, code } = createServerSecurityChallenge(cleanEmail, kind);
  const displayName = formatFriendlyEmailName(userName, cleanEmail);
  const accessTarget = isAdmin
    ? "ao <strong style=\"color:#0F172A;\">Painel Administrativo</strong>"
    : accountType === "company"
    ? "ao <strong style=\"color:#0F172A;\">Painel da Empresa</strong>"
    : "à sua conta";

  const htmlContent = buildOportunizaEmailHtml({
    preheader: `${code} é o seu código de verificação de 8 dígitos no Oportuniza Araucária.`,
    badge: isAdmin ? "Segurança Administrativa · 2FA" : "Proteção de Conta · 2FA",
    title: "Aqui está o seu código de acesso",
    greetingName: displayName,
    introHtml: `Recebemos um pedido para entrar ${accessTarget} no <strong style="color:#0F172A;">Oportuniza Araucária</strong>. Para confirmar que é você mesmo(a), use o código abaixo:`,
    code,
    codeLabel: "Código de Verificação · 8 Dígitos",
    validityNote: "⏱️ Válido por 10 minutos · 🔒 Uso único e pessoal",
    accentColor: "#06B6D4"
  });

  try {
    const result = await sendSmtpMail({
      fromLabel: "Oportuniza Araucária",
      to: cleanEmail,
      subject: `${code} é o seu código de acesso ao Oportuniza`,
      html: htmlContent,
    });

    if (result.delivered) {
      console.log(`2FA email dispatched via SMTP (${result.smtpUser}) to ${cleanEmail}`);
      return res.json({
        success: true,
        delivered: true,
        serverVerified: true,
        challengeId,
        expiresInSeconds: 600,
        message: `E-mail de 2FA enviado com sucesso via ${result.smtpUser} para ${cleanEmail}`
      });
    } else {
      securityChallenges.delete(challengeId);
      return res.json({
        success: true,
        delivered: false,
        fallbackRequired: true,
        reason: result.reason || "smtp-not-configured",
        message: "SMTP direto indisponível no servidor; utilizando fallback Supabase Auth."
      });
    }
  } catch (err: any) {
    securityChallenges.delete(challengeId);
    console.error("Error sending 2FA email:", err);
    return res.status(500).json({
      error: "Falha ao enviar e-mail de verificação 2FA.",
      details: err.message
    });
  }
});

// Endpoint to send registration verification email
app.post("/api/send-registration-email", mailRateLimitByIp, mailRateLimitByEmail, async (req: any, res: any) => {
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  const { userName } = req.body || {};

  if (!isValidServerEmail(cleanEmail)) {
    return res.status(400).json({ error: "E-mail válido é obrigatório." });
  }

  const { challengeId, code } = createServerSecurityChallenge(cleanEmail, 'registration');
  const displayName = formatFriendlyEmailName(userName, cleanEmail);
  const htmlContent = buildOportunizaEmailHtml({
    preheader: `Bem-vindo(a) ao Oportuniza! Seu código de ativação de 8 dígitos é ${code}.`,
    badge: "Ativação de Nova Conta",
    title: "Seja bem-vindo(a) ao Oportuniza!",
    greetingName: displayName,
    introHtml: "Falta só um passo para você aproveitar as melhores vagas e cursos de Araucária! Digite o código abaixo para ativar seu cadastro com segurança:",
    code,
    codeLabel: "Código de Ativação · 8 Dígitos",
    validityNote: "⏱️ Válido por 10 minutos · Confirmação de cadastro",
    accentColor: "#0891B2"
  });

  try {
    const result = await sendSmtpMail({
      fromLabel: "Oportuniza Araucária",
      to: cleanEmail,
      subject: `Bem-vindo(a) ao Oportuniza! Código de ativação: ${code}`,
      html: htmlContent,
    });

    if (result.delivered) {
      console.log(`Registration email sent to ${cleanEmail}`);
      return res.json({
        success: true,
        delivered: true,
        serverVerified: true,
        challengeId,
        expiresInSeconds: 600,
        message: `Código enviado via ${result.smtpUser} para ${cleanEmail}`
      });
    } else {
      securityChallenges.delete(challengeId);
      return res.json({
        success: true,
        delivered: false,
        fallbackRequired: true,
        reason: result.reason || "smtp-not-configured"
      });
    }
  } catch (err: any) {
    securityChallenges.delete(challengeId);
    console.error("Error sending registration email:", err);
    return res.status(500).json({ error: "Falha ao enviar e-mail", details: err.message });
  }
});

// Endpoint to send password recovery email from oportunizahw@gmail.com (NEVER leaks code in JSON)
app.post("/api/send-password-recovery-email", mailRateLimitByIp, mailRateLimitByEmail, async (req: any, res: any) => {
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();

  if (!isValidServerEmail(cleanEmail)) {
    return res.status(400).json({ error: "O e-mail válido é obrigatório para recuperar a senha." });
  }

  const { challengeId, code: recoveryCode } = createServerSecurityChallenge(cleanEmail, 'recovery');
  const displayName = formatFriendlyEmailName(undefined, cleanEmail);

  const htmlContent = buildOportunizaEmailHtml({
    preheader: `Código para redefinir sua senha no Oportuniza Araucária: ${recoveryCode}.`,
    badge: "Recuperação de Senha",
    title: "Crie uma nova senha com segurança",
    greetingName: displayName,
    introHtml: `Recebemos um pedido para redefinir a senha da conta <strong style="color:#0F172A;">${escapeHtmlText(cleanEmail)}</strong>. Digite o código de segurança abaixo no portal:`,
    code: recoveryCode,
    codeLabel: "Código de Recuperação · 8 Dígitos",
    validityNote: "⏱️ Válido por 10 minutos · Uso único",
    accentColor: "#0284C7"
  });

  try {
    const result = await sendSmtpMail({
      fromLabel: "Oportuniza Araucária",
      to: cleanEmail,
      subject: `${recoveryCode} é o seu código para redefinir a senha`,
      html: htmlContent,
    });

    if (result.delivered) {
      console.log(`Password recovery email dispatched via ${result.smtpUser} to ${cleanEmail}`);
      return res.json({
        success: true,
        delivered: true,
        serverVerified: true,
        challengeId,
        expiresInSeconds: 600,
        message: `E-mail de recuperação enviado com sucesso via ${result.smtpUser} para ${cleanEmail}!`
      });
    } else {
      securityChallenges.delete(challengeId);
      return res.json({
        success: true,
        delivered: false,
        fallbackRequired: true,
        reason: result.reason || "smtp-not-configured",
        message: "SMTP direto indisponível no servidor."
      });
    }
  } catch (err: any) {
    securityChallenges.delete(challengeId);
    console.error("Error sending password recovery email:", err);
    return res.status(500).json({
      error: "Falha ao enviar e-mail de recuperação",
      details: err.message
    });
  }
});

// Authenticated & token-verified password update endpoint (prevents unauthenticated takeover)
app.post("/api/update-password", passwordUpdateRateLimit, async (req: any, res: any) => {
  sweepSecurityStores();
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  const newPassword = String(req.body?.newPassword || '');
  const resetToken = String(req.body?.resetToken || '').trim();
  const authHeader = String(req.headers?.authorization || '');
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

  if (!isValidServerEmail(cleanEmail) || !newPassword) {
    return res.status(400).json({ error: "E-mail válido e nova senha são obrigatórios." });
  }

  const strengthCheck = validateServerPasswordStrength(newPassword, cleanEmail);
  if (!strengthCheck.valid) {
    return res.status(400).json({ error: strengthCheck.error });
  }

  const defaultSupabaseUrl = "https://ckzygdwhihybrdzctdup.supabase.co";
  const rawUrl = process.env.VITE_SUPABASE_URL || defaultSupabaseUrl;
  const supabaseUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const supabaseKey = serviceRoleKey || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_QHYzyrfocbKo60XS5EFYBA_Js8u-l0O";
  const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    !serviceRoleKey && bearerToken
      ? { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
      : undefined
  );

  // Strict authorization: requires either verified server resetToken OR valid Supabase JWT for that email
  let isAuthorized = false;
  let tokenSubjectUserId = '';
  if (resetToken) {
    const tokenHash = sha256Hex(resetToken);
    const tokenEntry = verifiedResetTokens.get(tokenHash);
    if (tokenEntry && tokenEntry.email === cleanEmail && Date.now() <= tokenEntry.expiresAt) {
      verifiedResetTokens.delete(tokenHash); // consume single-use token
      isAuthorized = true;
    }
  } else if (bearerToken) {
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser(bearerToken);
      if (!userErr && userData?.user?.email && userData.user.email.trim().toLowerCase() === cleanEmail) {
        isAuthorized = true;
        tokenSubjectUserId = userData.user.id || '';
      }
    } catch {
      // Invalid JWT
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({
      error: "Autorização inválida ou expirada. Valide o código de verificação antes de redefinir sua senha."
    });
  }

  try {
    const hashedPassword = hashPasswordPbkdf2Server(newPassword);

    const { data: existingRows, error: findError } = await supabase
      .from('users')
      .select('id, email')
      .ilike('email', cleanEmail)
      .limit(1);

    const existingUser = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

    if (findError) {
      console.error(`Error finding user by email ${cleanEmail}:`, findError);
      return res.status(500).json({
        error: "Erro ao consultar usuário no banco.",
        details: findError.message
      });
    }

    if (!existingUser) {
      return res.status(404).json({
        error: "Nenhuma conta cadastrada foi encontrada para este e-mail."
      });
    }

    // If service role key is present, also synchronize Supabase Auth password securely
    if (serviceRoleKey) {
      const targetAuthId = tokenSubjectUserId || existingUser.id;
      if (targetAuthId && !String(targetAuthId).startsWith('usr-')) {
        try {
          await supabase.auth.admin.updateUserById(String(targetAuthId), { password: newPassword });
        } catch (authAdminErr) {
          console.warn("Supabase admin updateUserById notice:", authAdminErr);
        }
      }
    }

    const { error: updateByEmailError } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingUser.id);

    if (updateByEmailError) {
      console.error(`Password update failed for ${cleanEmail} (ID: ${existingUser.id}):`, updateByEmailError);
      return res.status(500).json({
        error: "Falha ao atualizar senha do perfil existente",
        details: updateByEmailError.message,
        code: updateByEmailError.code
      });
    }

    return res.json({ success: true, message: "Senha atualizada e criptografada com sucesso." });
  } catch (err: any) {
    console.error("Critical error in /api/update-password:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao processar troca de senha." });
  }
});

async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const entryScript = process.argv[1] || '';
  const isCompiledServer =
    (typeof __filename === 'string' && (__filename.endsWith('server.cjs') || __filename.endsWith('server.js'))) ||
    entryScript.endsWith('server.cjs') ||
    entryScript.endsWith('server.js');
  const shouldServeStatic =
    (process.env.NODE_ENV === "production" || isCompiledServer) &&
    fs.existsSync(path.join(distPath, 'index.html'));

  if (!shouldServeStatic) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} (${shouldServeStatic ? 'production' : 'development'})`);
  });
}

startServer();
