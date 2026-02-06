
import { BusinessData } from '../types';

const CORS_PROXY = 'https://corsproxy.io/?';

// Función para obtener el saldo de la cuenta de SerpApi
export const getSerpApiAccountInfo = async (apiKey: string) => {
  try {
    const apiUrl = `https://serpapi.com/account.json?api_key=${apiKey.trim()}`;
    const response = await fetch(`${CORS_PROXY}${encodeURIComponent(apiUrl)}`);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      totalSearchesLeft: data.total_searches_left,
      planSearchesLeft: data.plan_searches_left,
      searchesPerMonth: data.searches_per_month
    };
  } catch (e) {
    return null;
  }
};

export const runGoogleMapsScraper = async (
  apiKey: string,
  query: string,
  maxResults: number = 20,
  startOffset: number = 0,
  onStatusUpdate?: (status: string) => void
): Promise<BusinessData[]> => {
  const updateStatus = onStatusUpdate || (() => {});
  
  try {
    updateStatus(startOffset === 0 ? "Conectando con SerpApi..." : `Extrayendo página siguiente (desde result. ${startOffset})...`);
    
    const limit = Math.min(Math.max(maxResults, 1), 20);
    // start: especifica el offset para paginación
    const apiUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&type=search&num=${limit}&start=${startOffset}&api_key=${apiKey.trim()}`;
    
    const response = await fetch(`${CORS_PROXY}${encodeURIComponent(apiUrl)}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error en la API de SerpApi. Verifica tu crédito.");
    }

    const data = await response.json();
    
    if (!data.local_results) {
      return [];
    }

    updateStatus("Procesando nuevos leads...");

    return data.local_results.slice(0, limit).map((item: any) => ({
      name: item.title || "Sin nombre",
      phone: item.phone || "No disponible",
      address: item.address || "Sin dirección",
      fullAddress: item.address,
      website: item.website || null,
      categoryName: item.type || "Negocio",
      stars: item.rating,
      reviewsCount: item.reviews,
      url: item.gps_coordinates ? `https://www.google.com/maps/search/?api=1&query=${item.gps_coordinates.latitude},${item.gps_coordinates.longitude}` : null,
      email: null
    }));

  } catch (error: any) {
    console.error("Scraper Error:", error);
    throw new Error(error.message || "Error desconocido al extraer datos.");
  }
};
