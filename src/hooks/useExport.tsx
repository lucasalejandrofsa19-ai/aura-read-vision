import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import type { Note } from "@/hooks/useNotes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { exportHighlightsPDF } from "@/lib/pdfExport";

export type ExportFormat = "pdf" | "word" | "markdown" | "notion";

interface Highlight {
  id: string;
  page_number: number;
  text: string;
  color: string | null;
  created_at: string;
}

interface ExportOptions {
  includeHighlights: boolean;
  includeNotes: boolean;
  groupByPage: boolean;
  includeTimestamps: boolean;
  includeColors: boolean;
}

export const useExport = () => {
  const exportToPDF = async (
    bookTitle: string,
    highlights: Highlight[],
    notes: Note[],
    options: ExportOptions
  ) => {
    try {
      exportHighlightsPDF(bookTitle, highlights, notes as any, options);
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar PDF");
    }
  };


  const exportToWord = async (
    bookTitle: string,
    highlights: Highlight[],
    notes: Note[],
    options: ExportOptions
  ) => {
    try {
      const children: Paragraph[] = [];

      // Title
      children.push(
        new Paragraph({
          text: bookTitle,
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: `Exportado em ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`,
          spacing: { after: 400 },
        })
      );

      if (options.groupByPage) {
        // Group by page
        const pages = new Set<number>();
        if (options.includeHighlights) {
          highlights.forEach(h => pages.add(h.page_number));
        }
        if (options.includeNotes) {
          notes.forEach(n => pages.add(n.page_number));
        }

        Array.from(pages)
          .sort((a, b) => a - b)
          .forEach(pageNum => {
            children.push(
              new Paragraph({
                text: `Página ${pageNum}`,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 200 },
              })
            );

            // Highlights for this page
            if (options.includeHighlights) {
              const pageHighlights = highlights.filter(h => h.page_number === pageNum);
              if (pageHighlights.length > 0) {
                children.push(
                  new Paragraph({
                    text: "Destaques:",
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 200, after: 100 },
                  })
                );

                pageHighlights.forEach(highlight => {
                  const runs: TextRun[] = [
                    new TextRun({ text: `"${highlight.text}"`, italics: true }),
                  ];

                  if (options.includeColors && highlight.color) {
                    runs.push(new TextRun({ text: ` [${highlight.color}]`, color: highlight.color.replace("#", "") }));
                  }

                  if (options.includeTimestamps) {
                    runs.push(
                      new TextRun({
                        text: ` - ${format(new Date(highlight.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
                        size: 18,
                      })
                    );
                  }

                  children.push(
                    new Paragraph({
                      children: runs,
                      spacing: { after: 150 },
                    })
                  );
                });
              }
            }

            // Notes for this page
            if (options.includeNotes) {
              const pageNotes = notes.filter(n => n.page_number === pageNum);
              if (pageNotes.length > 0) {
                children.push(
                  new Paragraph({
                    text: "Anotações:",
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 200, after: 100 },
                  })
                );

                pageNotes.forEach(note => {
                  const runs: TextRun[] = [
                    new TextRun({ text: note.note_text }),
                  ];

                  if (options.includeTimestamps) {
                    runs.push(
                      new TextRun({
                        text: ` - ${format(new Date(note.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
                        size: 18,
                      })
                    );
                  }

                  children.push(
                    new Paragraph({
                      children: runs,
                      spacing: { after: 150 },
                    })
                  );
                });
              }
            }
          });
      } else {
        // Don't group by page
        if (options.includeHighlights && highlights.length > 0) {
          children.push(
            new Paragraph({
              text: "Destaques",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
            })
          );

          highlights.forEach(highlight => {
            const runs: TextRun[] = [
              new TextRun({ text: `Página ${highlight.page_number}: `, bold: true }),
              new TextRun({ text: `"${highlight.text}"`, italics: true }),
            ];

            if (options.includeColors && highlight.color) {
              runs.push(new TextRun({ text: ` [${highlight.color}]`, color: highlight.color.replace("#", "") }));
            }

            if (options.includeTimestamps) {
              runs.push(
                new TextRun({
                  text: ` - ${format(new Date(highlight.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
                  size: 18,
                })
              );
            }

            children.push(
              new Paragraph({
                children: runs,
                spacing: { after: 150 },
              })
            );
          });
        }

        if (options.includeNotes && notes.length > 0) {
          children.push(
            new Paragraph({
              text: "Anotações",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
            })
          );

          notes.forEach(note => {
            const runs: TextRun[] = [
              new TextRun({ text: `Página ${note.page_number}: `, bold: true }),
              new TextRun({ text: note.note_text }),
            ];

            if (options.includeTimestamps) {
              runs.push(
                new TextRun({
                  text: ` - ${format(new Date(note.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
                  size: 18,
                })
              );
            }

            children.push(
              new Paragraph({
                children: runs,
                spacing: { after: 150 },
              })
            );
          });
        }
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${bookTitle}-export-${Date.now()}.docx`);
      toast.success("Word exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting Word:", error);
      toast.error("Erro ao exportar Word");
    }
  };

  const exportToMarkdown = (
    bookTitle: string,
    highlights: Highlight[],
    notes: Note[],
    options: ExportOptions
  ) => {
    try {
      let markdown = `# ${bookTitle}\n\n`;
      markdown += `*Exportado em ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}*\n\n`;
      markdown += "---\n\n";

      if (options.groupByPage) {
        const pages = new Set<number>();
        if (options.includeHighlights) {
          highlights.forEach(h => pages.add(h.page_number));
        }
        if (options.includeNotes) {
          notes.forEach(n => pages.add(n.page_number));
        }

        Array.from(pages)
          .sort((a, b) => a - b)
          .forEach(pageNum => {
            markdown += `## Página ${pageNum}\n\n`;

            if (options.includeHighlights) {
              const pageHighlights = highlights.filter(h => h.page_number === pageNum);
              if (pageHighlights.length > 0) {
                markdown += "### Destaques\n\n";
                pageHighlights.forEach(highlight => {
                  markdown += `> *"${highlight.text}"*`;
                  if (options.includeColors && highlight.color) {
                    markdown += ` \`${highlight.color}\``;
                  }
                  if (options.includeTimestamps) {
                    markdown += ` - ${format(new Date(highlight.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`;
                  }
                  markdown += "\n\n";
                });
              }
            }

            if (options.includeNotes) {
              const pageNotes = notes.filter(n => n.page_number === pageNum);
              if (pageNotes.length > 0) {
                markdown += "### Anotações\n\n";
                pageNotes.forEach(note => {
                  markdown += `- ${note.note_text}`;
                  if (options.includeTimestamps) {
                    markdown += ` *(${format(new Date(note.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })})*`;
                  }
                  markdown += "\n";
                });
                markdown += "\n";
              }
            }
          });
      } else {
        if (options.includeHighlights && highlights.length > 0) {
          markdown += "## Destaques\n\n";
          highlights.forEach(highlight => {
            markdown += `**Página ${highlight.page_number}:** *"${highlight.text}"*`;
            if (options.includeColors && highlight.color) {
              markdown += ` \`${highlight.color}\``;
            }
            if (options.includeTimestamps) {
              markdown += ` - ${format(new Date(highlight.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`;
            }
            markdown += "\n\n";
          });
        }

        if (options.includeNotes && notes.length > 0) {
          markdown += "## Anotações\n\n";
          notes.forEach(note => {
            markdown += `**Página ${note.page_number}:** ${note.note_text}`;
            if (options.includeTimestamps) {
              markdown += ` *(${format(new Date(note.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })})*`;
            }
            markdown += "\n\n";
          });
        }
      }

      const blob = new Blob([markdown], { type: "text/markdown" });
      saveAs(blob, `${bookTitle}-export-${Date.now()}.md`);
      toast.success("Markdown exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting Markdown:", error);
      toast.error("Erro ao exportar Markdown");
    }
  };

  const exportToNotion = (
    bookTitle: string,
    highlights: Highlight[],
    notes: Note[],
    options: ExportOptions
  ) => {
    try {
      const notionData: any = {
        title: bookTitle,
        exported_at: new Date().toISOString(),
        blocks: [],
      };

      if (options.groupByPage) {
        const pages = new Set<number>();
        if (options.includeHighlights) {
          highlights.forEach(h => pages.add(h.page_number));
        }
        if (options.includeNotes) {
          notes.forEach(n => pages.add(n.page_number));
        }

        Array.from(pages)
          .sort((a, b) => a - b)
          .forEach(pageNum => {
            notionData.blocks.push({
              type: "heading_2",
              heading_2: {
                rich_text: [{ type: "text", text: { content: `Página ${pageNum}` } }],
              },
            });

            if (options.includeHighlights) {
              const pageHighlights = highlights.filter(h => h.page_number === pageNum);
              if (pageHighlights.length > 0) {
                notionData.blocks.push({
                  type: "heading_3",
                  heading_3: {
                    rich_text: [{ type: "text", text: { content: "Destaques" } }],
                  },
                });

                pageHighlights.forEach(highlight => {
                  const richText: any[] = [
                    {
                      type: "text",
                      text: { content: highlight.text },
                      annotations: { italic: true },
                    },
                  ];

                  if (options.includeColors && highlight.color) {
                    richText.push({
                      type: "text",
                      text: { content: ` [${highlight.color}]` },
                    });
                  }

                  if (options.includeTimestamps) {
                    richText.push({
                      type: "text",
                      text: {
                        content: ` - ${format(new Date(highlight.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
                      },
                    });
                  }

                  notionData.blocks.push({
                    type: "quote",
                    quote: { rich_text: richText },
                  });
                });
              }
            }

            if (options.includeNotes) {
              const pageNotes = notes.filter(n => n.page_number === pageNum);
              if (pageNotes.length > 0) {
                notionData.blocks.push({
                  type: "heading_3",
                  heading_3: {
                    rich_text: [{ type: "text", text: { content: "Anotações" } }],
                  },
                });

                pageNotes.forEach(note => {
                  const richText: any[] = [
                    {
                      type: "text",
                      text: { content: note.note_text },
                    },
                  ];

                  if (options.includeTimestamps) {
                    richText.push({
                      type: "text",
                      text: {
                        content: ` - ${format(new Date(note.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
                      },
                    });
                  }

                  notionData.blocks.push({
                    type: "bulleted_list_item",
                    bulleted_list_item: { rich_text: richText },
                  });
                });
              }
            }
          });
      } else {
        if (options.includeHighlights && highlights.length > 0) {
          notionData.blocks.push({
            type: "heading_2",
            heading_2: {
              rich_text: [{ type: "text", text: { content: "Destaques" } }],
            },
          });

          highlights.forEach(highlight => {
            const richText: any[] = [
              {
                type: "text",
                text: { content: `Página ${highlight.page_number}: ` },
                annotations: { bold: true },
              },
              {
                type: "text",
                text: { content: highlight.text },
                annotations: { italic: true },
              },
            ];

            if (options.includeColors && highlight.color) {
              richText.push({
                type: "text",
                text: { content: ` [${highlight.color}]` },
              });
            }

            if (options.includeTimestamps) {
              richText.push({
                type: "text",
                text: {
                  content: ` - ${format(new Date(highlight.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
                },
              });
            }

            notionData.blocks.push({
              type: "quote",
              quote: { rich_text: richText },
            });
          });
        }

        if (options.includeNotes && notes.length > 0) {
          notionData.blocks.push({
            type: "heading_2",
            heading_2: {
              rich_text: [{ type: "text", text: { content: "Anotações" } }],
            },
          });

          notes.forEach(note => {
            const richText: any[] = [
              {
                type: "text",
                text: { content: `Página ${note.page_number}: ` },
                annotations: { bold: true },
              },
              {
                type: "text",
                text: { content: note.note_text },
              },
            ];

            if (options.includeTimestamps) {
              richText.push({
                type: "text",
                text: {
                  content: ` - ${format(new Date(note.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
                },
              });
            }

            notionData.blocks.push({
              type: "bulleted_list_item",
              bulleted_list_item: { rich_text: richText },
            });
          });
        }
      }

      const blob = new Blob([JSON.stringify(notionData, null, 2)], {
        type: "application/json",
      });
      saveAs(blob, `${bookTitle}-notion-export-${Date.now()}.json`);
      toast.success("Exportado para Notion! Importe o arquivo JSON no Notion.");
    } catch (error) {
      console.error("Error exporting to Notion:", error);
      toast.error("Erro ao exportar para Notion");
    }
  };

  const exportData = async (
    format: ExportFormat,
    bookTitle: string,
    highlights: Highlight[],
    notes: Note[],
    options: ExportOptions
  ) => {
    if (!options.includeHighlights && !options.includeNotes) {
      toast.error("Selecione pelo menos um tipo de conteúdo para exportar");
      return;
    }

    switch (format) {
      case "pdf":
        await exportToPDF(bookTitle, highlights, notes, options);
        break;
      case "word":
        await exportToWord(bookTitle, highlights, notes, options);
        break;
      case "markdown":
        exportToMarkdown(bookTitle, highlights, notes, options);
        break;
      case "notion":
        exportToNotion(bookTitle, highlights, notes, options);
        break;
    }
  };

  return { exportData };
};
