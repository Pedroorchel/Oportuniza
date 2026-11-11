import React, { useState } from 'react';
import { Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/toast';
import { validatePasswordStrength } from '../lib/securityValidation';
import { recordAuditLog } from '../lib/auditLogService';

interface ChangePasswordScreenProps {
  onBack: () => void;
  user?: any;
}

export default function ChangePasswordScreen({ onBack, user }: ChangePasswordScreenProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const strength = newPassword ? validatePasswordStrength(newPassword, user?.email) : null;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    const check = validatePasswordStrength(newPassword, user?.email);
    if (!check.isValid) {
      toast.error(check.error || 'Escolha uma senha mais forte (mín. 8 dígitos com letras e números).');
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      try {
        await recordAuditLog({
          actor_name: user?.name || 'Usuário',
          actor_email: user?.email || '',
          actor_role: user?.role || 'Candidato',
          action: 'Alteração de Senha',
          target_name: user?.email || 'Conta Oportuniza',
          target_type: 'security',
          details: 'Senha atualizada pelo usuário com requisitos fortes.',
          status: 'authorized'
        });
      } catch {}
      toast.success('Senha atualizada com segurança!');
      onBack();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar senha.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white p-6">
      <button onClick={onBack} className="flex items-center text-gray-500 mb-6 hover:text-indigo-600 cursor-pointer">
        <ArrowLeft className="w-5 h-5 mr-2" />
        Voltar
      </button>
      
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-50 text-indigo-500 rounded-[12px]">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Alterar Senha</h2>
          <p className="text-xs text-gray-500">Mínimo de 8 caracteres combinando letras e números</p>
        </div>
      </div>

      <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 dígitos (letras e números)"
              className="w-full pl-4 pr-10 py-3 rounded-[12px] border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {strength && (
            <div className="mt-2 space-y-1">
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-1.5 rounded-full transition-colors ${
                      strength.score >= step
                        ? strength.score >= 4
                          ? 'bg-emerald-500'
                          : strength.score === 3
                          ? 'bg-cyan-500'
                          : strength.score === 2
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] font-medium text-gray-500">
                Força: <strong className="text-gray-700">{strength.label}</strong>
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita a nova senha"
            className="w-full pl-4 pr-4 py-3 rounded-[12px] border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isUpdating || !newPassword || newPassword !== confirmPassword}
          className="w-full py-3 mt-4 rounded-[12px] bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:bg-gray-300 transition-all cursor-pointer"
        >
          {isUpdating ? 'Atualizando...' : 'Atualizar Senha'}
        </button>
      </form>
    </div>
  );
}
