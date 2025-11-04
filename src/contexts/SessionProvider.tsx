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
    // Não lançamos erro aqui, apenas retornamos null para não travar o SessionProvider
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

    const loadSession = async () => {
      // 1. Tenta obter a sessão persistida (do localStorage)
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      
      if (isMounted) {
        setSession(initialSession);
        
        if (initialSession) {
          try {
            // 2. Se houver sessão, busca o perfil
            const profileData = await getProfile(initialSession.user.id);
            setProfile(profileData);
          } catch (e) {
            console.error("Falha crítica ao carregar perfil:", e);
            // Se falhar, a sessão é mantida, mas o perfil é nulo.
            setProfile(null);
          }
        }
        
        // 3. Garante que o estado de carregamento seja resolvido
        setIsLoading(false); 
      }
    };

    loadSession();

    // 4. Configura o listener para mudanças futuras (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (isMounted) {
        setSession(currentSession);
        if (currentSession) {
          const profileData = await getProfile(currentSession.user.id);
          setProfile(profileData);
        } else {
          setProfile(null);
        }
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