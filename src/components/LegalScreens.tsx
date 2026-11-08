import { ArrowLeft, Shield, FileText, Lock, Globe, Info, Scale, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LegalScreenProps {
  onBack: () => void;
}

const logo = 'https://www.image2url.com/r2/default/images/1781824138816-3fd9702f-4521-41d2-8411-d8fc61114350.png';

export function PrivacyPolicyScreen({ onBack }: LegalScreenProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F9FAFB] absolute inset-0 font-sans">
      <header className="px-5 pt-8 pb-5 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-gray-50 active:scale-95 transition-all text-gray-600 cursor-pointer border border-transparent hover:border-gray-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight">Política de Privacidade</h1>
            <p className="text-[9px] text-gray-400 font-medium">Atualizado em Junho 2026</p>
          </div>
        </div>
        <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-100 p-0 shadow-md bg-white flex items-center justify-center shrink-0">
          <img src={logo} alt="Oportuniza" className="w-full h-full object-contain" />
        </div>
      </header>

      <motion.div 
        className="flex-1 overflow-y-auto px-5 py-6 space-y-7 custom-scroll"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.section variants={itemVariants} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-[10px] font-bold text-gray-800 uppercase tracking-[0.1em] font-mono">Compromisso de Confiança</h2>
          </div>
          <p className="text-[12px] text-gray-500 leading-[1.6] font-medium">
            Sua privacidade é o pilar da nossa relação. No Oportuniza, garantimos que seus dados sejam tratados com o máximo rigor de segurança e transparência.
          </p>
        </motion.section>

        <motion.div variants={itemVariants} className="space-y-6 px-1">
          <section>
            <h3 className="text-[13px] font-bold text-gray-900 flex items-center gap-2 mb-2.5">
              <span className="flex items-center justify-center w-5 h-5 bg-gray-900 text-white text-[10px] rounded-full font-mono">1</span>
              Coleta de Dados
            </h3>
            <p className="text-[11px] text-gray-500 leading-relaxed pl-7">
              Processamos apenas o necessário: informações de perfil (nome, e-mail), trajetórias profissionais e preferências para otimizar suas recomendações de carreira.
            </p>
          </section>

          <section>
            <h3 className="text-[13px] font-bold text-gray-900 flex items-center gap-2 mb-2.5">
              <span className="flex items-center justify-center w-5 h-5 bg-gray-900 text-white text-[10px] rounded-full font-mono">2</span>
              Uso e Compartilhamento
            </h3>
            <p className="text-[11px] text-gray-500 leading-relaxed pl-7">
              Seus dados nunca são vendidos. Eles são usados exclusivamente para conectar você a recrutadores e cursos, permitindo que a inteligência da plataforma trabalhe a seu favor.
            </p>
          </section>

          <section>
            <h3 className="text-[13px] font-bold text-gray-900 flex items-center gap-2 mb-2.5">
              <span className="flex items-center justify-center w-5 h-5 bg-gray-900 text-white text-[10px] rounded-full font-mono">3</span>
              Seus Direitos
            </h3>
            <p className="text-[11px] text-gray-500 leading-relaxed pl-7">
              Você tem total autonomia para acessar, corrigir ou solicitar a exclusão definitiva de seus dados a qualquer momento através do painel de configurações.
            </p>
          </section>
        </motion.div>

        <motion.section variants={itemVariants} className="p-5 bg-teal-50 rounded-2xl border border-teal-100 flex items-start gap-4">
          <div className="p-2.5 bg-white rounded-xl shadow-sm">
            <Lock className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <h4 className="text-[11px] font-bold text-teal-900 uppercase tracking-wide">Certificado LGPD</h4>
              <CheckCircle2 className="w-3 h-3 text-teal-600" />
            </div>
            <p className="text-[10px] text-teal-700/80 leading-relaxed font-medium">
              Operamos seguindo as diretrizes da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), implementando criptografia de ponta a ponta em todas as transações de perfil.
            </p>
          </div>
        </motion.section>

        <motion.div variants={itemVariants} className="text-center pt-4 pb-8">
          <p className="text-[10px] text-gray-400 font-medium">Dúvidas sobre seus dados?</p>
          <button className="mt-2 text-[10px] font-bold text-primary hover:underline cursor-pointer">
            contato@oportuniza.ai
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function TermsOfServiceScreen({ onBack }: LegalScreenProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1 }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white absolute inset-0 font-sans">
      <header className="px-5 pt-8 pb-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-gray-50 active:scale-95 transition-all text-gray-600 cursor-pointer border border-transparent hover:border-gray-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-bold text-gray-900 tracking-tight">Termos de Serviço</h1>
        </div>
        <div className="px-2.5 py-1 bg-gray-950 rounded-lg">
          <Scale className="w-3.5 h-3.5 text-white" />
        </div>
      </header>

      <motion.div 
        className="flex-1 overflow-y-auto px-6 py-8 space-y-8 custom-scroll"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="w-12 h-1 bg-primary/20 rounded-full" />
          <h2 className="text-lg font-bold text-gray-900 leading-tight">Ao usar o Oportuniza, você aceita estas diretrizes.</h2>
          <p className="text-[12px] text-gray-500 leading-relaxed">
            Estes termos regem seu acesso e uso da plataforma. Leia atentamente para entender seus deveres e o que oferecemos.
          </p>
        </motion.div>

        <motion.section variants={itemVariants} className="space-y-6">
          <div className="flex gap-4">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-mono text-[10px] font-bold text-gray-900 border border-gray-200">
              01
            </div>
            <div className="space-y-2">
              <h3 className="text-[13px] font-bold text-gray-900">Uso da Plataforma</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                O Oportuniza é destinado ao crescimento pessoal e profissional. O uso para fins comerciais não autorizados ou automação abusiva (bots) resultará em suspensão imediata.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-mono text-[10px] font-bold text-gray-900 border border-gray-200">
              02
            </div>
            <div className="space-y-2">
              <h3 className="text-[13px] font-bold text-gray-900">Veracidade de Dados</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                Você é responsável por manter seu currículo e competências atualizados e honestos. Perfis com informações falsas degradam a experiência de todos.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-mono text-[10px] font-bold text-gray-900 border border-gray-200">
              03
            </div>
            <div className="space-y-2">
              <h3 className="text-[13px] font-bold text-gray-900">Propriedade Intelectual</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                Todo conteúdo educacional, logos e algoritmos são de propriedade exclusiva do Oportuniza ou seus licenciadores autorizados.
              </p>
            </div>
          </div>
        </motion.section>

        <motion.div variants={itemVariants} className="p-5 rounded-2xl bg-amber-50/50 border border-amber-100 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold text-amber-900 uppercase">Limitação de Responsabilidade</h4>
            <p className="text-[10px] text-amber-700/80 leading-relaxed font-medium">
              Não garantimos a contratação imediata, pois o sucesso profissional depende também do empenho individual e da disponibilidade do mercado.
            </p>
          </div>
        </motion.div>

        <motion.footer variants={itemVariants} className="pt-6 pb-10 border-t border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest font-mono">Status</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-bold text-gray-900">Ativo</span>
              </div>
            </div>
            <div className="w-px h-6 bg-gray-100" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest font-mono">Região</span>
              <span className="text-[10px] font-bold text-gray-900 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Brasil
              </span>
            </div>
          </div>
          <Info className="w-5 h-5 text-gray-200" />
        </motion.footer>
      </motion.div>
    </div>
  );
}
