/**
 * LGPD & Legal Responsibility Terms for Companies - Oportuniza Araucária
 * Enforces compliance with:
 * - Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD)
 * - Art. 299 do Código Penal Brasileiro (Falsidade Ideológica)
 * - Consolidação das Leis do Trabalho (CLT) e Estatuto da Criança e do Adolescente (ECA / Lei do Menor Aprendiz)
 * - Diretrizes de Empregabilidade Municipal de Araucária (PR)
 */

export interface CompanyLegalAcceptance {
  accepted: boolean;
  acceptedAt: string;
  ipAddress?: string;
  signatoryName: string;
  companyName: string;
  cnpj?: string;
  version: string;
}

export const COMPANY_LGPD_TERMS_VERSION = '2026.1-LEGAL';

export const COMPANY_LGPD_DECLARATION_SUMMARY = `TERMO DE USO GERAL, POLÍTICA DE PRIVACIDADE E CONFORMIDADE COM A LGPD (LEI Nº 13.709/2018)
PLATAFORMA MUNICIPAL OPORTUNIZA ARAUCÁRIA (PR)

ATENÇÃO CIDADÃOS, CANDIDATOS E REPRESENTANTES DE EMPRESAS:
Este documento constitui o Contrato Oficial de Termos de Uso e LGPD da plataforma Oportuniza Araucária. Ao criar uma conta e marcar a opção "Li e aceito os Termos de Uso", você concorda integralmente e de forma irrevogável com todas as diretrizes, obrigações e sanções legais descritas abaixo.

1. DA NATUREZA DA PLATAFORMA E BOA-FÉ
O Oportuniza Araucária é um serviço público municipal de excelência voltado à empregabilidade, capacitação e inserção de jovens, menores aprendizes, estagiários e profissionais no mercado de trabalho formal de Araucária-PR. O uso da plataforma exige estrita lisura, respeito e responsabilidade cívica.

2. DA LGPD (LEI FEDERAL Nº 13.709/2018) E PROTEÇÃO DE DADOS
Em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD), todos os dados coletados (nome, e-mail, telefone, bairro, histórico profissional e currículos) bem como dados corporativos (Razão Social, CNPJ e contatos de RH) são armazenados em ambiente seguro. O tratamento visa exclusivamente a consecução das finalidades de intermediação de vagas de emprego e suporte institucional. É vedada a comercialização, repasse indevido ou uso para fins publicitários externos.

3. DA PROIBIÇÃO ABSOLUTA DE CONTAS FALSAS, CNPJS FRAUDULENTOS E "ZARALHOS"
Fica terminantemente proibida a criação de cadastros fictícios, perfis de teste com nomes vulgares ou ofensivos, e-mails descartáveis, bem como o cadastramento de empresas ou CNPJs falsos ("zaralhos", pegadinhas ou conteúdos +18). 

4. DAS SANÇÕES SEVERAS E RESPONSABILIDADE PENAL (ART. 299 DO CÓDIGO PENAL)
Qualquer tentativa de burlar o sistema, inserir dados falsos ou utilizar a plataforma para postagens impróprias, trotes ou fraudes acarretará:
- Banimento sumário e permanente da conta e do IP associado;
- Bloqueio imediato do CNPJ infrator nos registros municipais;
- Abertura de processo judicial nas esferas Cível e Criminal, incorrendo nos crimes de Falsidade Ideológica (Art. 299 do Código Penal Brasileiro) e Estelionato, sujeitando os autores a reclusão, multas pesadas e reparação integral por danos morais coletivos e prejuízos causados à comunidade de Araucária.`;

export const COMPANY_LGPD_CLAUSES = [
  {
    title: 'Seção I: Da Autenticidade Cadastral e Identidade',
    content: 'O usuário declara sob as penas da lei que todas as informações prestadas são inteiramente verdadeiras. O uso de identidades falsas ou CNPJ de terceiros sem autorização expressa constitui crime federal passível de investigação policial imediata pela Polícia Civil.'
  },
  {
    title: 'Seção II: Segurança da Informação e LGPD',
    content: 'A plataforma adota protocolos avançados de segurança digital para proteger o sigilo dos candidatos. Os recrutadores comprometem-se a utilizar os contatos de jovens apenas para agendamento de entrevistas de emprego legítimas, respeitando a privacidade e os direitos fundamentais garantidos pela Constituição Federal.'
  },
  {
    title: 'Seção III: Tolerância Zero contra Vagas Falsas e "Zaralhos"',
    content: 'Anúncios de vagas falsas, esquemas piramidais, propostas vexatórias ou publicações imorais ("zaralhos") serão imediatamente reportados às autoridades competentes (Ministério Público do Trabalho e Delegacia de Polícia), com fornecimento integral de logs de acesso, endereços IP e dados cadastrais para responsabilização criminal.'
  },
  {
    title: 'Seção IV: Moderação, Auditoria e Suporte Oportuniza (Nível 2)',
    content: 'A equipe de Atendimento Oportuniza (Nível 2) monitora em tempo real a plataforma para coibir spams, assédios ou abusos. Denúncias de empresas ou usuários infratores resultam em suspensão imediata e bloqueio irrevogável.'
  },
  {
    title: 'Seção V: Foro e Legislação Aplicável',
    content: 'Fica eleito o Foro da Comarca de Araucária, Estado do Paraná, para dirimir quaisquer litígios oriundos destes Termos de Uso, com renúncia expressa a qualquer outro, por mais privilegiado que seja.'
  }
];
