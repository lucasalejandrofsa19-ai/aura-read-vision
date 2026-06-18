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
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  endsAt?: string
  pricingUrl?: string
}

const Email = ({
  name,
  endsAt,
  pricingUrl = 'https://auraread.store/pricing',
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Tudo bem — sua biblioteca continua com você</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandMark}>
          <Text style={brandText}>AuraRead</Text>
        </Section>

        <Heading style={h1}>
          {name ? `${name}, ` : ''}fica para a próxima.
        </Heading>

        <Text style={lead}>
          Confirmamos o cancelamento da sua assinatura Premium. Sua biblioteca,
          destaques e progresso permanecem salvos — nada se perde.
        </Text>

        {endsAt && (
          <Section style={card}>
            <Text style={cardTitle}>Acesso premium até</Text>
            <Text style={cardValue}>{endsAt}</Text>
            <Text style={cardSub}>
              Você continua aproveitando todos os recursos até essa data.
            </Text>
          </Section>
        )}

        <Text style={text}>
          Quando quiser voltar a ler com IA, exportar destaques ou desbloquear
          a biblioteca 3D, estaremos aqui — basta um clique.
        </Text>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          <Button style={button} href={pricingUrl}>
            Reativar quando quiser
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={subtle}>
          Obrigado por fazer parte do AuraRead. Boas leituras — sempre.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Confirmação de cancelamento',
  displayName: 'Assinatura cancelada',
  previewData: { name: 'Maria', endsAt: '30 de junho de 2026' },
} satisfies TemplateEntry

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
  margin: '0 0 24px',
}
const text = {
  fontSize: '15px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 8px',
}
const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '0 0 24px',
}
const cardTitle = {
  fontSize: '12px',
  fontWeight: '600' as const,
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0 0 6px',
}
const cardValue = {
  fontSize: '18px',
  fontWeight: '600' as const,
  color: '#0f172a',
  margin: '0 0 6px',
}
const cardSub = { fontSize: '13px', color: '#64748b', margin: 0 }
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
