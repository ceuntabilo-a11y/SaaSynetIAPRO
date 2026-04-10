export interface AccessCode {
  id: string;
  code: string;
  durationHours: number;
  createdAt: number;
  expiresAt: number;
  usedByEmail?: string;
  isActive: boolean;
}

export interface BusinessData {
  name: string;
  phone?: string;
  address?: string;
  fullAddress?: string;
  website?: string;
  email?: string;
  categoryName?: string;
  stars?: number | string;
  reviewsCount?: number | string;
  url?: string;
  // Campos de IA
  aiScore?: 'Premium' | 'Estándar' | 'Bajo';
  aiSummary?: string;
  aiNiche?: string;
  aiSentiment?: string;
  aiDicom?: boolean;
  aiServices?: string[];
}

export type AppView = 'login' | 'admin' | 'dashboard' | 'config';

export interface UserSession {
  email: string;
  isAdmin: boolean;
  expiryDate?: number;
}

export interface ScraperSettings {
  apiKey: string;
  maxResults: number;
}