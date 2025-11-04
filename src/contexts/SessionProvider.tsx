import { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import React from 'react';

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
};

type SessionContextType = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
};

const SessionContext = createContext<SessionContextType>({
  session: null,
  profile: null,
  isLoading: true,
});

const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data: profileData, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .single();
    
  if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found (perfil não existe)
    console.error("Erro ao buscar perfil:", error);
    return null;
  }
  
  return profileData;
};

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      if (!isMounted) return;

      setSession(currentSession);
      
      let profileData: Profile | null = null;
      if (currentSession) {
        try {
          profileData = await getProfile(currentSession.user.id);
        } catch (e) {
          console.error("Falha ao carregar perfil durante a mudança de estado:", e);
        }
      }
      setProfile(profileData);

      // O evento INITIAL_SESSION é disparado assim que o Supabase lê o token do storage.
      // Este é o momento ideal para resolver o estado de carregamento.
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setIsLoading(false);
      }
    };

    // 1. Configura o listener para todas as mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // 2. Tenta obter a sessão imediatamente (para o caso de o listener demorar a disparar)
    // Embora o listener deva disparar 'INITIAL_SESSION', esta chamada garante que o estado inicial seja capturado.
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
        if (isMounted && isLoading) { // Se ainda estiver carregando, resolve o estado
            handleAuthChange('INITIAL_SESSION', initialSession);
        }
    });


    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={{ session, profile, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);