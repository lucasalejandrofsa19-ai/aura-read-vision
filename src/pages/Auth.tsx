import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Book, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Login validation schema
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "E-mail é obrigatório")
    .email("E-mail inválido")
    .max(255, "E-mail deve ter no máximo 255 caracteres"),
  password: z
    .string()
    .min(6, "Senha deve ter no mínimo 6 caracteres")
    .max(100, "Senha deve ter no máximo 100 caracteres"),
});

// Signup validation schema
const signupSchema = loginSchema.extend({
  fullName: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome deve conter apenas letras"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();

  // Signup state without react-hook-form
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user) {
      navigate("/library");
    }
  }, [user, navigate]);

  const onSubmitLogin = async (data: LoginFormData) => {
    setLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        toast.error(error.message || "Erro ao fazer login");
      }
    } catch (error) {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = signupSchema.safeParse(signupData);
      if (!result.success) {
        const firstError = result.error.errors[0];
        toast.error(firstError.message);
        setLoading(false);
        return;
      }
      
      const { error } = await signUp(signupData.email, signupData.password, signupData.fullName);
      if (error) {
        toast.error(error.message || "Erro ao criar conta");
      }
    } catch (error) {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden touch-pan-y">
      {/* Animated background elements - Fixed to prevent layout shifts */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-10 left-10 sm:top-20 sm:left-20 w-48 h-48 sm:w-64 sm:h-64 bg-primary/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-10 right-10 sm:bottom-20 sm:right-20 w-64 h-64 sm:w-96 sm:h-96 bg-accent/10 rounded-full blur-3xl"
          animate={{
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10 mx-auto"
      >
        {/* Logo */}
        <motion.div
          className="flex flex-col items-center mb-6 sm:mb-8"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.div
            className="relative"
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="relative">
              <Book className="w-12 h-12 sm:w-16 sm:h-16 text-primary mb-2 aura-safira" />
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-accent absolute -top-1 -right-1" />
            </div>
          </motion.div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            AURA READ
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 text-center">
            Sua biblioteca pessoal interativa
          </p>
        </motion.div>

        {/* Auth form */}
        <motion.div
          className="glass rounded-2xl p-4 sm:p-6 md:p-8 aura-soft"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex gap-4 mb-6">
            <Button
              variant={isLogin ? "default" : "ghost"}
              className="flex-1"
              onClick={() => setIsLogin(true)}
            >
              Entrar
            </Button>
            <Button
              variant={!isLogin ? "default" : "ghost"}
              className="flex-1"
              onClick={() => setIsLogin(false)}
            >
              Cadastrar
            </Button>
          </div>

          {isLogin ? (
            <Form {...loginForm}>
              <form 
                onSubmit={loginForm.handleSubmit(onSubmitLogin)} 
                className="space-y-4"
              >
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        className="glass border-primary/20 focus:border-primary"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="glass border-primary/20 focus:border-primary"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity aura-safira"
                >
                  {loading ? "Processando..." : "Entrar"}
                </Button>
              </form>
            </Form>
          ) : (
            <form 
              onSubmit={onSubmitSignup} 
              className="space-y-4"
            >
              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium leading-none">
                  Nome Completo
                </label>
                <Input
                  id="fullName"
                  placeholder="Seu nome completo"
                  className="glass border-primary/20 focus:border-primary"
                  value={signupData.fullName}
                  onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="signup-email" className="text-sm font-medium leading-none">
                  E-mail
                </label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="seu@email.com"
                  className="glass border-primary/20 focus:border-primary"
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="signup-password" className="text-sm font-medium leading-none">
                  Senha
                </label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  className="glass border-primary/20 focus:border-primary"
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity aura-safira"
              >
                {loading ? "Processando..." : "Criar Conta"}
              </Button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Auth;
