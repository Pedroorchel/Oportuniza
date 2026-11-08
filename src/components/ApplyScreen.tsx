import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, CheckCircle, UploadCloud, Link as LinkIcon, FileText, Loader2 } from 'lucide-react';
import { Job } from '../types';

interface ApplyScreenProps {
  job: Job;
  onBack: () => void;
  onApplyJob: (job: Job, cvInfo?: { link?: string, fileName?: string }) => Promise<boolean>;
  navigate: (screen: string) => void;
}

export default function ApplyScreen({ job, onBack, onApplyJob, navigate }: ApplyScreenProps) {
  const [cvLink, setCvLink] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent accidental file drag-and-drop from page navigation
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);

    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCvFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const validExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'];
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
      
      const isValidType = file.type.includes('pdf') || 
                          file.type.includes('word') || 
                          file.type.includes('msword') || 
                          file.type.includes('image/') || 
                          validExtensions.includes(fileExtension);
                          
      if (isValidType) {
        setCvFile(file);
      } else {
        alert('Formato de arquivo não suportado. Use PDF, DOCX ou Imagem.');
      }
    }
  };

  const getWhatsAppLink = () => {
    const phone = '5541996502358';
    const baseUrl = `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');
    const jobLink = `${baseUrl}/?job=${job.id}`;
    let text = `Olá! Gostaria de me candidatar para a vaga de *${job.title}* na empresa *${job.company}*.\n\n`;
    text += `*Link da Vaga:* ${jobLink}\n`;
    
    if (cvLink) {
      text += `*Link do meu Currículo:* ${cvLink}\n`;
    }
    
    if (cvFile) {
      text += `*Currículo Anexado:* ${cvFile.name}\n`;
    }
    
    return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
  };

  const handleConfirmApply = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const success = await onApplyJob(job, {
        link: cvLink.trim() || undefined,
        fileName: cvFile?.name || undefined
      });
      if (success) {
        setShowNotification(true);
        setTimeout(() => {
          setShowNotification(false);
          navigate('applications');
        }, 2000);
      }
    } catch (err) {
      console.error('Error submitting application:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppApply = async () => {
    // Also save application into platform before opening WhatsApp
    handleConfirmApply();
  };

  return (
    <div 
      className="w-full h-full flex flex-col bg-[#F9FAFB] overflow-y-auto custom-scroll relative"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {/* Header Back Button */}
      <div className="px-6 pt-8 pb-2 shrink-0">
        <button
          onClick={onBack}
          className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center text-[#085C77] hover:bg-gray-50 active:scale-95 transition-all outline-none"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Screen Title */}
      <h1 className="text-[34px] font-bold text-center text-[#041A38] tracking-tight mt-1 mb-8 shrink-0">
        Sua Candidatura
      </h1>

      <div className="px-6 flex flex-col gap-5 pb-24 shrink-0 w-full max-w-xl mx-auto">
        <div className="bg-white rounded-[24px] p-6 sm:p-8 shadow-sm flex flex-col gap-5 border border-gray-100">
          <div className="flex flex-col text-center border-b border-gray-100 pb-5">
            <div className="w-12 h-12 rounded-full border border-gray-100 flex items-center justify-center bg-white shadow-sm overflow-hidden mx-auto mb-3">
              <span className="text-[#E20015] font-bold text-base tracking-tighter uppercase">{job.company.substring(0, 5) || 'BOSCH'}</span>
            </div>
            <h2 className="text-[24px] font-bold text-gray-900 tracking-tight leading-tight">
              {job.title}
            </h2>
            <p className="text-base text-gray-500 mt-1">{job.company}</p>
          </div>

          <p className="text-sm text-gray-600 leading-snug">
            Para se candidatar, anexe seu currículo em arquivo ou insira um link válido para seu perfil LinkedIn / Portfólio.
          </p>

          <div className="flex flex-col gap-4 mt-2">
            {/* Option 1: File Upload Block with Drag and Drop Support */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-[20px] p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
                isDragging 
                  ? 'border-[#4EA8C7] bg-[#4EA8C7]/10 scale-[1.02] shadow-sm' 
                  : cvFile 
                    ? 'border-[#4EA8C7] bg-[#4EA8C7]/5' 
                    : 'border-gray-200 hover:border-[#4EA8C7] hover:bg-gray-50'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-[#4EA8C7]/10 flex items-center justify-center text-[#4EA8C7]">
                {cvFile ? <FileText className="w-6 h-6 text-[#52A8C7]" /> : <UploadCloud className="w-6 h-6" />}
              </div>
              <div className="text-center px-1 max-w-full">
                <p className="text-base font-bold text-gray-900 truncate">
                  {cvFile ? 'Arquivo selecionado!' : 'Carregar currículo'}
                </p>
                <p className="text-xs text-gray-500 truncate max-w-[240px] mt-0.5">
                  {cvFile ? cvFile.name : 'PDF, DOCX ou Imagem (Máx. 5MB)'}
                </p>
                {cvFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCvFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="mt-3 text-[11px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100/70 px-3 py-1 rounded-full transition-all outline-none"
                  >
                    Remover Arquivo
                  </button>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".pdf,.doc,.docx,image/*"
              />
            </div>

            <div className="flex items-center gap-3">
              <hr className="flex-1 border-gray-200" />
              <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Ou</span>
              <hr className="flex-1 border-gray-200" />
            </div>

            {/* Option 2: Link */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-700 ml-1">Link do currículo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <LinkIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={cvLink}
                  onChange={(e) => setCvLink(e.target.value)}
                  placeholder="https://linkedin.com/in/seu-perfil"
                  className="w-full outline-none bg-gray-50 border border-gray-200 rounded-[16px] py-3.5 pl-11 pr-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#4EA8C7] focus:ring-1 focus:ring-[#4EA8C7] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons Section */}
          <div className="flex flex-col gap-3 mt-3">
            {/* Primary Button: Enviar Candidatura */}
            <button 
              id="btn-submit-application"
              onClick={handleConfirmApply}
              disabled={isSubmitting}
              className="w-full bg-[#52A8C7] hover:bg-[#3d90ad] active:scale-[0.98] text-white font-bold py-4 rounded-[20px] text-base shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer border-b-2 border-[#3d90ad] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>Enviando candidatura...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 text-white" />
                  <span>Enviar Candidatura</span>
                </>
              )}
            </button>

            {/* Optional Companion Button: Enviar pelo WhatsApp */}
            <a 
              id="btn-whatsapp-application"
              href={getWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsAppApply}
              className="w-full bg-[#25D366] hover:bg-[#20ba56] active:scale-[0.98] text-white font-bold py-3.5 rounded-[20px] text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328.002 12.008 0c3.237.001 6.278 1.261 8.567 3.55a11.9 11.9 0 0 1 3.42 8.583c-.002 6.677-5.328 11.999-12.008 12.001-2.005-.001-3.98-.502-5.733-1.455L0 24zm6.59-4.846c1.62.963 3.485 1.47 5.402 1.471l.006-.002c5.347-.002 9.697-4.352 9.699-9.699a9.61 9.61 0 0 0-2.772-6.878A9.61 9.61 0 0 0 12.01 1.744c-5.348 0-9.699 4.35-9.702 9.698a9.67 9.67 0 0 0 1.42 5.01l-.998 3.64 3.731-.978l-.134-.142zm11.393-7.234c-.33-.165-1.951-.963-2.253-1.073-.302-.11-.522-.165-.741.165-.22.33-.852 1.073-1.042 1.293-.19.22-.382.247-.712.082a9.01 9.01 0 0 1-2.612-1.612c-.595-.531-1.002-1.189-1.119-1.387-.118-.198-.013-.305.085-.403.088-.088.196-.228.293-.341.1-.115.132-.196.198-.328.065-.132.032-.247-.016-.346-.048-.1-.422-1.018-.578-1.393-.153-.37-.308-.32-.421-.326l-.358-.007c-.123 0-.323.047-.492.23-.169.183-.646.632-.646 1.542 0 .91.662 1.789.754 1.91.092.122 1.303 1.99 3.157 2.793.44.191.784.305 1.052.39a2.53 2.53 0 0 0 1.16.073c.36-.053 1.104-.45 1.258-.885.153-.435.153-.808.107-.886-.046-.078-.17-.123-.5-.288z"/>
              </svg>
              <span>Enviar também pelo WhatsApp</span>
            </a>
          </div>
        </div>
      </div>

      {/* Success Notification Toast */}
      {showNotification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 min-w-max px-5 py-3.5 bg-[#4EA8C7] text-white rounded-2xl shadow-xl flex items-center gap-2.5 animate-bounce z-50">
          <CheckCircle className="w-5 h-5 text-white" />
          <span className="text-base font-bold tracking-tight">Candidatura enviada!</span>
        </div>
      )}
    </div>
  );
}
