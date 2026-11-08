import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { toast, ToastMessage } from '../lib/toast';

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return toast.subscribe((newToasts) => {
      setToasts(newToasts);
    });
  }, []);

  const getToastStyles = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/80 dark:border-emerald-900/60',
          text: 'text-emerald-800 dark:text-emerald-200',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
          accentBar: 'bg-emerald-500'
        };
      case 'error':
        return {
          bg: 'bg-rose-50 border-rose-100 dark:bg-rose-950/80 dark:border-rose-900/60',
          text: 'text-rose-800 dark:text-rose-200',
          icon: <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />,
          accentBar: 'bg-rose-500'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-100 dark:bg-amber-950/80 dark:border-amber-900/60',
          text: 'text-amber-800 dark:text-amber-200',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
          accentBar: 'bg-amber-500'
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50 border-blue-100 dark:bg-slate-900 dark:border-slate-800',
          text: 'text-blue-800 dark:text-sky-200',
          icon: <Info className="w-5 h-5 text-blue-600 dark:text-sky-400 shrink-0" />,
          accentBar: 'bg-blue-500'
        };
    }
  };

  return (
    <div 
      id="toast-container" 
      className="fixed top-4 right-4 z-[99999] flex flex-col gap-3 w-full max-w-sm pointer-events-none p-4"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((item) => {
          const styles = getToastStyles(item.type);
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all ${styles.bg}`}
            >
              {/* Colored Side Accent Bar */}
              <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${styles.accentBar}`} />

              <div className="pl-1 shrink-0 mt-0.5">
                {styles.icon}
              </div>

              <div className="flex-1 pr-4">
                <p className={`text-sm font-medium leading-relaxed ${styles.text}`}>
                  {item.message}
                </p>
              </div>

              <button
                onClick={() => toast.dismiss(item.id)}
                className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors rounded-lg p-0.5 mt-0.5"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
