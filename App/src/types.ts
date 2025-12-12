
export interface Spool {
  brand: string;
  type: string;
  image?: string;
  description?: string;
  filamentDiameterMm?: number;
  filamentWeightGrams?: number;
  emptySpoolWeightGrams?: number;
  coreInnerDiameterMm?: number;
  /** true if this is a refillable spool / master spool core */
  refillable?: boolean;
}

export interface SpoolAnalysis {
  brand_guess?: string | null;
  material_type?: string | null;
  hole_pattern_type?: string | null;
  estimated_empty_weight_grams?: number | null;
  notes: string;
}


export interface SpoolContributionPayload {
  brand: string;
  type: string;
  description?: string;
  filamentDiameterMm?: number;
  filamentWeightGrams?: number;
  emptySpoolWeightGrams?: number;
  coreInnerDiameterMm?: number;
  refillable?: boolean;
  imageFile: File;
}

export interface SpoolContributionResponse {
  id: string;
  json_path: string;
  image_path: string;
  spool: Spool;
}
