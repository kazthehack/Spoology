import React, { useEffect, useMemo, useState } from "react";
import type { Spool, SpoolAnalysis, SpoolContributionPayload, SpoolContributionResponse } from "./types";
import { analyzeSpoolImage, submitSpoolContribution } from "./api";
type TabId = "calculator" | "library" | "scan" | "contrib";

const CARDBOARD_CORE_WEIGHT_GRAMS = 40;

const isDev = import.meta.env.MODE !== "production";

// In GitHub Pages *project* deployments, assets live under the repository base path
// (e.g. https://<user>.github.io/<repo>/...). Vite exposes this via BASE_URL.
const BASE_URL = import.meta.env.BASE_URL;

function withBaseUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  // absolute URLs (including data/blob) should be left as-is
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  // JSON currently stores image paths like "/images/...". Strip the leading slash
  // so BASE_URL can be applied correctly ("/Spoology/" -> "/Spoology/images/..." ).
  const cleaned = path.startsWith("/") ? path.slice(1) : path;
  return `${BASE_URL}${cleaned}`;
}

const SPOOL_FILES: string[] = [
  "bambu-petg-hf-white-perforated.json",
  "bestworth-generic-plastic-55_1mm.json",
  "doweave-plastic-53_3mm-honeycomb.json",
  "esun-cardboard-54mm.json",
  "esun-plastic-53_2mm.json",
  "generic-carbonface-plastic-57_6mm.json",
  "generic-heavy-52_3mm.json",
  "generic-largecore-72mm.json",
  "generic-plastic-54_5mm.json",
  "generic-vented-55mm.json",
  "kaleidi-generic-plastic-59_5mm.json",
  "kingroon-cardboard-53_2mm.json",
  "kingroon-plastic-58_2mm.json",
  "r3d-generic-open-52mm.json",
  "r3d-generic-plastic-53mm-radial.json",
  "wellshow-standard-52_3mm.json",
];

async function loadSpools(): Promise<Spool[]> {
  const results: Spool[] = [];
  for (const file of SPOOL_FILES) {
    try {
      const res = await fetch(`${BASE_URL}spools/${file}`);
      if (!res.ok) continue;
      const spool = (await res.json()) as Spool;

      // Normalize image paths for GitHub Pages project base paths.
      spool.image = withBaseUrl(spool.image);
      results.push(spool);
    } catch {
      // ignore bad file
    }
  }
  return results;
}

