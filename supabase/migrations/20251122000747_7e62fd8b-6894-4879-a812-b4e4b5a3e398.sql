-- Adicionar campo para rastrear se o usuário já viu a página de boas-vindas
ALTER TABLE public.profiles
ADD COLUMN has_seen_welcome boolean DEFAULT false NOT NULL;