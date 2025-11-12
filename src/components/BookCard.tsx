import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";

interface Book {
  id: string;
  title: string;
  author: string;
  cover_color: string;
  progress: number;
  file_path: string;
}

interface BookCardProps {
  book: Book;
  index: number;
  onDelete?: () => void;
}

const BookCard = ({ book, index, onDelete }: BookCardProps) => {
  const navigate = useNavigate();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Deseja realmente deletar este livro?")) return;

    try {
      // Delete file from storage
      if (book.file_path) {
        const { error: storageError } = await supabase.storage
          .from("pdfs")
          .remove([book.file_path]);
        
        if (storageError) captureError(storageError, "Storage file deletion");
      }

      // Delete book record
      const { error } = await supabase
        .from("books")
        .delete()
        .eq("id", book.id);

      if (error) throw error;

      toast.success("Livro deletado com sucesso!");
      onDelete?.();
    } catch (error) {
      captureError(error, "Book deletion");
      toast.error("Erro ao deletar livro");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -8 }}
      onClick={() => navigate(`/reader/${book.id}`)}
      className="glass rounded-xl overflow-hidden cursor-pointer group transition-aura hover:aura-safira"
    >
      {/* Book cover */}
      <div className={`relative h-64 bg-gradient-to-br ${book.cover_color || 'from-blue-500 to-blue-700'} p-6 flex flex-col justify-between`}>
        <div className="flex justify-between items-start">
          <BookOpen className="w-8 h-8 text-white/80" />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span className="text-white text-xs font-bold">{book.progress}%</span>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-white text-xl font-bold mb-1 line-clamp-2">
            {book.title}
          </h3>
          <p className="text-white/80 text-sm">{book.author}</p>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${book.progress}%` }}
            transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
            className="h-full bg-white"
          />
        </div>
      </div>

      {/* Card footer */}
      <div className="p-4">
        <p className="text-sm text-muted-foreground">
          Continue lendo
        </p>
      </div>
    </motion.div>
  );
};

export default BookCard;