import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
  subscriptionTier: string;
  checkSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState("free");
  const navigate = useNavigate();

  const checkSubscription = async () => {
    if (!session?.user) return;
    
    // Verificar cache primeiro (5 minutos)
    const cacheKey = `subscription_${session.user.id}`;
    const cachedData = sessionStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        const { tier, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        
        // Se cache é válido (menos de 5 minutos)
        if (now - timestamp < 5 * 60 * 1000) {
          setSubscriptionTier(tier);
          return;
        }
      } catch (e) {
        // Ignorar erro de parse
      }
    }
    
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!error && data) {
        const tier = data.tier || "free";
        setSubscriptionTier(tier);
        
        // Salvar no cache
        sessionStorage.setItem(cacheKey, JSON.stringify({
          tier,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      captureError(error, { context: "check_subscription" });
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user && event === 'SIGNED_IN') {
          checkSubscription();
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        checkSubscription();
      }
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

      // Check if user has seen welcome page
      const { data: profile } = await supabase
        .from("profiles")
        .select("has_seen_welcome")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      toast.success("Login realizado com sucesso!");
      
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
    setSubscriptionTier("free");
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
        subscriptionTier,
        checkSubscription,
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
