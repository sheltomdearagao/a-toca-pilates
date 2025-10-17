import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';
// import { Dumbbell } from 'lucide-react'; // Ícone removido

const Login = () => {
  const { session } = useSession();

  if (session) {
    return <Navigate to="/" replace />;
  }

  const logoUrl = "https://nkwsvsmmzvukdghlyxpm.supabase.co/storage/v1/object/public/app-assets/atocalogo.png";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary">
      <div className="w-full max-w-md p-8 space-y-8">
        <div className="flex flex-col items-center">
          {/* Removido o div com o frame, a imagem agora está diretamente no flex container */}
          <img src={logoUrl} alt="A Toca Pilates Logo" className="w-24 h-24 object-contain" />
          <h1 className="mt-6 text-3xl font-bold text-center text-foreground">
            A Toca Pilates
          </h1>
        </div>
        <div className="p-8 bg-card rounded-2xl shadow-impressionist border border-border shadow-subtle-glow">
          <Auth
            supabaseClient={supabase}
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(var(--primary))',
                    brandAccent: 'hsl(var(--accent))',
                  }
                }
              }
            }}
            providers={[]}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Seu email',
                  password_label: 'Sua senha',
                  button_label: 'Entrar',
                  loading_button_label: 'Entrando...',
                  social_provider_text: 'Entrar com {{provider}}',
                },
                sign_up: {
                  email_label: 'Seu email',
                  password_label: 'Sua senha',
                  button_label: 'Registrar',
                  loading_button_label: 'Registrando...',
                },
                forgotten_password: {
                  email_label: 'Seu email',
                  button_label: 'Enviar instruções',
                  loading_button_label: 'Enviando...',
                  link_text: 'Esqueceu sua senha?',
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Login;