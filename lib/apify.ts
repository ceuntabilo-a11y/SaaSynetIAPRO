
import { BusinessData } from '../types';

const ACTOR_NAME = 'blueorion~free-google-maps-scraper-simplified';
const CORS_PROXY = 'https://corsproxy.io/?';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const runGoogleMapsScraper = async (
  token: string,
  query: string,
  maxResults: number = 10,
  onStatusUpdate?: (status: string) => void
): Promise<BusinessData[]> => {
  const cleanToken = token.trim();
  const updateStatus = onStatusUpdate || (() => {});

  const queryParts = query.split(' en ');
  const searchTerm = queryParts[0];
  const locationTerm = queryParts[1] || "";

  try {
    updateStatus("Sincronizando con Google Maps...");
    
    const runUrl = `https://api.apify.com/v2/acts/${ACTOR_NAME}/runs?token=${cleanToken}`;
    
    const payload = {
      searchTerms: [searchTerm],
      startingLocations: [locationTerm],
      maxPlacesPerSearch: Math.min(maxResults, 100),
      language: "es",
      proxyConfiguration: { 
        useApifyProxy: true,
        groups: ["RESIDENTIAL"] 
      }
    };

    const startResponse = await fetch(`${CORS_PROXY}${encodeURIComponent(runUrl)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!startResponse.ok) throw new Error(`Token inválido o sin saldo en Apify.`);

    const startData = await startResponse.json();
    const runId = startData.data.id;
    const datasetId = startData.data.defaultDatasetId;

    let isFinished = false;
    let attempts = 0;
    const maxAttempts = 40;

    while (!isFinished && attempts < maxAttempts) {
      attempts++;
      updateStatus(`Analizando negocios... ${attempts * 5}s`);
      await sleep(5000);

      const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${cleanToken}`;
      const statusResponse = await fetch(`${CORS_PROXY}${encodeURIComponent(statusUrl)}`);
      
      if (!statusResponse.ok) continue;

      const statusData = await statusResponse.json();
      const status = statusData.data.status;

      if (status === 'SUCCEEDED') isFinished = true;
      else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
        throw new Error(`Apify falló. Verifica tus créditos o proxies.`);
      }
    }

    if (!isFinished) throw new Error("Tiempo de espera agotado.");

    updateStatus("Generando lista de leads...");
    const resultsUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${cleanToken}`;
    const resultsResponse = await fetch(`${CORS_PROXY}${encodeURIComponent(resultsUrl)}`);
    const items = await resultsResponse.json();
    
    // Mapeo robusto con múltiples fallbacks para los nombres de campos de Apify
    return items.map((item: any) => ({
      name: item.title || item.name || item.companyName || "Sin nombre",
      phone: item.phone || item.phoneNumber || item.phone_number || "No disponible",
      address: item.address || item.fullAddress || item.street || "Sin dirección",
      fullAddress: item.address || item.fullAddress,
      website: item.website || item.site || item.url || null,
      categoryName: item.categoryName || item.category || "Negocio",
      stars: item.totalScore || item.stars || item.rating,
      reviewsCount: item.reviewsCount || item.reviews || item.reviews_count,
      url: item.url || item.googleMapsUrl || item.placeUrl,
      email: item.email || (item.additionalInfo?.emails ? item.additionalInfo.emails[0] : null)
    }));

  } catch (error: any) {
    throw new Error(error.message);
  }
};
