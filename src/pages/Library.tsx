import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BookCard from "@/components/BookCard";
import { toast } from "sonner";

// Mock data para os livros
const mockBooks = [
  {
    id: "1",
    title: "O Poder do Agora",
    author: "Eckhart Tolle",
    coverColor: "from-blue-500 to-blue-700",
    progress: 45,
  },
  {
    id: "2",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    coverColor: "from-amber-500 to-amber-700",
    progress: 78,
  },
  {
    id: "3",
    title: "Atomic Habits",
    author: "James Clear",
    coverColor: "from-purple-500 to-purple-700",
    progress: 23,
  },
  {
    id: "4",
    title: "Deep Work",
    author: "Cal Newport",
    coverColor: "from-green-500 to-green-700",
    progress: 90,
  },
  {
    id: "5",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    coverColor: "from-red-500 to-red-700",
    progress: 12,
  },
  {
    id: "6",
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    coverColor: "from-cyan-500 to-cyan-700",
    progress: 56,
  },
];

const Library = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const filteredBooks = mockBooks.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddBook = () => {
    toast.success("Em breve você poderá adicionar seus próprios PDFs!");
  };

  const handleLogout = () => {
    toast.success("Até logo!");
    navigate("/");
  };

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 mb-8 aura-soft"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Minha Biblioteca
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mockBooks.length} livros na sua coleção
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="aura-soft transition-aura"
              onClick={() => navigate("/profile")}
            >
              <User className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="aura-soft transition-aura"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar livros ou autores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 glass border-primary/20 focus:border-primary"
          />
        </div>
      </motion.header>

      {/* Books grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8"
      >
        {filteredBooks.map((book, index) => (
          <BookCard key={book.id} book={book} index={index} />
        ))}
      </motion.div>

      {/* Add book button */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.4, type: "spring" }}
        className="fixed bottom-8 right-8"
      >
        <Button
          size="lg"
          className="rounded-full w-16 h-16 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity aura-amber shadow-2xl"
          onClick={handleAddBook}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </motion.div>
    </div>
  );
};

export default Library;