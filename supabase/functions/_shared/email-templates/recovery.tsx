/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Recupere o acesso à sua biblioteca em segundos</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandMark}>
          <Text style={brandText}>AuraRead</Text>
        </Section>

        <Heading style={h1}>Vamos restaurar seu acesso.</Heading>

        <Text style={lead}>
          Recebemos um pedido para redefinir a senha da sua conta no {siteName}.
          Defina uma nova chave e volte para onde parou.
        </Text>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          <Button style={button} href={confirmationUrl}>
            Criar nova senha
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={subtle}>
          Não foi você que pediu? Pode ignorar com tranquilidade — sua senha
          permanece intacta. O link expira em 1 hora por segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container = { padding: '40px 28px', maxWidth: '560px' }
const brandMark = { marginBottom: '32px' }
const brandText = {
  fontSize: '13px',
  fontWeight: '600' as const,
  color: '#1a8cff',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  margin: 0,
}
const h1 = {
  fontSize: '26px',
  fontWeight: '700' as const,
  color: '#0f172a',
  margin: '0 0 16px',
  lineHeight: '1.25',
  letterSpacing: '-0.02em',
}
const lead = {
  fontSize: '16px',
  color: '#334155',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const button = {
  backgroundColor: '#1a8cff',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e2e8f0', margin: '32px 0 20px' }
const subtle = { fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', margin: 0 }
