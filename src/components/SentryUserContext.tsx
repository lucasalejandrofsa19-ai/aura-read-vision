import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { setUserContext } from "@/lib/sentry";

export const SentryUserContext = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  useEffect(() => {
    setUserContext(user ? { id: user.id, email: user.email } : null);
  }, [user]);

  return <>{children}</>;
};
