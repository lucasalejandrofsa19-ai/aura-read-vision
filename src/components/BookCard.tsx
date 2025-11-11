import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";

interface Book {
  id: string;
  title: string;
  author: string;
  coverColor: string;
  progress: number;
}

interface BookCardProps {
  book: Book;
  index: number;
}

const BookCard = ({ book, index }: BookCardProps) => {
  const navigate = useNavigate();

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
      <div className={`relative h-64 bg-gradient-to-br ${book.coverColor} p-6 flex flex-col justify-between`}>
        <div className="flex justify-between items-start">
          <BookOpen className="w-8 h-8 text-white/80" />
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white text-xs font-bold">{book.progress}%</span>
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