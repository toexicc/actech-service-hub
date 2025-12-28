// Cached PDF assets for faster generation
let cachedLogoDataUrl: string | null = null;
let cachedTermsPdfBytes: ArrayBuffer | null = null;
let loadingPromise: Promise<void> | null = null;

const getBasePath = () => import.meta.env.MODE === 'production' ? '/actech-service-hub' : '';

// Preload all assets in parallel
export const preloadPdfAssets = async (): Promise<void> => {
  if (loadingPromise) return loadingPromise;
  if (cachedLogoDataUrl && cachedTermsPdfBytes) return;

  loadingPromise = (async () => {
    const basePath = getBasePath();
    
    const [logoResult, termsResult] = await Promise.allSettled([
      // Load logo
      (async () => {
        if (cachedLogoDataUrl) return;
        const res = await fetch(`${basePath}/ac-tech-logo-pdf.png`);
        if (!res.ok) throw new Error("Failed to load logo");
        const blob = await res.blob();
        cachedLogoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read logo"));
          reader.readAsDataURL(blob);
        });
      })(),
      // Load terms PDF
      (async () => {
        if (cachedTermsPdfBytes) return;
        const res = await fetch(`${basePath}/AC_Tech_Terms_and_Condition.pdf`);
        if (res.ok) {
          cachedTermsPdfBytes = await res.arrayBuffer();
        }
      })(),
    ]);

    if (logoResult.status === 'rejected') {
      console.error('Failed to preload logo:', logoResult.reason);
    }
    if (termsResult.status === 'rejected') {
      console.error('Failed to preload terms PDF:', termsResult.reason);
    }
  })();

  await loadingPromise;
  loadingPromise = null;
};

// Get cached logo or load if not cached
export const getLogoDataUrl = async (): Promise<string> => {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  
  const basePath = getBasePath();
  const res = await fetch(`${basePath}/ac-tech-logo-pdf.png`);
  if (!res.ok) throw new Error("Failed to load logo");
  const blob = await res.blob();
  
  cachedLogoDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read logo"));
    reader.readAsDataURL(blob);
  });
  
  return cachedLogoDataUrl;
};

// Get cached terms PDF bytes or load if not cached
export const getTermsPdfBytes = async (): Promise<ArrayBuffer | null> => {
  if (cachedTermsPdfBytes) return cachedTermsPdfBytes;
  
  const basePath = getBasePath();
  try {
    const res = await fetch(`${basePath}/AC_Tech_Terms_and_Condition.pdf`);
    if (res.ok) {
      cachedTermsPdfBytes = await res.arrayBuffer();
      return cachedTermsPdfBytes;
    }
  } catch (error) {
    console.error('Error loading terms PDF:', error);
  }
  
  return null;
};

// Clear cache (for testing or memory management)
export const clearPdfAssetsCache = () => {
  cachedLogoDataUrl = null;
  cachedTermsPdfBytes = null;
  loadingPromise = null;
};
