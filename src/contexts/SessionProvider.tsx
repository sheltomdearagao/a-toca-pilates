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

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const setData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, role') // Selecionando apenas as colunas necessárias
          .eq('id', session.user.id)
          .single();
        setProfile(profileData);
      }
      setIsLoading(false);
    };

    setData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, role') // Selecionando apenas as colunas necessárias
          .eq('id', session.user.id)
          .single();
        setProfile(profileData);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={{ session, profile, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);