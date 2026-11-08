import React from 'react';
import { ArrowLeft, Sparkles, HelpCircle, ChevronRight, MessageSquare } from 'lucide-react';
import { ScreenId } from '../types';

interface MessagesListScreenProps {
  onBack: () => void;
  onNavigate: (screen: ScreenId) => void;
}

export default function MessagesListScreen({ onBack, onNavigate }: MessagesListScreenProps) {
  return (
    <div className="w-full h-full flex flex-col bg-[#F9FAFB] absolute inset-0">
      <header className="px-5 pt-6 pb-4 bg-white border-b border-gray-100 flex items-center gap-3 shadow-sm shrink-0">
        <button
          onClick={onBack}
          className="p-1 px-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-transform text-gray-600 hover:text-gray-900 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[17px] font-bold text-gray-900 font-sans tracking-tight">
          Mensagens
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <div 
          onClick={() => onNavigate('mentor')}
          className="bg-white rounded-[20px] p-4 flex items-center justify-between shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[15px] text-gray-900 leading-tight">Mentor IA Carreira</span>
              <span className="text-[13px] text-gray-500 line-clamp-1 mt-0.5">Dúvidas sobre currículo e entrevistas</span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </div>

        <div 
          onClick={() => onNavigate('support')}
          className="bg-white rounded-[20px] p-4 flex items-center justify-between shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[15px] text-gray-900 leading-tight">Suporte Geral</span>
              <span className="text-[13px] text-gray-500 line-clamp-1 mt-0.5">Fale com um atendente humano</span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </div>
      </div>
    </div>
  );
}
