-- Adicionar campo para rastrear se o usuário já viu o tour da biblioteca
ALTER TABLE public.profiles
ADD COLUMN has_seen_library_tour boolean DEFAULT false NOT NULL;