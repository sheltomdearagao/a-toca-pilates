import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';
import { Dumbbell } from 'lucide-react';

const Login = () => {
  const { session } = useSession();

  if (session) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary"> {/* Fundo com gradiente suave */}
      <div className="w-full max-w-md p-8 space-y-8">
        <div className="flex flex-col items-center">
          <Dumbbell className="w-12 h-12 text-primary" /> {/* Usando a nova cor primary */}
          <h1 className="mt-4 text-3xl font-bold text-center text-foreground">
            A Toca Experience Platform
          </h1>
        </div>
        <div className="p-8 bg-card rounded-lg shadow-impressionist border border-border"> {/* Sombra mais suave e borda sutil */}
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
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