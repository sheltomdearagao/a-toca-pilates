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
    
  if (error && error.code !== 'PGRST116') {
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
    // Este efeito lida exclusivamente com a sessão e o estado de carregamento.
    const fetchInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setIsLoading(false); // Finaliza o carregamento assim que a sessão é verificada.
    };

    fetchInitialSession();

    // Ouve por mudanças futuras (login/logout).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Este efeito busca o perfil sempre que a sessão mudar.
    // Ele não afeta mais o estado de 'isLoading'.
    if (session?.user) {
      getProfile(session.user.id)
        .then(profileData => setProfile(profileData))
        .catch(e => {
          console.error("Falha ao carregar perfil:", e);
          setProfile(null);
        });
    } else {
      setProfile(null); // Limpa o perfil se não houver sessão.
    }
  }, [session]); // Depende apenas da sessão.

  return (
    <SessionContext.Provider value={{ session, profile, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);