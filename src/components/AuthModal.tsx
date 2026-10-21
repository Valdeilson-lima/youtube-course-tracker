import React, { useState } from 'react';
import {
  getSupabaseClient,
  loadSupabaseConfig,
  saveSupabaseConfig,
  resetSupabaseClient,
  SUPABASE_SQL_SCHEMA,
  SupabaseConfig,
} from '../services/supabase';
import { User } from '@supabase/supabase-js';
import {
  X,
  Cloud,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Copy,
  Check,
  Settings,
  Database,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onAuthSuccess: (user: User | null) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  user,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'config'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Supabase keys config
  const [config, setConfig] = useState<SupabaseConfig>(() => loadSupabaseConfig());

  if (!isOpen) return null;

  const client = getSupabaseClient();
  const isConfigured = Boolean(config.url && config.anonKey);

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.url || !config.anonKey) {
      setErrorMsg('Preencha a URL e a Anon Key do Supabase.');
      return;
    }
    saveSupabaseConfig(config);
    resetSupabaseClient();
    setSuccessMsg('Configuração do Supabase salva com sucesso!');
    setTimeout(() => {
      setSuccessMsg(null);
      setMode('signin');
    }, 1000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setMode('config');
      setErrorMsg('Configure a URL e a Anon Key do Supabase primeiro.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          setSuccessMsg(
            data.session
              ? 'Conta criada e logada com sucesso!'
              : 'Conta criada! Verifique seu e-mail de confirmação ou faça login.'
          );
          if (data.session) {
            onAuthSuccess(data.user);
            setTimeout(onClose, 800);
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          setSuccessMsg('Login realizado com sucesso!');
          onAuthSuccess(data.user);
          setTimeout(onClose, 600);
        }
      }
    } catch (err: any) {
      const rawMsg = String(err?.message || '');
      const lower = rawMsg.toLowerCase();

      if (lower.includes('rate limit')) {
        setErrorMsg(
          'Limite de envio de e-mails do Supabase atingido (máx. 3-4 por hora no plano gratuito). Solução: Desative a opção "Confirm email" no painel do Supabase (Authentication > Providers > Email) para cadastrar sem restrições.'
        );
      } else if (lower.includes('already registered')) {
        setErrorMsg('Este e-mail já possui uma conta cadastrada. Alterne para a aba "Entrar" acima para fazer login.');
      } else if (lower.includes('invalid login credentials')) {
        setErrorMsg('E-mail ou senha incorretos. Verifique suas credenciais.');
      } else if (lower.includes('at least 6 characters')) {
        setErrorMsg('A senha precisa ter no mínimo 6 caracteres.');
      } else {
        setErrorMsg(err.message || 'Erro durante a autenticação.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    onAuthSuccess(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Cloud className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Sincronização na Nuvem</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">Acesse seus cursos no celular e no computador</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If already logged in */}
        {user ? (
          <div className="p-6 space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs text-emerald-300 font-semibold">Conectado na nuvem</p>
                <p className="text-sm font-bold text-white">{user.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Seus cursos, progresso e anotações estão sendo salvos e sincronizados automaticamente na nuvem do Supabase.
            </p>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setMode('config')}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configurar Chaves Supabase</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-semibold transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Desconectar</span>
              </button>
            </div>
          </div>
        ) : mode === 'config' ? (
          /* Supabase Keys Setup */
          <form onSubmit={handleSaveConfig} className="p-6 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Credenciais do Supabase
              </h4>
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-xs text-emerald-400 hover:underline"
              >
                Voltar ao Login
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Project URL (Supabase)
              </label>
              <input
                type="text"
                placeholder="https://xyzcompany.supabase.co"
                value={config.url}
                onChange={(e) => setConfig({ ...config, url: e.target.value.trim() })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Anon / Public API Key
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={config.anonKey}
                onChange={(e) => setConfig({ ...config, anonKey: e.target.value.trim() })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* SQL Copy Box */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-400">
                  Script SQL para criar as tabelas:
                </span>
                <button
                  type="button"
                  onClick={handleCopySchema}
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  {copiedSchema ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSchema ? 'Copiado!' : 'Copiar SQL'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Copie e cole este script na aba "SQL Editor" do seu painel Supabase para criar as tabelas e permissões de segurança em 1 segundo.
              </p>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition"
              >
                Salvar Credenciais
              </button>
            </div>
          </form>
        ) : (
          /* Sign In / Sign Up Form */
          <form onSubmit={handleAuth} className="p-6 space-y-4">
            {/* Mode Switcher */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  mode === 'signin' ? 'bg-slate-800 text-white shadow' : 'text-slate-400'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  mode === 'signup' ? 'bg-slate-800 text-white shadow' : 'text-slate-400'
                }`}
              >
                Criar Conta
              </button>
            </div>

            {!isConfigured && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Supabase não configurado</p>
                  <button
                    type="button"
                    onClick={() => setMode('config')}
                    className="underline text-amber-200 mt-0.5 block"
                  >
                    Clique aqui para inserir suas chaves do Supabase
                  </button>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Conectando...</span>
                </>
              ) : (
                <span>{mode === 'signup' ? 'Cadastrar e Sincronizar' : 'Entrar e Sincronizar'}</span>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setMode('config')}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition"
              >
                ⚙️ Configurar chaves do Supabase
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