function expandBrands(brand?: string | null): string[] {
  if (!brand) return [];
  return brand
    .split("/")
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

function groupByBrand(spools: Spool[]): Record<string, Spool[]> {
  return spools.reduce<Record<string, Spool[]>>((acc, s) => {
    const brands = expandBrands(s.brand);
    if (brands.length === 0) return acc;
    for (const key of brands) {
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
    }
    return acc;
  }, {});
}

function estimateLengthMeters(weightGrams: number, diameterMm?: number): number | null {
  if (!weightGrams || !diameterMm) return null;
  const density = 1.24; // PLA approx g/cm^3
  const radiusCm = (diameterMm / 10) / 2;
  const crossSectionArea = Math.PI * radiusCm * radiusCm; // cm^2
  const volumeCm3 = weightGrams / density;
  const lengthCm = volumeCm3 / crossSectionArea;
  return lengthCm / 100; // meters
}

function fuzzyBrandFilter(spools: Spool[], query: string): Spool[] {
  const q = query.trim().toLowerCase();
  if (!q) return spools;

  const isSubsequence = (needle: string, haystack: string) => {
    let i = 0;
    for (const c of haystack) {
      if (i < needle.length && c === needle[i]) i++;
    }
    return i === needle.length;
  };

  return spools.filter((s) => {
    const brands = expandBrands(s.brand);
    if (brands.length === 0) return false;

    return brands.some((brand) => {
      const b = brand.toLowerCase();
      if (!b) return false;
      return b.includes(q) || isSubsequence(q, b);
    });
  });
}

export const App: React.FC = () => {
  const [tab, setTab] = useState<TabId>("calculator");
  const [spools, setSpools] = useState<Spool[]>([]);
  const [brandFilter, setBrandFilter] = useState("");
  const [brand, setBrand] = useState<string>("");
  const [spoolIndex, setSpoolIndex] = useState<number | null>(null);
  const [measuredWeight, setMeasuredWeight] = useState<string>("");
  const [spoolSize, setSpoolSize] = useState<string>("1000");
  const [includeCore, setIncludeCore] = useState<boolean>(false);

  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<SpoolAnalysis | null>(null);
  const [scanStatus, setScanStatus] = useState<string>("idle");



  const [contribBrand, setContribBrand] = useState<string>("");
  const [contribType, setContribType] = useState<string>("");
  const [contribDescription, setContribDescription] = useState<string>("");
  const [contribFilamentDiameter, setContribFilamentDiameter] = useState<string>("");
  const [contribFilamentWeight, setContribFilamentWeight] = useState<string>("");
  const [contribEmptyWeight, setContribEmptyWeight] = useState<string>("");
  const [contribRefillable, setContribRefillable] = useState<boolean>(false);
  const [contribImageFile, setContribImageFile] = useState<File | null>(null);
  const [contribImagePreview, setContribImagePreview] = useState<string | null>(null);
  const [contribStatus, setContribStatus] = useState<string>("");
  const [contribResult, setContribResult] = useState<SpoolContributionResponse | null>(null);
  const [selectedSpool, setSelectedSpool] = useState<Spool | null>(null);

  useEffect(() => {
loadSpools().then(setSpools);
  }, []);

  const spoolsByBrand = useMemo(() => groupByBrand(spools), [spools]);
  const currentBrandSpools = useMemo(
    () => (brand && spoolsByBrand[brand] ? spoolsByBrand[brand] : []),
    [brand, spoolsByBrand]
  );
  const currentSpool = useMemo(
    () =>
      spoolIndex != null && currentBrandSpools[spoolIndex]
        ? currentBrandSpools[spoolIndex]
        : null,
    [spoolIndex, currentBrandSpools]
  );

  const brandOptions = useMemo(
    () => Object.keys(spoolsByBrand).sort((a, b) => a.localeCompare(b)),
    [spoolsByBrand]
  );

  // Reset includeCore if we switch to a non-refillable spool
  useEffect(() => {
    if (!currentSpool?.refillable && includeCore) {
      setIncludeCore(false);
    }
  }, [currentSpool, includeCore]);

  const [remainingWeight, remainingLength, remainingPercent, safeWeight] = useMemo(() => {
    if (!currentSpool) return [null, null, null, null] as const;
    const measured = parseFloat(measuredWeight);
    if (!measured || measured <= 0) return [null, null, null, null] as const;

    const selectedNominal = parseFloat(spoolSize || "0");
    const nominalFilament =
      selectedNominal > 0
        ? selectedNominal
        : currentSpool.filamentWeightGrams ?? 0;

    const emptyWeightBase = currentSpool.emptySpoolWeightGrams ?? 0;
    const effectiveEmpty =
      emptyWeightBase +
      (currentSpool.refillable && includeCore ? CARDBOARD_CORE_WEIGHT_GRAMS : 0);
    const remaining = Math.max(0, measured - effectiveEmpty);
    const clamped =
      nominalFilament > 0 ? Math.min(remaining, nominalFilament) : remaining;

    const length = estimateLengthMeters(
      clamped,
      currentSpool.filamentDiameterMm
    );
    const percent =
      nominalFilament > 0 ? (clamped / nominalFilament) * 100 : null;
    const safe = clamped * 0.9;

    return [clamped, length, percent, safe] as const;
  }, [currentSpool, measuredWeight, spoolSize, includeCore]);

  const taxonomyText = useMemo(() => {
    if (!currentSpool) return "";
    const lines: string[] = [];
    lines.push(`Brand: ${currentSpool.brand ?? "—"}`);
    lines.push(`Type: ${currentSpool.type ?? "—"}`);
    lines.push(
      `Refillable: ${currentSpool.refillable ? "Yes (master spool core)" : "No"}`
    );
    if (currentSpool.filamentDiameterMm)
      lines.push(`Filament diameter: ${currentSpool.filamentDiameterMm} mm`);
    if (currentSpool.filamentWeightGrams)
      lines.push(`Nominal filament weight: ${currentSpool.filamentWeightGrams} g`);
    if (currentSpool.emptySpoolWeightGrams)
      lines.push(`Empty spool weight: ${currentSpool.emptySpoolWeightGrams} g`);
    if (currentSpool.description) {
      lines.push("");
      lines.push(currentSpool.description);
    }
    return lines.join("\n");
  }, [currentSpool]);

  const filteredSpoolsForLibrary = useMemo(
    () => fuzzyBrandFilter(spools, brandFilter),
    [spools, brandFilter]
  );

  const onSelectBrand = (value: string) => {
    setBrand(value);
    setSpoolIndex(null);
  };

  const onSelectSpoolIndex = (idx: string) => {
    const n = parseInt(idx, 10);
    if (Number.isNaN(n)) setSpoolIndex(null);
    else setSpoolIndex(n);
  };

  const handleScanFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0] ?? null;
    setScanFile(file);
    setScanResult(null);
    if (file) {
      const url = URL.createObjectURL(file);
      setScanPreviewUrl(url);
    } else {
      setScanPreviewUrl(null);
    }
  };

  const handleAnalyzeClick = async () => {
    if (!scanFile) {
      setScanStatus("No file selected.");
      setScanResult(null);
      return;
    }
    try {
      setScanStatus("Sending image to backend…");
      const result = await analyzeSpoolImage(scanFile);
      setScanResult(result);
      setScanStatus("ok");
    } catch (err: any) {
      setScanStatus(err?.message ?? "Error contacting backend.");
      setScanResult(null);
    }
  };

  const handleContribImageChange: React.ChangeEventHandler<HTMLInputElement> = (
    e
  ) => {
    const file = e.target.files?.[0] ?? null;
    setContribImageFile(file);
    setContribResult(null);
    setContribStatus("");
    if (file) {
      const url = URL.createObjectURL(file);
      setContribImagePreview(url);
    } else {
      setContribImagePreview(null);
    }
  };

  const handleSubmitContribution = async () => {
    if (!contribBrand.trim() || !contribType.trim() || !contribImageFile) {
      setContribStatus("Brand, type, and image are required.");
      return;
    }
    setContribStatus("Submitting…");
    try {
      const payload: SpoolContributionPayload = {
        brand: contribBrand.trim(),
        type: contribType.trim(),
        description: contribDescription.trim() || undefined,
        filamentDiameterMm: contribFilamentDiameter
          ? Number(contribFilamentDiameter)
          : undefined,
        filamentWeightGrams: contribFilamentWeight
          ? Number(contribFilamentWeight)
          : undefined,
        emptySpoolWeightGrams: contribEmptyWeight
          ? Number(contribEmptyWeight)
          : undefined,
        refillable: contribRefillable,
        imageFile: contribImageFile,
      };
      const result = await submitSpoolContribution(payload);
      setContribResult(result);
      setContribStatus("Saved. You can now commit the new files.");
    } catch (err: any) {
      setContribStatus(err?.message ?? "Error submitting spool.");
    }
  };


  return (
    <>
      <header>
        <div className="header-main">
          <div className="header-main-left">
            <div className="brand-row">
              <div className="brand-mark">
                <img
	                  src={withBaseUrl("spoology-logo.png")}
                  alt="Spoology logo"
                />
              </div>
              <div className="brand-text">
                <h1>Spoology</h1>
                <p>
                  The study and taxonomy of filament spools. Estimate remaining
                  filament and browse your spool library.
                </p>
              </div>
            </div>
            <div className="tab-nav">
              <button
                className={tab === "calculator" ? "active" : ""}
                onClick={() => setTab("calculator")}
              >
                <span>Tool</span>
                <strong>Calculator</strong>
              </button>
              <button
                className={tab === "library" ? "active" : ""}
                onClick={() => setTab("library")}
              >
                <span>View</span>
                <strong>Spool Library</strong>
              </button>
              {isDev && (
                <>
                  <button
                    className={tab === "scan" ? "active" : ""}
                    onClick={() => setTab("scan")}
                  >
                    <span>Beta</span>
                    <strong>Scan Spool</strong>
                  </button>
                  <button
                    className={tab === "contrib" ? "active" : ""}
                    onClick={() => setTab("contrib")}
                  >
                    <span>Dev</span>
                    <strong>Add Spool</strong>
                  </button>
                </>
              )}
            </div>
          </div>        </div>
      </header>

      <main>
        {/* Calculator tab */}
        <section
          className={`tab-panel ${tab === "calculator" ? "active" : ""}`}
        >
          <div className="container">
            <section className="left-pane">
              <div className="field">
                <label htmlFor="brandSelect">Brand</label>
                <select
                  id="brandSelect"
                  value={brand}
                  onChange={(e) => onSelectBrand(e.target.value)}
                >
                  <option value="">Select brand…</option>
                  {brandOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="typeSelect">Spool Type</label>
                <select
                  id="typeSelect"
                  value={spoolIndex != null ? String(spoolIndex) : ""}
                  onChange={(e) => onSelectSpoolIndex(e.target.value)}
                  disabled={currentBrandSpools.length === 0}
                >
                  <option value="">Select type…</option>
                  {currentBrandSpools
                    .slice()
                    .sort((a, b) => a.type.localeCompare(b.type))
                    .map((s, idx) => (
                      <option key={`${s.brand}-${s.type}-${idx}`} value={idx}>
                        {s.type}
                      </option>
                    ))}
                </select>
              </div>

              <div className="inline-fields">
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="spoolSizeSelect">Spool Size</label>
                  <select
                    id="spoolSizeSelect"
                    value={spoolSize}
                    onChange={(e) => setSpoolSize(e.target.value)}
                  >
                    <option value="250">250 g</option>
                    <option value="1000">1 kg</option>
                    <option value="3000">3 kg</option>
                  </select>
                </div>
                {currentSpool?.refillable && (
                  <div className="field checkbox-row" style={{ flex: 1 }}>
                    <input
                      id="includeCore"
                      type="checkbox"
                      checked={includeCore}
                      onChange={(e) => setIncludeCore(e.target.checked)}
                    />
                    <label
                      htmlFor="includeCore"
                      style={{ textTransform: "none" }}
                    >
                      Include refill spool core
                      <small>
                        Respool-style cartridges contain a cardboard core that
                        should be counted as part of the empty spool weight.
                      </small>
                    </label>
                  </div>
                )}
              </div>

              <div className="field">
                <label htmlFor="spoolInfo">Spool Details / Taxonomy</label>
                <textarea
                  id="spoolInfo"
                  readOnly
                  value={taxonomyText}
                  placeholder="Select a brand and spool type to see details."
                  rows={6}
                />
              </div>

              <div className="calculator-box">
                <h2>Remaining Filament Calculator</h2>
                <div className="field">
                  <label htmlFor="measuredWeight">
                    Measured total weight (spool + filament, g)
                  </label>
                  <input
                    id="measuredWeight"
                    type="number"
                    min={0}
                    step={0.1}
                    value={measuredWeight}
                    onChange={(e) => setMeasuredWeight(e.target.value)}
                  />
                </div>

                <div className="results">
                  <p>
                    <strong>Estimated remaining filament:</strong>
                  </p>
                  <p>
                    {remainingWeight != null
                      ? `${remainingWeight.toFixed(1)} g`
                      : "– g"}
                  </p>
                  <p>
                    {remainingLength != null
                      ? `${remainingLength.toFixed(1)} m (approx)`
                      : "– m"}
                  </p>
                  <p>
                    {remainingPercent != null
                      ? `${remainingPercent.toFixed(1)} % of full filament`
                      : "– % of full filament"}
                  </p>
                </div>

                <div className="field">
                  <label htmlFor="safeRemainingWeight">
                    Conservative remaining weight (-10%)
                  </label>
                  <input
                    id="safeRemainingWeight"
                    type="text"
                    readOnly
                    value={
                      safeWeight != null ? `${safeWeight.toFixed(1)} g` : ""
                    }
                    placeholder="Calculated value will appear here"
                  />
                </div>

                <p className="hint">
                  If a spool is marked as refillable in its JSON
                  definition, you'll see an option to include the refill
                  core weight. Non-refillable spools hide that option.
                </p>
              </div>
            </section>

            <section className="right-pane">
              <div className="image-wrapper">
                {currentSpool?.image ? (
                  <img
                    src={currentSpool.image}
                    alt={`${currentSpool.brand} ${currentSpool.type}`}
                  />
                ) : (
                  <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                    No image selected.
                  </span>
                )}
              </div>
            </section>
          </div>
        </section>

        {/* Library tab */}
        <section className={`tab-panel ${tab === "library" ? "active" : ""}`}>
          <div className="library-wrapper">
            <h2>Spool Library</h2>
            <div className="library-search">
              <input
                id="brandSearch"
                type="search"
                placeholder="Search by brand (e.g. esun, prusa, bambu)"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
              />
              <p className="hint">
                Filters by brand using fuzzy matching. Brand names like
                <code>ESUN/Generic</code> will appear under both labels.
              </p>
            </div>
            <div className="card-grid">
              {filteredSpoolsForLibrary.length === 0 && (
                <p className="hint">No spools found for current filter.</p>
              )}
              {filteredSpoolsForLibrary
                .slice()
                .sort((a, b) => {
                  const cmpBrand = (a.brand ?? "").localeCompare(b.brand ?? "");
                  if (cmpBrand !== 0) return cmpBrand;
                  return (a.type ?? "").localeCompare(b.type ?? "");
                })
                .map((s, idx) => (
                  <article
                    className="spool-card"
                    key={`${s.brand}-${s.type}-${idx}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedSpool(s)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedSpool(s);
                      }
                    }}
                  >
                    <div className="spool-card-header">
                      <h3>{s.brand ?? "Unknown brand"}</h3>
                      <span>{s.type ?? "Unknown type"}</span>
                    </div>
                    <div className="spool-card-image">
                      {s.image ? (
                        <img src={s.image} alt={`${s.brand} ${s.type}`} />
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                          No image
                        </span>
                      )}
                    </div>
                    <div className="spool-card-body">
                      <dl>
                        {s.filamentDiameterMm && (
                          <>
                            <dt>Filament</dt>
                            <dd>{s.filamentDiameterMm} mm</dd>
                          </>
                        )}
                        {s.coreInnerDiameterMm && (
                          <>
                            <dt>Core ID</dt>
                            <dd>{s.coreInnerDiameterMm} mm</dd>
                          </>
                        )}
                        {s.filamentWeightGrams && (
                          <>
                            <dt>Nominal</dt>
                            <dd>{s.filamentWeightGrams} g</dd>
                          </>
                        )}
                        {s.emptySpoolWeightGrams && (
                          <>
                            <dt>Empty spool</dt>
                            <dd>{s.emptySpoolWeightGrams} g</dd>
                          </>
                        )}
                        <dt>Refillable</dt>
                        <dd>{s.refillable ? "Yes" : "No"}</dd>
                      </dl>
                      {s.description && <p>{s.description}</p>}
                    </div>
                  </article>
                ))}
            </div>
          </div>
        </section>

                      
        {isDev && (
          <>
            {/* Scan tab */}
            <section className={`tab-panel ${tab === "scan" ? "active" : ""}`}>
              <div className="scan-layout">
                <section className="scan-pane scan-left">
                  <h2>Scan a Spool (placeholder)</h2>
                  <p className="hint">
                    Upload a photo of a filament spool. The frontend will POST it
                    to the FastAPI backend at <code>/analyze/spool-image</code> and
                    display the JSON response below.
                  </p>

                  <div className="field">
                    <label htmlFor="spoolImageFile">Upload spool photo</label>
                    <input
                      id="spoolImageFile"
                      type="file"
                      accept="image/*"
                      onChange={handleScanFileChange}
                    />
                  </div>

                  <div className="field">
                    <label>Camera capture</label>
                    <button
                      type="button"
                      className="button-secondary"
                      disabled
                      title="Placeholder for future getUserMedia integration"
                    >
                      Use camera (coming soon)
                    </button>
                    <p className="hint">
                      Placeholder for a future camera integration using{" "}
                      <code>getUserMedia()</code>.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleAnalyzeClick}
                  >
                    Analyze image (call backend)
                  </button>
                  {scanStatus !== "idle" && (
                    <p className="hint" style={{ marginTop: "0.25rem" }}>
                      Status: {scanStatus}
                    </p>
                  )}
                </section>

                <section className="scan-pane scan-right">
                  <div className="image-wrapper">
                    {scanPreviewUrl ? (
                      <img src={scanPreviewUrl} alt="Spool preview" />
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                        No image selected.
                      </span>
                    )}
                  </div>

                  <div className="scan-results">
                    <h3>Detected attributes (from backend)</h3>
                    <pre>
                      {JSON.stringify(
                        scanResult ?? {
                          status: "idle",
                          message: "Upload an image and click Analyze.",
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </section>
              </div>
            </section>

            {/* Contribute tab */}
            <section
              className={`tab-panel ${tab === "contrib" ? "active" : ""}`}
            >
              <div className="contrib-layout">
                <section className="contrib-pane contrib-left">
                  <h2>Add a spool to the library</h2>
                  <p className="hint">
                    Run the app locally, fill this in, and the backend will write
                    the JSON + image files into the repo so you can commit them.
                  </p>

                  <div className="field">
                    <label htmlFor="contribBrand">Brand</label>
                    <input
                      id="contribBrand"
                      type="text"
                      value={contribBrand}
                      onChange={(e) => setContribBrand(e.target.value)}
                      placeholder="e.g. ESUN"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="contribType">Spool variant / nickname</label>
                    <input
                      id="contribType"
                      type="text"
                      value={contribType}
                      onChange={(e) => setContribType(e.target.value)}
                      placeholder="e.g. cardboard 54mm core"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="contribDescription">Short description</label>
                    <textarea
                      id="contribDescription"
                      value={contribDescription}
                      onChange={(e) => setContribDescription(e.target.value)}
                      rows={3}
                      placeholder="Visible text describing the spool body (not filament material)."
                    />
                  </div>

                  <div className="inline-fields">
                    <div className="field">
                      <label htmlFor="contribDiameter">
                        Filament diameter (mm)
                      </label>
                      <input
                        id="contribDiameter"
                        type="number"
                        min={0}
                        step={0.01}
                        value={contribFilamentDiameter}
                        onChange={(e) =>
                          setContribFilamentDiameter(e.target.value)
                        }
                        placeholder="1.75"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="contribWeight">Nominal weight (g)</label>
                      <input
                        id="contribWeight"
                        type="number"
                        min={0}
                        step={1}
                        value={contribFilamentWeight}
                        onChange={(e) => setContribFilamentWeight(e.target.value)}
                        placeholder="1000"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="contribEmptyWeight">
                        Empty spool weight (g)
                      </label>
                      <input
                        id="contribEmptyWeight"
                        type="number"
                        min={0}
                        step={0.1}
                        value={contribEmptyWeight}
                        onChange={(e) => setContribEmptyWeight(e.target.value)}
                        placeholder="250"
                      />
                    </div>
                  </div>

                  <div className="field checkbox-row">
                    <input
                      id="contribRefillable"
                      type="checkbox"
                      checked={contribRefillable}
                      onChange={(e) => setContribRefillable(e.target.checked)}
                    />
                    <label
                      htmlFor="contribRefillable"
                      style={{ textTransform: "none" }}
                    >
                      Refillable / master spool core
                      <small>
                        Check this if this is a reusable core that other refills
                        mount onto.
                      </small>
                    </label>
                  </div>

                  <div className="field">
                    <label htmlFor="contribImage">Spool image</label>
                    <input
                      id="contribImage"
                      type="file"
                      accept="image/*"
                      onChange={handleContribImageChange}
                    />
                    <p className="hint">
                      Use a flat, front-facing photo with the spool centred in
                      frame.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleSubmitContribution}
                  >
                    Save JSON + image via backend
                  </button>
                  {contribStatus && (
                    <p className="hint" style={{ marginTop: "0.25rem" }}>
                      {contribStatus}
                    </p>
                  )}
                </section>

                <section className="contrib-pane contrib-right">
                  <h3>JSON preview (what gets written)</h3>
                  <pre>
                    {JSON.stringify(
                      {
                        brand: contribBrand || "Brand",
                        type: contribType || "Spool variant",
                        description:
                          contribDescription.trim() || undefined,
                        filamentDiameterMm: contribFilamentDiameter
                          ? Number(contribFilamentDiameter)
                          : undefined,
                        filamentWeightGrams: contribFilamentWeight
                          ? Number(contribFilamentWeight)
                          : undefined,
                        emptySpoolWeightGrams: contribEmptyWeight
                          ? Number(contribEmptyWeight)
                          : undefined,
                        refillable: contribRefillable || undefined,
                        image:
                          withBaseUrl(contribResult?.spool?.image) ??
                          withBaseUrl("/images/spools/your-image.png"),
                      },
                      null,
                      2
                    )}
                  </pre>
                  {contribResult && (
                    <p className="hint" style={{ marginTop: "0.25rem" }}>
                      Backend wrote:
                      <br />
                      <code>{contribResult.json_path}</code>
                      <br />
                      <code>{contribResult.image_path}</code>
                    </p>
                  )}
                </section>
              </div>
            </section>
          </>
        )}


{selectedSpool && (
  <div
    className="spool-modal-backdrop"
    onClick={() => setSelectedSpool(null)}
  >
    <div
      className="spool-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="spool-modal-close"
        onClick={() => setSelectedSpool(null)}
        aria-label="Close"
      >
        ×
      </button>
      <div className="spool-modal-layout">
        <div className="spool-modal-image">
          {selectedSpool.image ? (
            <img
              src={selectedSpool.image}
              alt={`${selectedSpool.brand} ${selectedSpool.type}`}
            />
          ) : (
            <span>No image</span>
          )}
        </div>
        <div className="spool-modal-body">
          <h2>{selectedSpool.brand}</h2>
          <p className="spool-modal-type">
            {selectedSpool.type}
          </p>
          <dl>
            {selectedSpool.filamentDiameterMm && (
              <>
                <dt>Filament diameter</dt>
                <dd>{selectedSpool.filamentDiameterMm} mm</dd>
              </>
            )}
            {selectedSpool.coreInnerDiameterMm && (
              <>
                <dt>Core inner diameter</dt>
                <dd>{selectedSpool.coreInnerDiameterMm} mm</dd>
              </>
            )}
            {selectedSpool.filamentWeightGrams && (
              <>
                <dt>Nominal weight</dt>
                <dd>{selectedSpool.filamentWeightGrams} g</dd>
              </>
            )}
            {selectedSpool.emptySpoolWeightGrams && (
              <>
                <dt>Empty spool</dt>
                <dd>{selectedSpool.emptySpoolWeightGrams} g</dd>
              </>
            )}
            <dt>Refillable</dt>
            <dd>
              {selectedSpool.refillable
                ? "Yes (master spool / reusable core)"
                : "No"}
            </dd>
          </dl>
          {selectedSpool.description && (
            <p className="spool-modal-description">
              {selectedSpool.description}
            </p>
          )}
        </div>
      </div>
    </div>
  </div>
)}
</main>

      <footer>Spoology © 2025–2026</footer>
    </>
  );
};
