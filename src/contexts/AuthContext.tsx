import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";
import { fetchUserProfile, userProfileQueryKey } from "@/lib/userProfileQuery";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    let receivedAuthEvent = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        receivedAuthEvent = true;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      // If an auth event already arrived, it is authoritative — don't clobber
      // with this potentially stale snapshot (fixes rapid login/logout race).
      if (!receivedAuthEvent) {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/library`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      toast.success("Conta criada com sucesso! Você já está logado.");
      navigate("/welcome");
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Login realizado com sucesso!");

      // Prefetch profile to decide landing, but never fail the login if
      // the profile fetch itself errors (network/RLS hiccup) — auth already
      // succeeded and the onAuthStateChange listener is authoritative.
      let profile: Awaited<ReturnType<typeof fetchUserProfile>> | null = null;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          profile = await queryClient.fetchQuery({
            queryKey: userProfileQueryKey(authUser.id),
            queryFn: () => fetchUserProfile(authUser.id),
          });
        }
      } catch (profileError) {
        captureError(profileError as Error, { context: "signIn.profilePrefetch" });
      }

      if (profile && !profile.has_seen_welcome) {
        navigate("/welcome");
      } else {
        navigate("/library");
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        signUp,
        signIn,
        signOut,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
