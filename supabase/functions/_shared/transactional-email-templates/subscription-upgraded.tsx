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
  planName?: string
  appUrl?: string
}

const Email = ({
  name,
  planName = 'Premium',
  appUrl = 'https://auraread.store/library',
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo ao {planName}. Tudo liberado para você.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandMark}>
          <Text style={brandText}>AuraRead</Text>
        </Section>

        <Heading style={h1}>
          {name ? `${name}, ` : ''}seu acesso {planName} está ativo. ✨
        </Heading>

        <Text style={lead}>
          A partir de agora, sua biblioteca opera sem limites — destaques
          inteligentes, resumos com IA, exportações premium e muito mais.
        </Text>

        <Section style={card}>
          <Text style={cardTitle}>O que está liberado:</Text>
          <Text style={cardItem}>• Resumos e insights com IA ilimitados</Text>
          <Text style={cardItem}>• Exportação de destaques em PDF e Word</Text>
          <Text style={cardItem}>• Vídeos narrados a partir de qualquer trecho</Text>
          <Text style={cardItem}>• Biblioteca 3D, capas premium e estatísticas avançadas</Text>
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          <Button style={button} href={appUrl}>
            Explorar recursos premium
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={subtle}>
          Obrigado por investir na sua leitura. Estamos aqui para tornar cada
          página mais inteligente que a anterior.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Bem-vindo ao Premium ✨ Tudo liberado',
  displayName: 'Assinatura ativada',
  previewData: { name: 'Maria', planName: 'Premium' },
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
const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '0 0 8px',
}
const cardTitle = {
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#0f172a',
  margin: '0 0 12px',
}
const cardItem = {
  fontSize: '14px',
  color: '#475569',
  lineHeight: '1.7',
  margin: 0,
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
