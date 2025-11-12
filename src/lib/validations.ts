import { z } from "zod";

// Authentication schemas
export const authLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Email inválido" })
    .max(255, { message: "Email muito longo (máximo 255 caracteres)" }),
  password: z
    .string()
    .min(6, { message: "Senha deve ter no mínimo 6 caracteres" })
    .max(128, { message: "Senha muito longa (máximo 128 caracteres)" }),
});

export const authSignupSchema = authLoginSchema.extend({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Nome deve ter no mínimo 2 caracteres" })
    .max(100, { message: "Nome muito longo (máximo 100 caracteres)" })
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, { 
      message: "Nome contém caracteres inválidos" 
    }),
});

// Book/PDF upload schemas
export const pdfUploadSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, { message: "Nome do arquivo é obrigatório" })
    .max(255, { message: "Nome do arquivo muito longo" })
    .regex(/^[^<>:"/\\|?*\x00-\x1f]+$/, {
      message: "Nome do arquivo contém caracteres inválidos",
    }),
  fileSize: z
    .number()
    .min(1, { message: "Arquivo vazio" })
    .max(52428800, { message: "Arquivo muito grande (máximo 50MB)" }),
  fileType: z
    .string()
    .refine((type) => type === "application/pdf", {
      message: "Apenas arquivos PDF são permitidos",
    }),
});

export const bookTitleSchema = z
  .string()
  .trim()
  .min(1, { message: "Título é obrigatório" })
  .max(255, { message: "Título muito longo (máximo 255 caracteres)" })
  .regex(/^[^<>{}]*$/, {
    message: "Título contém caracteres inválidos",
  });

// Edge function input schemas
export const checkoutInputSchema = z.object({
  priceId: z
    .string()
    .trim()
    .min(1, { message: "Price ID é obrigatório" })
    .regex(/^price_[a-zA-Z0-9]+$/, {
      message: "Price ID inválido",
    }),
});

export const processPdfInputSchema = z.object({
  bookId: z
    .string()
    .trim()
    .uuid({ message: "Book ID inválido" }),
  filePath: z
    .string()
    .trim()
    .min(1, { message: "File path é obrigatório" })
    .max(1024, { message: "File path muito longo" })
    .regex(/^[a-zA-Z0-9\/_\-\.]+$/, {
      message: "File path contém caracteres inválidos",
    }),
});

// Highlight text schema
export const highlightTextSchema = z
  .string()
  .trim()
  .min(1, { message: "Texto de destaque é obrigatório" })
  .max(5000, { message: "Texto muito longo (máximo 5000 caracteres)" });

// Helper function to safely validate and return errors
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T; errors?: never } | { success: false; data?: never; errors: string[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((e) => e.message),
      };
    }
    return {
      success: false,
      errors: ["Erro de validação desconhecido"],
    };
  }
}
