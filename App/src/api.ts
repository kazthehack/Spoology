
import type { SpoolAnalysis, SpoolContributionPayload, SpoolContributionResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export async function analyzeSpoolImage(file: File): Promise<SpoolAnalysis> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const res = await fetch(`${API_BASE}/analyze/spool-image`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as SpoolAnalysis;
  return data;
}


export async function submitSpoolContribution(
  payload: SpoolContributionPayload
): Promise<SpoolContributionResponse> {
  const formData = new FormData();
  formData.append("brand", payload.brand);
  formData.append("type", payload.type);
  if (payload.description) {
    formData.append("description", payload.description);
  }
  if (payload.filamentDiameterMm != null) {
    formData.append("filament_diameter_mm", String(payload.filamentDiameterMm));
  }
  if (payload.filamentWeightGrams != null) {
    formData.append("filament_weight_grams", String(payload.filamentWeightGrams));
  }
  if (payload.emptySpoolWeightGrams != null) {
    formData.append("empty_spool_weight_grams", String(payload.emptySpoolWeightGrams));
  }
  if (payload.refillable != null) {
    formData.append("refillable", String(payload.refillable));
  }
  formData.append("image", payload.imageFile, payload.imageFile.name);

  const res = await fetch(`${API_BASE}/contrib/spool`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as SpoolContributionResponse;
  return data;
}
