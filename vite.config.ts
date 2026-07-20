import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'AURA READ - Biblioteca Interativa',
        short_name: 'AURA READ',
        description: 'Sua biblioteca pessoal interativa com leitura futurista e inteligente',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // IMPORTANTE: inclui .mjs para precachear o worker LOCAL do PDF.js
        // (public/pdfjs/pdf.worker.min.mjs). Sem isso, o PWA falha ao abrir
        // PDFs em mobile/offline porque o worker não fica disponível.
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB for PDFs
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        sourcemap: false,
        // Não interceptar navegação para o worker local (evita fallback HTML)
        navigateFallbackDenylist: [/^\/pdfjs\//, /^\/~oauth/],
        runtimeCaching: [
          // pdf.js worker LOCAL (/pdfjs/*.mjs) — CacheFirst dedicado para mobile/PWA
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/pdfjs/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdfjs-worker-local-cache',
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // pdf.js worker (CDN fallback) — CacheFirst para sobreviver offline
          {
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\/.*pdfjs-dist.*pdf\.worker.*\.mjs.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdfjs-worker-cache',
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 ano
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // PDF Files - Critical for offline reading
          {
            urlPattern: /.*\.pdf$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Supabase Storage (PDFs, images, covers)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Supabase API - Network first with offline fallback
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Images (covers, highlights, etc.)
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Navigation routes - Stale while revalidate
          {
            urlPattern: /^https?:\/\/.*\/(?:library|reader|profile|install).*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'navigation-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1200,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        // Split heavy vendor libs into dedicated chunks so the initial route
        // download stays small. Each chunk is cache-friendly (long-lived hash)
        // and loaded on-demand only by pages that need it.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Keep Rollup/Vite helper modules out of feature chunks. If a helper
          // is emitted inside a lazy vendor chunk, other core chunks may import
          // from it and accidentally execute that lazy library during app boot.
          if (id.includes("commonjsHelpers") || id.includes("vite/preload-helper")) return "vendor";
          if (id.includes("/three/") || id.includes("@react-three")) return "three";
          if (id.includes("@react-pdf")) return "react-pdf";
          if (id.includes("@ffmpeg")) return "ffmpeg";
          if (id.includes("pdfjs-dist")) return "pdfjs";
          if (id.includes("framer-motion")) return "framer";
          if (id.includes("gsap")) return "gsap";
          if (id.includes("html2canvas") || id.includes("jspdf") || id.includes("docx") || id.includes("file-saver")) return "export";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("@sentry")) return "sentry";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react";
          // Recharts/d3 must not be forced into a shared manual chunk here.
          // In production, Rollup can hoist shared CJS helpers into that chunk,
          // making the React chunk import from "charts" while "charts" imports
          // React. That circular initialization caused the published site to
          // crash before mounting with: Cannot access 'S' before initialization.
          if (id.includes("fabric")) return "fabric";
        },
      },
    },
  },
  esbuild: {
    // Drop console/debugger in production for smaller, faster bundles.
    drop: mode === "production" ? ["console", "debugger"] : [],
    legalComments: "none",
  },
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
}));
