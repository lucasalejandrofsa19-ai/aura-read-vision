import { SEO } from "@/components/SEO";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Lock, Database, Cookie, UserCheck, Mail, AlertCircle } from "lucide-react";

const APP_NAME = "AURA READ";
const APP_OWNER = "a equipe do AURA READ";
const CONTACT_EMAIL = "lucasalejandrosfa19@gmail.com";

const Trust = () => {
  return (
    <>
      <SEO
        title="Segurança e Privacidade — AURA READ"
        description="Como o AURA READ trata segurança, privacidade, dados pessoais e provedores que apoiam a plataforma."
        path="/trust"
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container max-w-4xl mx-auto px-4 lg:px-8 py-10 lg:py-16">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
          </Link>

          <header className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Central de Confiança</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-3">
              Segurança e Privacidade
            </h1>
            <p className="text-muted-foreground text-lg">
              Esta página é mantida por {APP_OWNER} para responder às perguntas mais comuns
              sobre segurança e privacidade no uso do {APP_NAME}.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Esta página descreve práticas e controles disponíveis na aplicação — não constitui
              certificação independente nem auditoria formal.
            </p>
          </header>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  Acesso e autenticação
                </CardTitle>
                <CardDescription>Como protegemos sua conta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Login por e-mail/senha e Google.</p>
                <p>• Sessões gerenciadas com tokens JWT e renovação automática.</p>
                <p>• Papéis de usuário (admin, premium) controlados em tabela dedicada com Row-Level Security.</p>
                <p>• Recuperação de senha por e-mail verificado.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Plataforma e hospedagem
                </CardTitle>
                <CardDescription>Onde a aplicação roda</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• A aplicação é hospedada na infraestrutura do Lovable Cloud.</p>
                <p>• Comunicação cliente-servidor protegida por HTTPS/TLS.</p>
                <p>
                  • Modelo de responsabilidade compartilhada: o Lovable Cloud provê a infraestrutura
                  e mecanismos de segurança (banco gerenciado, RLS, gestão de segredos); {APP_OWNER}
                  é responsável pelas regras de acesso, políticas e tratamento dos dados dentro da aplicação.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Dados que coletamos
                </CardTitle>
                <CardDescription>O que é armazenado e por quê</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Dados de cadastro: e-mail, nome, avatar (opcional).</p>
                <p>• Conteúdo carregado: PDFs e capas para leitura pessoal.</p>
                <p>• Progresso de leitura, destaques, notas e estatísticas de gamificação.</p>
                <p>• Logs operacionais (acessos a recursos premium, IP) para detecção de abuso.</p>
                <p>
                  • Todos os dados de usuário são protegidos por Row-Level Security: apenas o próprio
                  usuário (ou um admin autorizado) consegue acessá-los.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Provedores e integrações
                </CardTitle>
                <CardDescription>Serviços que apoiam o {APP_NAME}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• <strong>Lovable Cloud</strong> — banco de dados, autenticação, storage e funções.</p>
                <p>• <strong>Stripe</strong> — processamento de pagamentos de assinatura.</p>
                <p>• <strong>Google</strong> — login social (OAuth).</p>
                <p>• <strong>OpenAI / Lovable AI</strong> — geração de resumos, narração e imagens a partir de destaques.</p>
                <p>• <strong>Resend</strong> — envio de e-mails transacionais.</p>
                <p>• <strong>Sentry</strong> — monitoramento de erros da aplicação.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cookie className="h-5 w-5 text-primary" />
                  Cookies e analytics
                </CardTitle>
                <CardDescription>Como medimos uso da aplicação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Cookies essenciais para manter sua sessão autenticada.</p>
                <p>• Banner de consentimento para cookies não-essenciais.</p>
                <p>• Eventos de uso anônimos para melhorar a experiência (ex.: visualização de banners).</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  Retenção e exclusão
                </CardTitle>
                <CardDescription>Por quanto tempo guardamos seus dados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Dados de conta permanecem enquanto a conta estiver ativa.</p>
                <p>• Você pode solicitar exclusão da conta e dos arquivos enviados pelo e-mail abaixo.</p>
                <p>• Logs de segurança e auditoria podem ser retidos por período adicional para investigação de abuso.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Contato de segurança e privacidade
                </CardTitle>
                <CardDescription>Como falar conosco</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Para solicitações de privacidade, exclusão de dados ou reporte de vulnerabilidades,
                  entre em contato:
                </p>
                <p>
                  <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                  </a>
                </p>
                <p className="text-xs">
                  Reportes responsáveis de vulnerabilidades são bem-vindos. Por favor, evite acessar
                  dados de outros usuários e nos dê tempo razoável para corrigir antes de divulgar.
                </p>
              </CardContent>
            </Card>
          </div>

          <footer className="mt-10 text-xs text-muted-foreground text-center">
            Conteúdo desta página é mantido por {APP_OWNER} e pode ser atualizado a qualquer momento.
          </footer>
        </div>
      </div>
    </>
  );
};

export default Trust;
