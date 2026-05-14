import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Book, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/contexts/AuthContext";

const loginSchema = z.object({
  email: z.string().trim().min(1, "E-mail é obrigatório").email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(100),
});
const signupSchema = loginSchema.extend({
  fullName: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(100)
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Apenas letras"),
});
type LoginData = z.infer<typeof loginSchema>;

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AuthDialog = ({ open, onOpenChange }: AuthDialogProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [signup, setSignup] = useState({ fullName: "", email: "", password: "" });
  const { signIn, signUp } = useAuth();

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const onLogin = async (data: LoginData) => {
    setLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) toast.error(error.message || "Erro ao fazer login");
      else onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = signupSchema.safeParse(signup);
      if (!result.success) {
        toast.error(result.error.errors[0].message);
        return;
      }
      const { error } = await signUp(signup.email, signup.password, signup.fullName);
      if (error) toast.error(error.message || "Erro ao criar conta");
      else {
        toast.success("Conta criada! Verifique seu e-mail.");
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center mb-2">
            <div className="relative">
              <Book className="w-10 h-10 text-primary" />
              <Sparkles className="w-4 h-4 text-accent absolute -top-1 -right-1" />
            </div>
            <DialogTitle className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent text-2xl mt-2">
              AURA READ
            </DialogTitle>
            <DialogDescription>Entre ou crie sua conta</DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex gap-2 mb-2">
          <Button
            variant={isLogin ? "default" : "ghost"}
            className="flex-1"
            onClick={() => setIsLogin(true)}
            type="button"
          >
            Entrar
          </Button>
          <Button
            variant={!isLogin ? "default" : "ghost"}
            className="flex-1"
            onClick={() => setIsLogin(false)}
            type="button"
          >
            Cadastrar
          </Button>
        </div>

        {isLogin ? (
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <Input type="email" placeholder="seu@email.com" {...field} />
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
                    <Input type="password" placeholder="••••••••" {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-accent"
              >
                {loading ? "Processando..." : "Entrar"}
              </Button>
            </form>
          </Form>
        ) : (
          <form onSubmit={onSignup} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome completo</label>
              <Input
                placeholder="Seu nome"
                value={signup.fullName}
                onChange={(e) => setSignup({ ...signup, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">E-mail</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={signup.email}
                onChange={(e) => setSignup({ ...signup, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={signup.password}
                onChange={(e) => setSignup({ ...signup, password: e.target.value })}
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-accent"
            >
              {loading ? "Processando..." : "Criar conta"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
