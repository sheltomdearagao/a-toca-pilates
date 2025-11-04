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
    // O listener dispara um evento 'INITIAL_SESSION' (ou 'SIGNED_IN' se redirecionado do login)
    // que é o momento perfeito para definir o estado de carregamento como falso.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      
      let profileData: Profile | null = null;
      if (session?.user) {
        try {
          profileData = await getProfile(session.user.id);
        } catch (e) {
          console.error("Falha ao carregar perfil:", e);
        }
      }
      setProfile(profileData);
      
      // O estado de carregamento é definido como falso assim que a sessão inicial é carregada.
      // Isso lida corretamente com o cenário de atualização da página.
      setIsLoading(false);
    });

    return () => {
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