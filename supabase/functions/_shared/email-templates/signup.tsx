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
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Sua biblioteca inteligente está a um clique de distância ✨</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandMark}>
          <Text style={brandText}>AuraRead</Text>
        </Section>

        <Heading style={h1}>Bem-vindo(a) ao {siteName}.</Heading>

        <Text style={lead}>
          A partir de hoje, cada leitura sua se transforma em conhecimento — organizado,
          revisitável e seu para sempre.
        </Text>

        <Text style={text}>
          Confirme seu e-mail para liberar o acesso e começar a construir sua biblioteca
          pessoal de ideias.
        </Text>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          <Button style={button} href={confirmationUrl}>
            Ativar minha conta
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={subtle}>
          Conta criada para{' '}
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          . Se não foi você,{' '}
          <Link href={siteUrl} style={link}>
            ignore esta mensagem
          </Link>
          — nada será criado.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const text = {
  fontSize: '15px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 8px',
}
const link = { color: '#1a8cff', textDecoration: 'none' }
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
