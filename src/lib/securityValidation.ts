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
 * Normalizes string removing accents and special symbols for profanity check
 */
export function normalizeSecurityText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[@._\-+0-9!#$%&'*+/=?^_`{|}~]/g, '');
}

/**
 * Checks if a string contains any blocked offensive/troll words
 */
export function containsOffensiveLanguage(text: string): { found: boolean; word?: string } {
  if (!text) return { found: false };
  const rawLower = text.toLowerCase();
  const normalized = normalizeSecurityText(text);

  for (const word of BLOCKED_OFFENSIVE_WORDS) {
    // Check direct substring
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
  * Validates phone number ensuring it does not start with 0
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

  if (digits.length < 10) {
    return {
      isValid: false,
      error: 'O número de telefone deve conter DDD + número.',
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

  if (clean.length < 3) {
    return {
      isValid: false,
      error: isCompany 
        ? 'A Razão Social / Nome da Empresa deve ter no mínimo 3 caracteres.' 
        : 'Por favor, digite seu nome e sobrenome reais.',
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
 * Basic CNPJ format & structure check
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

  return { isValid: true };
}
