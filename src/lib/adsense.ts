// Google AdSense configuration
// Publisher ID
export const ADSENSE_CLIENT = "ca-pub-4870256203048688";

// Modo: Auto Ads
// O loader do AdSense já está em index.html. Com Auto Ads ativado no painel
// (https://adsense.google.com → Anúncios → Visão geral → Configurações do site),
// o Google injeta anúncios automaticamente nas melhores posições.
//
// Para alternar para unidades manuais no futuro, basta preencher os slots
// abaixo com os IDs reais (data-ad-slot) criados em
// "Anúncios → Por unidade de anúncio" e os blocos voltam a renderizar.
export const ADSENSE_SLOTS = {
  libraryTop: "",
  betweenBooks: "",
  summaryInline: "",
  stickyFooter: "",
};
