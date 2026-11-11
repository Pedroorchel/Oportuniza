/**
 * Security & Anti-Fraud Validation for Oportuniza Araucária
 * Prevents creation of accounts with:
 * - Disposable / temporary emails (temp-mail, 10minutemail, etc.)
 * - Vulgar, obscene, abusive or offensive words ('zaralhos', 'sacanagem', profanity)
 * - Fictitious, troll, or bot email patterns
 * - Malformed company or candidate data
 */

// Known disposable, temporary and burner email domains
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'tempmail.net',
  '10minutemail.com',
  '10minutemail.net',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'sharklasers.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'dispostable.com',
  'getnada.com',
  'nada.ltd',
  'inboxkitten.com',
  'fakeinbox.com',
  'fakemailgenerator.com',
  'crazymailing.com',
  'mohmal.com',
  'emailondeck.com',
  'burnermail.io',
  'dropmail.me',
  'tempinbox.com',
  'mytemp.email',
  'generator.email',
  'zetmail.com',
  'trash-mail.at',
  'getairmail.com',
  'spambog.com',
  'discard.email',
  'maildrop.cc',
  'harakirimail.com',
  'mytempemail.com',
  'mailnesia.com',
  'boximail.com',
  'pokemail.net',
  'grr.la',
  'spam4.me',
  'binkmail.com',
  'safetymail.info',
  'chacuo.net',
  '0815.ru',
  '10minutemail.co.za'
]);

// Blocked obscene, troll, spam, +18, and offensive words (anti-zaralho / anti-sacanagem / LGPD)
export const BLOCKED_OFFENSIVE_WORDS = [
  'zaralho',
  'zaralhos',
  'zaralhada',
  'sacanagem',
  'sacana',
  'putaria',
  'porno',
  'porn',
  'xxx',
  'sexo',
  'sex',
  'hentai',
  'nudes',
  'nude',
  'novinha',
  'gostosa',
  'safada',
  'safado',
  'caralho',
  'caralha',
  'foder',
  'fudido',
  'fodido',
  'foda-se',
  'fodase',
  'buceta',
  'boceta',
  'xoxota',
  'ppk',
  'pinto',
  'rola',
  'piroca',
  'pica',
  'penis',
  'pênis',
  'vagina',
  'anal',
  'suruba',
  'orgia',
  'cuzao',
  'cuzão',
  'puta',
  'puto',
  'prostituta',
  'vagabundo',
  'vagabunda',
  'viado',
  'viadagem',
  'arrombado',
  'arrombada',
  'merda',
  'bosta',
  'otario',
  'otário',
  'babaca',
  'desgraca',
  'desgraça',
  'fdp',
  'pqp',
  'vsf',
  'vtnc',
  'fake',
  'troll',
  'hacker',
  'bot123',
  'teste1234',
  'asdfgh',
  'qwertyuiop'
];

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  field?: string;
}

/**
 * Normalizes string removing accents, translating leetspeak digits/symbols, and stripping punctuation for profanity check
 */
export function normalizeSecurityText(text: string): string {
  const withoutAccents = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const deLeeted = withoutAccents
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');

  return deLeeted.replace(/[^a-z]/g, '');
}

/**
 * Checks if a string contains any blocked offensive/troll words
 */
export function containsOffensiveLanguage(text: string): { found: boolean; word?: string } {
  if (!text) return { found: false };
  const rawLower = text.toLowerCase();
  const normalized = normalizeSecurityText(text);

  for (const word of BLOCKED_OFFENSIVE_WORDS) {
    if (rawLower.includes(word) || normalized.includes(word)) {
      return { found: true, word };
    }
  }

  return { found: false };
}

/**
 * Validates an email address against syntax, disposable domains, and offensive usernames
 */
