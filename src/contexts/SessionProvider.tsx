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
    const fetchSessionAndProfile = async () => {
      // 1. Tenta obter a sessão ativa. Isso lê do localStorage.
      const { data: { session: activeSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Erro ao obter sessão:", error);
        setIsLoading(false);
        return;
      }

      setSession(activeSession);

      let profileData: Profile | null = null;
      if (activeSession?.user) {
        try {
          profileData = await getProfile(activeSession.user.id);
        } catch (e) {
          console.error("Falha ao carregar perfil inicial:", e);
        }
      }
      setProfile(profileData);
      
      // 2. Marca o carregamento inicial como concluído.
      setIsLoading(false);
    };

    fetchSessionAndProfile();

    // 3. Ouve por mudanças no estado de autenticação (login, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      
      let profileData: Profile | null = null;
      if (newSession?.user) {
        try {
          profileData = await getProfile(newSession.user.id);
        } catch (e) {
          console.error("Falha ao carregar perfil na mudança de auth:", e);
        }
      }
      setProfile(profileData);
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