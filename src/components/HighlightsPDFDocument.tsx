import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Highlight } from "@/hooks/useHighlights";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    fontWeight: "bold",
  },
  bookTitle: {
    fontSize: 18,
    marginBottom: 30,
    color: "#666666",
  },
  highlight: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 5,
  },
  highlightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pageNumber: {
    fontSize: 12,
    color: "#666666",
  },
  date: {
    fontSize: 10,
    color: "#999999",
  },
  text: {
    fontSize: 12,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 10,
    color: "#999999",
  },
});

interface HighlightsPDFDocumentProps {
  highlights: Highlight[];
  bookTitle: string;
}

export const HighlightsPDFDocument = ({ highlights, bookTitle }: HighlightsPDFDocumentProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Destaques</Text>
      <Text style={styles.bookTitle}>{bookTitle}</Text>
      
      {highlights.map((highlight, index) => (
        <View key={highlight.id} style={styles.highlight}>
          <View style={styles.highlightHeader}>
            <Text style={styles.pageNumber}>Página {highlight.page_number}</Text>
            <Text style={styles.date}>
              {new Date(highlight.created_at).toLocaleDateString("pt-BR")}
            </Text>
          </View>
          <Text style={styles.text}>{highlight.text}</Text>
        </View>
      ))}
      
      <Text style={styles.footer}>
        Gerado em {new Date().toLocaleDateString("pt-BR")} - {highlights.length} destaque(s)
      </Text>
    </Page>
  </Document>
);