export function validateEmailAddress(email: string): ValidationResult {
  const clean = (email || '').trim().toLowerCase();

  if (!clean) {
    return { isValid: false, error: 'O e-mail é obrigatório.', field: 'email' };
  }

  if (clean.length > 254 || /[\r\n\0]/.test(clean)) {
    return { isValid: false, error: 'Endereço de e-mail inválido.', field: 'email' };
  }

  // Basic RFC format test
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(clean)) {
    return { 
      isValid: false, 
      error: 'Formato de e-mail inválido. Utilize um endereço válido (ex: seu.nome@gmail.com).', 
      field: 'email' 
    };
  }

  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Endereço de e-mail mal formatado.', field: 'email' };
  }

  const [localPart, domain] = parts;

  // Domain check for disposable services
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: 'E-mails temporários ou descartáveis não são permitidos no Oportuniza Araucária por razões de segurança e contato com empresas.',
      field: 'email'
    };
  }

  // Extra check for domain keywords resembling temp mail
  if (
    domain.includes('temp') || 
    domain.includes('dispos') || 
    domain.includes('throwaway') || 
    domain.includes('fake') || 
    domain.includes('trash') ||
    domain.includes('10min') ||
    domain.includes('burner')
  ) {
    return {
      isValid: false,
      error: 'O domínio deste e-mail parece ser descartável. Por favor, use um e-mail pessoal ou corporativo real.',
      field: 'email'
    };
  }

  // Check entire email address (local part AND domain) for profanity / zaralhos
  const profanityInEmail = containsOffensiveLanguage(clean);
  if (profanityInEmail.found) {
    return {
      isValid: false,
      error: 'O e-mail informado contém termos impróprios, vulgares ou não permitidos na plataforma municipal.',
      field: 'email'
    };
  }

  // Check minimum length of username
  if (localPart.length < 3) {
    return {
      isValid: false,
      error: 'O prefixo do e-mail é muito curto. Por favor, utilize um e-mail válido.',
      field: 'email'
    };
  }

  return { isValid: true };
}

/**
 * Validates Brazilian phone number (DDD 11-99, 10-11 digits, no leading 0 or repeated dummy numbers)
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  const digits = (phone || '').replace(/\D/g, '');

  if (!digits) {
    return { isValid: true }; // optional if not required in some forms, but if provided must follow rule
  }

  if (digits.startsWith('0')) {
    return {
      isValid: false,
      error: 'O número de telefone/WhatsApp não pode começar com o dígito 0. Por favor, informe um número válido (ex: 41 999999999).',
      field: 'phone'
    };
  }

  if (digits.length < 10 || digits.length > 11) {
    return {
      isValid: false,
      error: 'O número de telefone deve conter DDD + número (10 ou 11 dígitos).',
      field: 'phone'
    };
  }

  const ddd = Number(digits.slice(0, 2));
  if (!Number.isFinite(ddd) || ddd < 11 || ddd > 99) {
    return {
      isValid: false,
      error: 'Informe um DDD brasileiro válido (entre 11 e 99).',
      field: 'phone'
    };
  }

  const subscriber = digits.slice(2);
  if (/^(\d)\1+$/.test(subscriber) || subscriber === '12345678' || subscriber === '123456789' || subscriber === '987654321') {
    return {
      isValid: false,
      error: 'Informe um número de telefone real para contato das empresas.',
      field: 'phone'
    };
  }

  return { isValid: true };
}

/**
 * Validates candidate or company full name
 */
export function validatePersonOrCompanyName(name: string, isCompany = false): ValidationResult {
  const clean = (name || '').trim();

  if (!clean) {
    return { 
      isValid: false, 
      error: isCompany ? 'O Nome da Empresa é obrigatório.' : 'O Nome Completo é obrigatório.', 
      field: isCompany ? 'companyName' : 'name' 
    };
  }

  if (clean.length < 3 || clean.length > 120) {
    return {
      isValid: false,
      error: isCompany 
        ? 'A Razão Social / Nome da Empresa deve ter entre 3 e 120 caracteres.' 
        : 'Por favor, digite seu nome e sobrenome reais (entre 3 e 120 caracteres).',
      field: isCompany ? 'companyName' : 'name'
    };
  }

  const profanityCheck = containsOffensiveLanguage(clean);
  if (profanityCheck.found) {
    return {
      isValid: false,
      error: `O nome informado contém termos impróprios ou proibidos ("${profanityCheck.word}"). Oportuniza Araucária é uma plataforma séria de empregabilidade.`,
      field: isCompany ? 'companyName' : 'name'
    };
  }

  // Check if name is just repeated characters like "aaaaaaa" or "111111"
  if (/^(.)\1+$/.test(clean.replace(/\s/g, ''))) {
    return {
      isValid: false,
      error: 'Por favor, insira um nome real válido.',
      field: isCompany ? 'companyName' : 'name'
    };
  }

  return { isValid: true };
}

