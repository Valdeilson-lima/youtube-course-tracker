import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface OfflineBannerProps {
  onReconnected?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onReconnected }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const toast = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Conexão Restabelecida! 🌐', 'Você está online novamente. Sincronizando dados...');
      onReconnected?.();
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.info('Modo Offline 📡', 'Sem conexão com a internet. Suas ações continuam salvas localmente.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, onReconnected]);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-600/95 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md sticky top-0 z-50 animate-fade-in backdrop-blur-md">
      <WifiOff className="w-4 h-4 text-slate-950 shrink-0 animate-pulse" />
      <span>
        Você está navegando offline. O app continua funcionando e tudo será sincronizado com a nuvem ao reconectar.
      </span>
    </div>
  );
};
