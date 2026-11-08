import { ArrowLeft, Rocket, Goal, CheckCircle } from 'lucide-react';
import { ScreenId } from '../types';
const logo = 'https://www.image2url.com/r2/default/images/1781824138816-3fd9702f-4521-41d2-8411-d8fc61114350.png';

interface BioScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export default function BioScreen({ onNavigate }: BioScreenProps) {
  return (
    <div className="w-full h-full overflow-y-auto custom-scroll px-6 py-6 bg-gradient-to-b from-[#eef7ff] to-white relative pb-10">
      {/* Header with back icon */}
      <header className="flex justify-between items-center mb-6">
        <button
          onClick={() => onNavigate('landing')}
          className="p-2.5 rounded-full bg-white hover:bg-gray-100 transition-colors shadow-sm text-gray-700 cursor-pointer"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-bold text-primary font-mono tracking-wider bg-primary/10 px-3 py-1 rounded-full">
          SAIBA MAIS
        </span>
      </header>

      {/* Brand representation */}
      <div className="flex flex-col items-center text-center gap-3.5 mb-8 animate-fadeIn">
        <div className="w-[195px] h-[195px] rounded-3xl bg-white flex items-center justify-center shadow-[0_12px_36px_rgba(0,0,0,0.08)] overflow-hidden">
          <img src={logo} alt="Oportuniza Logo" className="w-full h-full object-cover object-center block" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight font-sans">
            Solução Oportuniza
          </h1>
          <p className="text-xs text-gray-500 max-w-xs mt-1">
            Conectando jovens talentos e profissionais com vagas de impacto, treinamentos práticos e orientação de carreira inteligente.
          </p>
        </div>
      </div>

      {/* Narrative cards */}
      <div className="flex flex-col gap-5">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-1.5 h-4 rounded-full bg-primary inline-block" />
            Quem Somos
          </h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            O Oportuniza nasceu no coração de cientistas de dados e especialistas em recursos humanos com a missão única de transformar e simplificar a busca por empregos direcionados na América Latina. Entendemos que diplomas nem sempre contam a história completa, por isso inovamos em capacitações de curto prazo integradas.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Goal className="w-4 h-4 text-brand-purple" />
            Nossa Missão
          </h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Nós acreditamos na igualdade de oportunidades. Facilitamos conexões legítimas sem barreiras, fornecendo orientação vocacional e apoio personalizado aos candidatos por meio de inteligência computacional acessível a todos em seus smartphones.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
          <h2 className="text-sm font-bold text-gray-800">
            Diferenciais Oportuniza
          </h2>
          <ul className="flex flex-col gap-2">
            <li className="flex items-start gap-2.5 text-xs text-gray-600">
              <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Perfil Inteligente:</strong> seu currículo preenchido em minutos vira uma sugestão automatizada de vagas nacionais e regionais.
              </span>
            </li>
            <li className="flex items-start gap-2.5 text-xs text-gray-600">
              <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Minicursos Focados:</strong> capacitações em Excel, Soft Skills e CV prático com conquistas reconhecidas.
              </span>
            </li>
            <li className="flex items-start gap-2.5 text-xs text-gray-600">
              <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Orientação 24/7 com Mentor IA:</strong> um consultor virtual pronto no seu chat de mensagens para avaliar respostas e currículos.
              </span>
            </li>
          </ul>
        </div>

        {/* Closing Action */}
        <div className="pt-2">
          <button
            onClick={() => onNavigate('login')}
            className="w-full btn-primary select-none"
          >
            Abrir Aplicativo & Acessar
          </button>
        </div>
      </div>
    </div>
  );
}
