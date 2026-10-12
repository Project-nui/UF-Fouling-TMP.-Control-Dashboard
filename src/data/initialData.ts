// Plant Dataset Definitions & Standard Colors
// Uses SCADA Operating Data from Image Attached (WHA-UP Plant Record: 43 filter cycles)
import { createScadaSampleDataset } from './scadaSampleData';

export interface ProcessedDataset {
  timestamps: number[];
  tmp: (number | null)[][];  // [unitIdx][timeIdx] in bar
  flow: (number | null)[][]; // [unitIdx][timeIdx] in m3/h
  isEmbedded: boolean;
  sourceLabel: string;
}

export function createInitialDataset(): ProcessedDataset {
  return createScadaSampleDataset();
}

export const UNIT_COLORS = [
  '#1D4ED8', // Rich Royal Blue (UF-1)
  '#D97706', // Vibrant Amber/Orange (UF-2)
  '#059669', // Emerald Green (UF-3)
  '#7C3AED', // Deep Violet (UF-4)
  '#DC2626'  // Crimson Red (UF-5)
];
