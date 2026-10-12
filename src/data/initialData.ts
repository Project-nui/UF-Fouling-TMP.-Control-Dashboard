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
  '#8B5CF6', // Neon Violet (UF-1)
  '#EC4899', // Neon Pink (UF-2)
  '#06B6D4', // Neon Cyan (UF-3)
  '#10B981', // Neon Emerald (UF-4)
  '#F59E0B'  // Neon Amber (UF-5)
];
