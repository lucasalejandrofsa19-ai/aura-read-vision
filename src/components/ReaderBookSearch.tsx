import { useEffect, useMemo, useState } from "react";
import { Search, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBooks } from "@/hooks/useBooks";
import { matchesSearch } from "@/lib/searchNormalize";

/**
 * Busca rápida de livros no header do Reader.
 * Lista os livros do usuário + premium gratuitos (ex.: Bíblia Sagrada)
 * e navega para o livro selecionado. Normaliza acentos.
 */
export const ReaderBookSearch = () => {
  const navigate = useNavigate();
  const { books, premiumBooks } = useBooks();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const allBooks = useMemo(() => {
    const freePremium = (premiumBooks ?? [])
      .filter((b: any) => b.is_free)
      .map((b: any) => ({ id: b.id, title: b.title, author: b.author, premium: true }));
    const user = (books ?? []).map((b: any) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      premium: false,
    }));
    return [...freePremium, ...user];
  }, [books, premiumBooks]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return allBooks.slice(0, 8);
    return allBooks
      .filter((b) => matchesSearch(b.title, q) || matchesSearch(b.author, q))
      .slice(0, 12);
  }, [allBooks, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Buscar livro"
          className="aura-soft transition-aura"
        >
          <Search className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="relative mb-2">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar livro (ex.: biblia)"
            className="pl-8"
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">
              Nenhum livro encontrado.
            </p>
          ) : (
            results.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  navigate(`/reader/${b.id}`);
                }}
                className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left transition-colors"
              >
                <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.title}</p>
                  {b.author && (
                    <p className="text-xs text-muted-foreground truncate">
                      {b.author}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
