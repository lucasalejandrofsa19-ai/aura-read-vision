-- Criar tabela para livros premium compartilhados
CREATE TABLE IF NOT EXISTS public.premium_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT,
  cover_color TEXT DEFAULT 'from-purple-500 to-purple-700',
  file_path TEXT NOT NULL,
  file_size INTEGER,
  total_pages INTEGER,
  summary TEXT,
  extracted_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.premium_books ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins podem inserir/atualizar/deletar livros premium
CREATE POLICY "Admins can manage premium books"
ON public.premium_books
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Política: Usuários premium podem visualizar livros premium
CREATE POLICY "Premium users can view premium books"
ON public.premium_books
FOR SELECT
USING (public.has_premium_access(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_premium_books_updated_at
BEFORE UPDATE ON public.premium_books
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Criar bucket para livros premium se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('premium-pdfs', 'premium-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- RLS para storage de livros premium
CREATE POLICY "Admins can upload premium PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'premium-pdfs' AND
  public.is_admin(auth.uid())
);

CREATE POLICY "Premium users can download premium PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'premium-pdfs' AND
  public.has_premium_access(auth.uid())
);

CREATE POLICY "Admins can delete premium PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'premium-pdfs' AND
  public.is_admin(auth.uid())
);