/**
 * Full Receita Federal CNPJ format & mod-11 two check-digits validation
 */
export function validateCnpj(cnpj: string): ValidationResult {
  const digits = (cnpj || '').replace(/\D/g, '');

  if (!digits) {
    return { isValid: true }; // optional in some small microenterprises, but when provided must be valid
  }

  if (digits.length !== 14) {
    return {
      isValid: false,
      error: 'O CNPJ deve conter exatamente 14 dígitos numéricos.',
      field: 'cnpj'
    };
  }

  // Disallow all same digits e.g. 00000000000000
  if (/^(\d)\1{13}$/.test(digits)) {
    return {
      isValid: false,
      error: 'CNPJ inválido (sequência de números repetidos).',
      field: 'cnpj'
    };
  }

  // Calculate 1st and 2nd Receita Federal check digits (mod-11)
  const calcDigit = (base: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += Number(base[i]) * weights[i];
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const dv1 = calcDigit(digits.slice(0, 12), w1);
  const dv2 = calcDigit(digits.slice(0, 12) + String(dv1), w2);

  if (dv1 !== Number(digits[12]) || dv2 !== Number(digits[13])) {
    return {
      isValid: false,
      error: 'CNPJ inválido (dígitos verificadores não conferem com a Receita Federal).',
      field: 'cnpj'
    };
  }

  return { isValid: true };
}

export interface PasswordStrengthResult extends ValidationResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Muito Fraca' | 'Fraca' | 'Média' | 'Forte';
  checks: {
    minLength: boolean;
    hasLetter: boolean;
    hasNumber: boolean;
    notCommon: boolean;
    hasUpperAndSymbol: boolean;
  };
}

const WEAK_COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  '00000000',
  '11111111',
  'qwertyui',
  'qwertyuiop',
  'asdfghjk',
  'password',
  'password1',
  'senha123',
  'senha1234',
  'oportuniza',
  'oportuniza1',
  'oportuniza123',
  'araucaria',
  'araucaria123',
  'admin123',
  'admin1234'
]);

/**
 * Validates password strength for registrations and password resets
 */
export function validatePasswordStrength(password: string, contextIdentifier?: string): PasswordStrengthResult {
  const pwd = password || '';
  const lower = pwd.toLowerCase().trim();
  const minLength = pwd.length >= 8;
  const hasLetter = /[a-zA-ZÀ-ÿ]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasUpperAndSymbol = /[A-Z]/.test(pwd) && /[^a-zA-Z0-9]/.test(pwd);

  const hasRepeatedRun = /(.)\1{4,}/.test(pwd);
  const emailPrefix = (contextIdentifier || '').trim().toLowerCase().split('@')[0];
  const containsEmailPrefix = emailPrefix.length >= 4 && lower.includes(emailPrefix);
  const isCommon = WEAK_COMMON_PASSWORDS.has(lower) || hasRepeatedRun || containsEmailPrefix;
  const notCommon = !isCommon;

  let passedCount = 0;
  if (minLength) passedCount++;
  if (hasLetter && hasNumber) passedCount++;
  if (notCommon) passedCount++;
  if (pwd.length >= 10 && (hasUpperAndSymbol || (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)))) passedCount++;

  const score = Math.min(4, passedCount) as 0 | 1 | 2 | 3 | 4;
  const label: PasswordStrengthResult['label'] =
    score <= 1 ? 'Muito Fraca' : score === 2 ? 'Fraca' : score === 3 ? 'Média' : 'Forte';

  if (!minLength) {
    return {
      isValid: false,
      error: 'Por segurança, a senha deve conter pelo menos 8 caracteres.',
      field: 'password',
      score,
      label,
      checks: { minLength, hasLetter, hasNumber, notCommon, hasUpperAndSymbol }
    };
  }

  if (!hasLetter || !hasNumber) {
    return {
      isValid: false,
      error: 'A senha precisa combinar letras e números (ex: Araucaria2026).',
      field: 'password',
      score,
      label,
      checks: { minLength, hasLetter, hasNumber, notCommon, hasUpperAndSymbol }
    };
  }

  if (!notCommon) {
    return {
      isValid: false,
      error: 'Essa senha é muito fácil de adivinhar ou parecida com seu e-mail. Escolha uma combinação única.',
      field: 'password',
      score,
      label,
      checks: { minLength, hasLetter, hasNumber, notCommon, hasUpperAndSymbol }
    };
  }

  return {
    isValid: true,
    score,
    label,
    checks: { minLength, hasLetter, hasNumber, notCommon, hasUpperAndSymbol }
  };
}

