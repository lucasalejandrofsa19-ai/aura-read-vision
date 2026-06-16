import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

// Register a Unicode-capable font to avoid `unitsPerEm` crash on accented chars/emoji
Font.register({
  family: "Roboto",
  fonts: [
    { src: "https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-regular-webfont.ttf" },
    { src: "https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-bold-webfont.ttf", fontWeight: "bold" },
    { src: "https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-italic-webfont.ttf", fontStyle: "italic" },
  ],
});
Font.registerHyphenationCallback((word) => [word]);
import type { Note } from "@/hooks/useNotes";

interface Highlight {
  id: string;
  page_number: number;
  text: string;
  color: string | null;
  created_at: string;
}

interface HighlightsPDFDocumentProps {
  bookTitle: string;
  highlights: Highlight[];
  notes?: Note[];
  options?: {
    includeHighlights?: boolean;
    includeNotes?: boolean;
    groupByPage?: boolean;
    includeTimestamps?: boolean;
    includeColors?: boolean;
  };
}

export const HighlightsPDFDocument = ({
  bookTitle,
  highlights,
  notes = [],
  options = {
    includeHighlights: true,
    includeNotes: true,
    groupByPage: true,
    includeTimestamps: true,
    includeColors: true,
  },
}: HighlightsPDFDocumentProps) => {
  const {
    includeHighlights = true,
    includeNotes = true,
    groupByPage = true,
    includeTimestamps = true,
    includeColors = true,
  } = options;

  const filteredHighlights = includeHighlights ? highlights : [];
  const filteredNotes = includeNotes ? notes : [];

  const pages = new Set<number>();
  if (groupByPage) {
    filteredHighlights.forEach((h) => pages.add(h.page_number));
    filteredNotes.forEach((n) => pages.add(n.page_number));
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{bookTitle}</Text>
          <Text style={styles.subtitle}>
            Destaques e Anotações Exportados
          </Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString("pt-BR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>

        {groupByPage ? (
          Array.from(pages)
            .sort((a, b) => a - b)
            .map((pageNum) => (
              <View key={pageNum} style={styles.pageSection}>
                <Text style={styles.pageTitle}>Página {pageNum}</Text>

                {includeHighlights && (
                  <>
                    {filteredHighlights
                      .filter((h) => h.page_number === pageNum)
                      .map((highlight, idx) => (
                        <View key={`h-${idx}`} style={styles.highlightBox}>
                          <Text style={styles.highlightText}>
                            "{highlight.text}"
                          </Text>
                          {includeColors && highlight.color && (
                            <Text style={styles.colorTag}>
                              Cor: {highlight.color}
                            </Text>
                          )}
                          {includeTimestamps && (
                            <Text style={styles.timestamp}>
                              {new Date(highlight.created_at).toLocaleString(
                                "pt-BR"
                              )}
                            </Text>
                          )}
                        </View>
                      ))}
                  </>
                )}

                {includeNotes && (
                  <>
                    {filteredNotes
                      .filter((n) => n.page_number === pageNum)
                      .map((note, idx) => (
                        <View key={`n-${idx}`} style={styles.noteBox}>
                          <Text style={styles.noteLabel}>📝 Anotação:</Text>
                          <Text style={styles.noteText}>{note.note_text}</Text>
                          {includeTimestamps && (
                            <Text style={styles.timestamp}>
                              {new Date(note.created_at).toLocaleString(
                                "pt-BR"
                              )}
                            </Text>
                          )}
                        </View>
                      ))}
                  </>
                )}
              </View>
            ))
        ) : (
          <>
            {includeHighlights && filteredHighlights.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Destaques</Text>
                {filteredHighlights.map((highlight, idx) => (
                  <View key={idx} style={styles.highlightBox}>
                    <Text style={styles.pageRef}>
                      Página {highlight.page_number}
                    </Text>
                    <Text style={styles.highlightText}>
                      "{highlight.text}"
                    </Text>
                    {includeColors && highlight.color && (
                      <Text style={styles.colorTag}>
                        Cor: {highlight.color}
                      </Text>
                    )}
                    {includeTimestamps && (
                      <Text style={styles.timestamp}>
                        {new Date(highlight.created_at).toLocaleString(
                          "pt-BR"
                        )}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {includeNotes && filteredNotes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Anotações</Text>
                {filteredNotes.map((note, idx) => (
                  <View key={idx} style={styles.noteBox}>
                    <Text style={styles.pageRef}>
                      Página {note.page_number}
                    </Text>
                    <Text style={styles.noteLabel}>📝 Anotação:</Text>
                    <Text style={styles.noteText}>{note.note_text}</Text>
                    {includeTimestamps && (
                      <Text style={styles.timestamp}>
                        {new Date(note.created_at).toLocaleString("pt-BR")}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </Page>
    </Document>
  );
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 30,
    borderBottom: "2 solid #000000",
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 5,
  },
  date: {
    fontSize: 10,
    color: "#999999",
  },
  pageSection: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333333",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333333",
  },
  highlightBox: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: "#fffbeb",
    borderLeft: "4 solid #fbbf24",
    borderRadius: 4,
  },
  noteBox: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: "#f0f9ff",
    borderLeft: "4 solid #3b82f6",
    borderRadius: 4,
  },
  pageRef: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#666666",
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#3b82f6",
  },
  highlightText: {
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: 5,
    lineHeight: 1.4,
  },
  noteText: {
    fontSize: 11,
    marginBottom: 5,
    lineHeight: 1.4,
  },
  colorTag: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 3,
  },
  timestamp: {
    fontSize: 8,
    color: "#999999",
  },
});
