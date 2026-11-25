import React, { useState } from 'react';
import { ArrowLeft, Shield, FileText, Lock, Globe, Info, Scale, CheckCircle2, AlertCircle, Cookie, Database, UserCheck, Eye, RefreshCw, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LegalScreenProps {
  onBack: () => void;
}

const logo = 'https://www.image2url.com/r2/default/images/1781824138816-3fd9702f-4521-41d2-8411-d8fc61114350.png';

export function PrivacyPolicyScreen({ onBack }: LegalScreenProps) {
  const [activeTab, setActiveTab] = useState<'privacy' | 'cookies'>('privacy');

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 absolute inset-0 z-50 font-sans selection:bg-emerald-500 selection:text-white">
      <header className="px-6 pt-8 pb-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-300 hover:text-white cursor-pointer border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" /> Política de Privacidade & Proteção de Dados (LGPD)
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Conformidade com a Lei nº 13.709/2018 (LGPD) • Atualizado em Novembro de 2026</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'privacy' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Política Geral
          </button>
          <button
            onClick={() => setActiveTab('cookies')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'cookies' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Política de Cookies
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 max-w-4xl mx-auto w-full custom-scroll leading-relaxed">
        {activeTab === 'privacy' ? (
          <div className="space-y-8 animate-fadeIn">
            {/* Introdução */}
            <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" /> 1. Introdução e Compromisso com a Transparência
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                O portal <strong>Araucária Oportuniza</strong> ("Plataforma", "Nós", "Nosso") reconhece a importância da privacidade dos dados pessoais de seus usuários ("Candidatos", "Empresas", "Visitantes"). Esta Política de Privacidade explica detalhadamente como coletamos, usamos, armazenamos, compartilhamos e protegemos suas informações pessoais em total conformidade com a Constituição Federal da República Federativa do Brasil, o Marco Civil da Internet (Lei nº 12.965/2014) e a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018).
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Ao utilizar nossa plataforma, criar contas ou enviar currículos e propostas de emprego, você declara estar ciente e de acordo com as práticas descritas neste documento. Caso não concorde com os termos, recomendamos que interrompa o uso do sistema imediatamente.
              </p>
            </div>

            {/* Dados Coletados */}
            <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-400" /> 2. Quais Dados Pessoais Coletamos
              </h2>
              <p className="text-xs text-slate-300">
                Coletamos apenas os dados estritamente necessários para viabilizar a empregabilidade municipal, divididos nas seguintes categorias:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs text-slate-300">
                <li><strong>Dados de Identificação:</strong> Nome completo, e-mail, número de telefone/WhatsApp, foto de perfil (avatar).</li>
                <li><strong>Dados Profissionais e Acadêmicos (Candidatos):</strong> Histórico de experiências profissionais, formação educacional, competências técnicas, links para portfólio e currículo em texto ou arquivo.</li>
                <li><strong>Dados Corporativos (Empresas):</strong> Razão social, CNPJ, nome do responsável de Recursos Humanos, cargo, segmento de atuação, bairro em Araucária e endereço comercial.</li>
                <li><strong>Dados de Navegação e Sessão:</strong> Endereço IP, tipo de navegador, páginas acessadas, horários de acesso e registros de autenticação (tokens de sessão e preferências de 2FA).</li>
              </ul>
            </div>

            {/* Finalidade do Tratamento */}
            <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" /> 3. Finalidade e Base Legal para o Tratamento
              </h2>
              <p className="text-xs text-slate-300">
                O tratamento de dados realizado pela plataforma fundamenta-se nas hipóteses legais previstas na LGPD (Art. 7º e 11º), especialmente para o cumprimento de obrigações contratuais, legítimo interesse e exercício regular de direitos em processos seletivos. As finalidades incluem:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1.5">
                  <h3 className="text-xs font-bold text-emerald-400">Conexão Empregador-Candidato</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Permitir que empresas visualizem currículos e iniciem conversas via WhatsApp ou e-mail.</p>
                </div>
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1.5">
                  <h3 className="text-xs font-bold text-emerald-400">Qualificação Profissional</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Gerenciar inscrições em trilhas de capacitação e acompanhar o progresso de aulas.</p>
                </div>
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1.5">
                  <h3 className="text-xs font-bold text-emerald-400">Segurança da Informação</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Prevenir fraudes, mitigar ataques cibernéticos e validar identidades com autenticação em duas etapas (2FA).</p>
                </div>
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1.5">
                  <h3 className="text-xs font-bold text-emerald-400">Geoprocessamento Urbano</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Posicionar sedes de empresas no mapa interativo para facilitar o planejamento de deslocamento do trabalhador.</p>
                </div>
              </div>
            </div>

            {/* Segurança e LGPD */}
            <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-400" /> 4. Segurança de Armazenamento e Criptografia
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Utilizamos infraestrutura de ponta em nuvem fornecida pelo <strong>Supabase</strong> (PostgreSQL), protegida por políticas estritas de segurança em nível de linha (RLS - <em>Row Level Security</em>), chaves de API restritas, conexões criptografadas via SSL/TLS (HTTPS) e senhas armazenadas com algoritmos de *hashing* seguro (PBKDF2/SHA-256). Nenhum dado pessoal é comercializado ou alugado a terceiros em hipótese alguma.
              </p>
            </div>

            {/* Direitos do Titular */}
            <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-400" /> 5. Seus Direitos como Titular (Art. 18 da LGPD)
              </h2>
              <p className="text-xs text-slate-300">
                Você possui direito absoluto de requisitar a qualquer momento:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs text-slate-300">
                <li>Confirmação da existência de tratamento de dados pessoais;</li>
                <li>Acesso facilitado aos seus dados cadastrados;</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
                <li>Revogação do consentimento e exclusão definitiva da conta e histórico.</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-fadeIn">
            {/* Política de Cookies */}
            <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Cookie className="w-5 h-5 text-emerald-400" /> Política de Cookies e Armazenamento Local
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Esta seção explica como o portal Araucária Oportuniza utiliza cookies e tecnologias similares de armazenamento local (como <em>localStorage</em> e <em>sessionStorage</em>) para reconhecer seu navegador, lembrar suas preferências de sessão e manter sua conta segura.
              </p>

              <div className="space-y-4 pt-2">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                  <h3 className="text-xs font-bold text-emerald-400">1. Cookies Estritamente Necessários (Essenciais)</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Indispensáveis para o funcionamento técnico do portal. Gerenciam o token de autenticação Supabase, o estado de login e a verificação de segurança 2FA. Sem estes, o site não opera corretamente.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                  <h3 className="text-xs font-bold text-cyan-400">2. Cookies de Desempenho e Preferências</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Armazenam suas escolhas de navegação (como filtros de vagas, bairro selecionado e preferências de visualização) para otimizar seu tempo de busca por oportunidades.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                  <h3 className="text-xs font-bold text-purple-400">3. Como Gerenciar ou Desativar Cookies</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Você pode configurar seu navegador da web (Chrome, Firefox, Safari, Edge) para recusar cookies ou alertá-lo quando forem enviados. Note que a desativação de cookies essenciais poderá impedir o login e a navegação segura na plataforma.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center pt-4 pb-12 border-t border-slate-800">
          <p className="text-xs text-slate-400">Dúvidas, solicitações ou denúncias relacionadas à LGPD?</p>
          <a href="mailto:contato@oportuniza.araucaria.br" className="mt-1.5 inline-block text-xs font-bold text-emerald-400 hover:underline">
            contato@oportuniza.araucaria.br
          </a>
        </div>
      </div>
    </div>
  );
}

export function TermsOfServiceScreen({ onBack }: LegalScreenProps) {
  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 absolute inset-0 z-50 font-sans selection:bg-emerald-500 selection:text-white">
      <header className="px-6 pt-8 pb-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-300 hover:text-white cursor-pointer border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" /> Termos de Uso e Condições Gerais
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Contrato de Utilização do Portal • Araucária Oportuniza</p>
          </div>
        </div>

        <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center shrink-0 shadow-md">
          <img src={logo} alt="Oportuniza" className="w-full h-full object-contain" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 max-w-4xl mx-auto w-full custom-scroll leading-relaxed">
        {/* Sumário Executivo */}
        <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-3">
          <div className="w-12 h-1 bg-emerald-500 rounded-full" />
          <h2 className="text-base font-bold text-white">Ao acessar e utilizar o Araucária Oportuniza, você concorda integralmente com estes Termos.</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Estes Termos de Serviço regulam o acesso e a utilização da plataforma web institucional e de empregabilidade do município de Araucária (PR). Leia atentamente todas as cláusulas antes de concluir seu cadastro como candidato ou empresa.
          </p>
        </div>

        {/* Cláusula 1 */}
        <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-xs font-bold border border-emerald-500/30">01</span>
            <h3 className="text-sm font-bold text-white">Natureza da Plataforma e Elegibilidade</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pl-10">
            O <strong>Araucária Oportuniza</strong> é uma iniciativa digital integradora voltada a aproximar munícipes de oportunidades de emprego, estágio, menor aprendiz e cursos de capacitação profissional. Para utilizar os serviços, o usuário deve possuir capacidade civil plena ou estar devidamente assistido por responsável legal, fornecendo dados verídicos e válidos no momento do cadastro.
          </p>
        </div>

        {/* Cláusula 2 */}
        <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-xs font-bold border border-emerald-500/30">02</span>
            <h3 className="text-sm font-bold text-white">Obrigações e Conduta do Candidato</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pl-10">
            O candidato compromete-se a manter seu currículo e informações de contato (telefone/WhatsApp e e-mail) rigorosamente atualizados. É terminantemente proibido o envio de informações falsas, documentos adulterados, uso de linguagem ofensiva em candidaturas ou tentativa de engenharia social e ataques cibernéticos contra a plataforma.
          </p>
        </div>

        {/* Cláusula 3 */}
        <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-xs font-bold border border-emerald-500/30">03</span>
            <h3 className="text-sm font-bold text-white">Responsabilidades das Empresas e Empregadores</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pl-10">
            As empresas cadastradas com CNPJ respondem civil e criminalmente pela veracidade das vagas anunciadas, salários informados, cumprimento das leis trabalhistas brasileiras (CLT) e leis de estágio. A publicação de vagas falsas, discriminatórias, enganosas ou com teor impróprio acarretará o banimento imediato da empresa do sistema e comunicação aos órgãos competentes.
          </p>
        </div>

        {/* Cláusula 4 */}
        <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-xs font-bold border border-emerald-500/30">04</span>
            <h3 className="text-sm font-bold text-white">Propriedade Intelectual</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pl-10">
            Todos os direitos autorais, marcas registradas, códigos-fonte, algoritmos, layouts de interface, videoaulas e materiais didáticos disponibilizados no Oportuniza são protegidos por leis de propriedade intelectual. É vedada a reprodução, engenharia reversa ou distribuição comercial sem autorização expressa prévia.
          </p>
        </div>

        {/* Cláusula 5 */}
        <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-xs font-bold border border-emerald-500/30">05</span>
            <h3 className="text-sm font-bold text-white">Limitação de Responsabilidade</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pl-10">
            O Oportuniza atua como intermediário tecnológico facilitador da empregabilidade municipal. A plataforma não garante a contratação imediata de candidatos, visto que os processos seletivos são de decisão exclusiva das empresas contratantes. Não nos responsabilizamos por instabilidades decorrentes de falhas na operadora de internet do usuário ou força maior.
          </p>
        </div>

        {/* Cláusula 6 */}
        <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-xs font-bold border border-emerald-500/30">06</span>
            <h3 className="text-sm font-bold text-white">Modificações dos Termos e Encerramento</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pl-10">
            Reservamo-nos o direito de alterar estes Termos de Uso a qualquer momento para refletir melhorias tecnológicas ou exigências legais. O uso continuado da plataforma após as alterações constitui aceitação tácita da nova versão.
          </p>
        </div>

        <div className="text-center pt-4 pb-12 border-t border-slate-800">
          <p className="text-xs text-slate-400">Em caso de dúvidas sobre este contrato de utilização:</p>
          <a href="mailto:suporte@oportuniza.araucaria.br" className="mt-1.5 inline-block text-xs font-bold text-emerald-400 hover:underline">
            suporte@oportuniza.araucaria.br
          </a>
        </div>
      </div>
    </div>
  );
}