/**
 * Validates and sanitizes external links (blocks javascript:, data:, vbscript:, file:)
 */
export function sanitizeExternalUrl(rawUrl?: string | null): string | null {
  const clean = (rawUrl || '').trim();
  if (!clean || clean.length > 600) return null;
  if (/[\r\n\0<>]/.test(clean)) return null;

  try {
    const parsed = new URL(clean);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Cryptographically strong 8-digit code generator (falls back only if crypto is unavailable)
 */
export function generateSecureOtpCode(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    const maxValid = Math.floor(0xffffffff / 90000000) * 90000000;
    let rand = 0;
    do {
      globalThis.crypto.getRandomValues(buf);
      rand = buf[0];
    } while (rand >= maxValid);
    return String(10000000 + (rand % 90000000));
  }
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Pure UTF-8 + SHA-256 fallback so hashing works even on non-HTTPS previews without crypto.subtle
function sha256HexSync(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H).map((n) => n.toString(16).padStart(8, '0')).join('');
}

const ADMIN_FALLBACK_SALT = 'optz-adm-v2-1750ded1892039cc';
const ADMIN_FALLBACK_SHA256 = 'ae2cd42eebcc662cea2170ed524f8f50481f40c6b9bc5380aff7a67e8ded7734';

/**
 * Verifies the emergency static admin access code using a salted SHA-256 digest (no plaintext secret in JS bundle)
 */
export function verifyAdminAccessCodeClient(candidate: string): boolean {
  const clean = candidate || '';
  if (!clean) return false;
  const computed = sha256HexSync(`${ADMIN_FALLBACK_SALT}:${clean}`);
  return timingSafeEqualHex(computed, ADMIN_FALLBACK_SHA256);
}

/**
 * Verifies a password against either hashed (sha256$/pbkdf2_sha256$) or legacy stored password values
 */
export async function verifyStoredPasswordClient(plainPassword: string, storedValue: string): Promise<boolean> {
  if (!plainPassword || !storedValue) return false;

  if (storedValue.startsWith('sha256$')) {
    const parts = storedValue.split('$');
    if (parts.length !== 3) return false;
    const [, salt, digest] = parts;
    const computed = sha256HexSync(`${salt}:${plainPassword}`);
    return timingSafeEqualHex(computed, digest);
  }

  if (storedValue.startsWith('pbkdf2_sha256$')) {
    const parts = storedValue.split('$');
    if (parts.length !== 4 || typeof globalThis === 'undefined' || !globalThis.crypto?.subtle) {
      return false;
    }
    const iterations = Number(parts[1]);
    const saltHex = parts[2];
    const expectedHex = parts[3];
    if (!Number.isFinite(iterations) || iterations < 1000) return false;
    try {
      const saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || []);
      const baseKey = await globalThis.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(plainPassword),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const bits = await globalThis.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
        baseKey,
        256
      );
      const computedHex = Array.from(new Uint8Array(bits))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return timingSafeEqualHex(computedHex, expectedHex);
    } catch {
      return false;
    }
  }

  return timingSafeEqualHex(plainPassword, storedValue);
}

/**
 * Hashes password before persisting into fallback user rows (salted PBKDF2-SHA256 when subtle crypto available, salted SHA-256 fallback)
 */
export async function hashPasswordForStorageClient(plainPassword: string): Promise<string> {
  const randomBytes = new Uint8Array(16);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < randomBytes.length; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }
  const saltHex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    try {
      const baseKey = await globalThis.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(plainPassword),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const iterations = 100000;
      const bits = await globalThis.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: randomBytes, iterations, hash: 'SHA-256' },
        baseKey,
        256
      );
      const hashHex = Array.from(new Uint8Array(bits))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `pbkdf2_sha256$${iterations}$${saltHex}$${hashHex}`;
    } catch {
      // Fallback to salted sha256 if deriveBits restricted
    }
  }

  return `sha256$${saltHex}$${sha256HexSync(`${saltHex}:${plainPassword}`)}`;
}

