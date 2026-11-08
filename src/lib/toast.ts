export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

type ToastListener = (toasts: ToastMessage[]) => void;
let listeners: ToastListener[] = [];
let toasts: ToastMessage[] = [];

export const toast = {
  subscribe(listener: ToastListener) {
    listeners.push(listener);
    listener([...toasts]);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },
  show(message: string, type: ToastMessage['type'] = 'info', duration = 4000) {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, message, type, duration };
    toasts = [...toasts, newToast];
    listeners.forEach(l => l([...toasts]));

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
  },
  success(message: string, duration?: number) {
    this.show(message, 'success', duration);
  },
  error(message: string, duration?: number) {
    this.show(message, 'error', duration);
  },
  info(message: string, duration?: number) {
    this.show(message, 'info', duration);
  },
  warning(message: string, duration?: number) {
    this.show(message, 'warning', duration);
  },
  dismiss(id: string) {
    toasts = toasts.filter(t => t.id !== id);
    listeners.forEach(l => l([...toasts]));
  }
};
