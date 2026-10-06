"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ArrowLeft, Check, FileText, Loader2, Truck } from "lucide-react";

import ArtworkCheckList from "@/components/ArtworkCheckList";
import PdfPagePreview from "@/components/PdfPagePreview";
import UploadSteps from "@/components/UploadSteps";
import {
  ARTWORK_CONTENT_TYPE,
  MAX_ARTWORK_BYTES,
  fileSizeText,
  pageOptionText,
  parseCanvaUrl,
  previewCaption,
  type ArtworkReport,
} from "@/lib/artwork";
import { pagesAxisLabel, trimText, type ProductFormat } from "@/lib/designEditor";
import {
  copiesText,
  defaultSelection,
  formatPence,
  getQuote,
  type PricingData,
  type Selection,
} from "@/lib/orderOfServicePricing";
import { closePdf, openPdf, type PDFDocumentProxy } from "@/lib/pdfPreview";

export interface UploadProduct {
  id: string;
  label: string;
  format: ProductFormat;
  pricing: PricingData;
}

/** The step-1 choice. Delivery isn't asked here — it's chosen in the basket. */
type Choice = Pick<Selection, "pages" | "paper" | "quantity">;

interface ChosenFile {
  file: File;
  /** pdf.js's copy, for the page count and the preview; null if it couldn't open it. */
  doc: PDFDocumentProxy | null;
  status: "uploading" | "uploaded" | "failed";
  progress: number;
  uploadId: string | null;
  error: string | null;
}

const MAX_MB = Math.floor(MAX_ARTWORK_BYTES / (1024 * 1024));

/** "A5 · 148 × 210 mm, folded", "50 × 200 mm", "A4 to A0" */
function sizeLine(format: ProductFormat): string {
  const base =
    format.sizedByOption || format.sizeLabel.includes("mm")
      ? format.sizeLabel
      : `${format.sizeLabel} · ${trimText(format.trim)}`;
  return format.templatePages === 3 ? `${base}, folded` : base;
}


function choiceFor(product: UploadProduct, keepCopies?: number): Choice {
  const base = defaultSelection(product.pricing);
  const sameCopies = product.pricing.quantity.find((option) => option.value === keepCopies);
  return { pages: base.pages, paper: base.paper, quantity: sameCopies?.id ?? base.quantity };
}

/** PUT the file to its presigned URL, reporting progress (fetch can't, for uploads). */
function putFile(url: string, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", ARTWORK_CONTENT_TYPE);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("upload failed"));
    request.onerror = () => reject(new Error("upload failed"));
    request.send(file);
  });
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; data: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return response.ok ? { ok: true, data: data as T } : { ok: false, status: response.status, data };
}

const errorText = (data: Record<string, unknown>, fallback: string) =>
  typeof data.error === "string" && data.error ? data.error : fallback;

/** A grouped set of option buttons — the buy box's pattern. */
function OptionGroup({
  id,
  label,
  note,
  minWidth,
  children,
}: {
  id: string;
  label: string;
  note?: string;
  minWidth: string;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-2.5">
      <p id={id} className="text-base font-semibold">
        {label}
      </p>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}, 1fr))` }}>
        {children}
      </div>
      {note && <p className="text-[15px] text-ink-3">{note}</p>}
    </div>
  );
}

/** The row at the foot of each step: back on the left, onward on the right. */
function StepFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-7">
      {children}
    </div>
  );
}

function BackButton({ onClick, children = "Back" }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="btn btn-ghost font-semibold text-plum">
      <ArrowLeft size={18} aria-hidden />
      {children}
    </button>
  );
}

/**
 * "Upload your own design": the customer's own PDF (or a Canva link) printed
 * on one of the shop's products, in four steps — what you're printing, your
 * design, check and preview, confirm.
 *
 * The PDF goes from the browser straight to object storage on a presigned
 * URL; the server then reads it back and checks it (/api/uploads/:id/check),
 * and re-checks it when the line is added — what this component shows is the
 * server's report, never a verdict of its own. The preview, by contrast, is
 * drawn here by pdf.js from the file the customer chose, so it costs the
 * server nothing.
 */
export default function UploadFlow({
  products,
  initialProductId,
  uploadsEnabled,
}: {
  products: UploadProduct[];
  initialProductId?: string;
  /** Object storage is configured; without it only a Canva link can be sent. */
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState(
    () => products.find((product) => product.id === initialProductId)?.id ?? products[0].id,
  );
  const product = products.find((candidate) => candidate.id === productId) ?? products[0];
  const [choice, setChoice] = useState<Choice>(() => choiceFor(product));

  const [mode, setMode] = useState<"pdf" | "canva">(uploadsEnabled ? "pdf" : "canva");
  const [chosen, setChosen] = useState<ChosenFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [canvaLink, setCanvaLink] = useState("");
  const [canvaUploadId, setCanvaUploadId] = useState<string | null>(null);

  const [report, setReport] = useState<ArtworkReport | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState<"checking" | "adding" | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const [serviceDate, setServiceDate] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** The file being worked on — late results for a file since removed are dropped. */
  const currentFile = useRef<File | null>(null);
  const firstRender = useRef(true);

  const quote = useMemo(
    () => getQuote(product.pricing, { ...defaultSelection(product.pricing), ...choice }),
    [product, choice],
  );
  const pageOption = quote.pages;
  const uploadId = mode === "pdf" ? chosen?.uploadId ?? null : canvaUploadId;

  // Move focus to each new step's heading, so a screen reader announces it
  // and a keyboard user starts from the top of it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: "nearest" });
  }, [step]);

  // pdf.js keeps a worker-side copy of the file; let it go with the file.
  const previewDoc = chosen?.doc ?? null;
  useEffect(() => () => {
    if (previewDoc) closePdf(previewDoc);
  }, [previewDoc]);

  const goTo = (next: number) => {
    setStepError(null);
    setStep(next);
  };

  /* -------------------------------- step 1 -------------------------------- */

  const chooseProduct = (id: string) => {
    const next = products.find((candidate) => candidate.id === id);
    if (!next || next.id === productId) return;
    setProductId(next.id);
    setChoice(choiceFor(next, quote.quantity.value));
    setReport(null);
  };

  const updateChoice = (patch: Partial<Choice>) => {
    setChoice((current) => ({ ...current, ...patch }));
    // A report answers "does this file fit *that* choice" — a new choice needs a new check.
    if (patch.pages && patch.pages !== choice.pages) setReport(null);
  };

  /* -------------------------------- step 2 -------------------------------- */

  const removeFile = () => {
    currentFile.current = null;
    setChosen(null);
    setReport(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const upload = async (file: File) => {
    currentFile.current = file;
    setChosen({ file, doc: null, status: "uploading", progress: 0, uploadId: null, error: null });
    const update = (patch: Partial<ChosenFile>) =>
      setChosen((current) => (current && current.file === file ? { ...current, ...patch } : current));

    // Open it for the preview alongside the upload; a file pdf.js can't read
    // still goes up — the server's check is what decides.
    openPdf(file)
      .then((doc) => (currentFile.current === file ? update({ doc }) : closePdf(doc)))
      .catch(() => undefined);

    try {
      const reserved = await postJson<{ id: string; uploadUrl: string }>("/api/uploads", {
        source: "pdf",
        fileName: file.name,
        byteSize: file.size,
        contentType: ARTWORK_CONTENT_TYPE,
      });
      if (!reserved.ok) throw new Error(errorText(reserved.data, "We couldn’t start the upload."));
      await putFile(reserved.data.uploadUrl, file, (progress) => update({ progress }));
      update({ status: "uploaded", progress: 1, uploadId: reserved.data.id });
    } catch (error) {
      const message =
        error instanceof Error && error.message !== "upload failed"
          ? error.message
          : "The upload didn’t finish — please check your connection and try again.";
      update({ status: "failed", error: message });
    }
  };

  const pickFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setFileError(null);
    setReport(null);
    const isPdf = file.type === ARTWORK_CONTENT_TYPE || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setFileError("Please choose a PDF file. In Canva, download your design as “PDF Print”.");
      return;
    }
    if (file.size > MAX_ARTWORK_BYTES) {
      setFileError(`Your file is larger than ${MAX_MB} MB — please call us and we’ll take it another way.`);
      return;
    }
    void upload(file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files);
  };

  const runCheck = async (pages: string): Promise<boolean> => {
    if (!uploadId) return false;
    setBusy("checking");
    setStepError(null);
    try {
      const result = await postJson<{ report: ArtworkReport }>(`/api/uploads/${uploadId}/check`, {
        product: product.id,
        pages,
      });
      if (!result.ok) {
        setStepError(errorText(result.data, "We couldn’t check your file — please try again."));
        return false;
      }
      setReport(result.data.report);
      setAccepted(false);
      return true;
    } catch {
      setStepError("We couldn’t check your file — please check your connection and try again.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const checkFile = async () => {
    if (await runCheck(choice.pages)) goTo(2);
  };

  const parsedCanva = parseCanvaUrl(canvaLink);
  const sendCanvaLink = async () => {
    if (!parsedCanva) return;
    // Back and forward again with the same link: it is already saved.
    if (canvaUploadId) {
      setReport({ checks: [], blocking: false, warnings: false });
      goTo(2);
      return;
    }
    setBusy("checking");
    setStepError(null);
    try {
      const result = await postJson<{ id: string }>("/api/uploads", { source: "canva", canvaUrl: parsedCanva });
      if (!result.ok) {
        setStepError(errorText(result.data, "We couldn’t save your link — please try again."));
        return;
      }
      setCanvaUploadId(result.data.id);
      setReport({ checks: [], blocking: false, warnings: false });
      goTo(2);
    } finally {
      setBusy(null);
    }
  };

  /* -------------------------------- step 3 -------------------------------- */

  const differentFile = () => {
    removeFile();
    setMode("pdf");
    goTo(1);
  };

  const switchPages = async (optionId: string) => {
    // Straight to the new report — clearing the old one first would blank the
    // step while the re-check runs.
    setChoice((current) => ({ ...current, pages: optionId }));
    await runCheck(optionId);
  };

  const canContinue = !!report && !report.blocking && (!report.warnings || accepted);

  /* -------------------------------- step 4 -------------------------------- */

  const addToBasket = async () => {
    if (!uploadId || !confirmed) return;
    setBusy("adding");
    setStepError(null);
    try {
      const result = await postJson<{ cart: unknown }>("/api/cart/uploads", {
        uploadId,
        product: product.id,
        pages: choice.pages,
        paper: choice.paper,
        quantity: choice.quantity,
        serviceDate: serviceDate || null,
        confirmed,
        acceptWarnings: accepted,
      });
      if (result.ok) {
        window.dispatchEvent(new Event("tfs:cart-changed"));
        router.push("/cart");
        return;
      }
      // The server re-checked the file and disagrees with what is on screen:
      // show its report and let the customer decide again.
      const fresh = result.data.report as ArtworkReport | undefined;
      if (result.status === 409 && fresh) {
        setReport(fresh);
        setAccepted(false);
        setStep(2);
      }
      setStepError(errorText(result.data, "We couldn’t add it to your basket — please try again."));
      setBusy(null);
    } catch {
      setStepError("We couldn’t add it to your basket — please check your connection and try again.");
      setBusy(null);
    }
  };

  /* -------------------------------- render -------------------------------- */

  /** Each step's heading: what the section is labelled by, and where focus lands. */
  const heading = (text: string, className = "") => (
    <h2
      ref={headingRef}
      id="upload-step"
      tabIndex={-1}
      className={`font-display text-[30px] leading-tight text-ink outline-none ${className}`}
    >
      {text}
    </h2>
  );

  const alert = stepError && (
    <p role="alert" className="mt-6 rounded-lg bg-block-bg px-4 py-3 text-block-text">
      {stepError}
    </p>
  );

  const paperOptions = product.pricing.paper;
  const pageOptions = product.pricing.pages;
  const details = [
    copiesText(quote.quantity.value),
    ...(pageOptions.length > 1 ? [pageOptionText(product.format, pageOption)] : []),
    ...(paperOptions.length > 1 ? [quote.paper.label] : []),
  ].join(" · ");

  return (
    <div className="mt-10">
      <UploadSteps current={step} onGoBack={goTo} />

      <div className="mt-10">
        {step === 0 && (
          <section aria-labelledby="upload-step">
            {heading("What are you printing?")}
            <div
              role="group"
              aria-label="Product"
              className="mt-5 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))]"
            >
              {products.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={option.id === product.id}
                  onClick={() => chooseProduct(option.id)}
                  className="opt flex flex-col items-start gap-1 px-5 py-4 text-left"
                >
                  <span className="font-display text-[22px] font-normal leading-snug text-ink">{option.label}</span>
                  <span className="text-[15px] font-normal text-ink-3">{sizeLine(option.format)}</span>
                </button>
              ))}
            </div>

            <div className="mt-9 grid gap-8 md:grid-cols-2">
              {pageOptions.length > 1 && (
                <OptionGroup
                  id="upload-pages"
                  label={product.format.sizedByOption ? "What size?" : `How many ${pagesAxisLabel(product.format).toLowerCase()} is your design?`}
                  note={product.format.templatePages === 3 ? "Booklets are folded, so pages come in fours." : pageOption.note}
                  minWidth="64px"
                >
                  {pageOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="opt"
                      aria-pressed={choice.pages === option.id}
                      onClick={() => updateChoice({ pages: option.id })}
                    >
                      {product.format.templatePages === 3 ? option.pages : option.label}
                    </button>
                  ))}
                </OptionGroup>
              )}
              <OptionGroup id="upload-copies" label="How many copies?" minWidth="64px">
                {product.pricing.quantity.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="opt"
                    aria-pressed={choice.quantity === option.id}
                    onClick={() => updateChoice({ quantity: option.id })}
                  >
                    {option.value}
                  </button>
                ))}
              </OptionGroup>
              {paperOptions.length > 1 && (
                <OptionGroup id="upload-paper" label={product.format.paperLabel} note={quote.paper.note} minWidth="130px">
                  {paperOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="opt"
                      aria-pressed={choice.paper === option.id}
                      onClick={() => updateChoice({ paper: option.id })}
                    >
                      {option.label}
                    </button>
                  ))}
                </OptionGroup>
              )}
            </div>

            <StepFooter>
              <p className="text-ink-2">
                {details} ·{" "}
                <strong aria-live="polite" className="font-semibold text-ink">
                  {formatPence(quote.totalPence)}
                </strong>
                <span className="block text-[15px] text-ink-3">
                  Includes VAT
                  {quote.delivery.pricePence > 0
                    ? ` and ${formatPence(quote.delivery.pricePence)} delivery`
                    : ` and ${quote.delivery.label.toLowerCase()}`}
                </span>
              </p>
              <button type="button" className="btn btn-primary min-h-[56px] text-lg" onClick={() => goTo(1)}>
                Continue to upload
              </button>
            </StepFooter>
          </section>
        )}

        {step === 1 && (
          <section aria-labelledby="upload-step">
            {heading("Your design", "sr-only")}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-mist-3 p-1.5" role="group" aria-label="How to send your design">
              {(
                [
                  ["pdf", "Upload a PDF"],
                  ["canva", "Paste a Canva link"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => {
                    setMode(value);
                    setStepError(null);
                  }}
                  className={`min-h-[52px] rounded-lg px-4 text-[17px] font-semibold transition-colors ${
                    mode === value ? "bg-surface text-plum-deep shadow-cover" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "pdf" ? (
              <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
                <div>
                  {!uploadsEnabled ? (
                    <p className="rounded-xl border border-line bg-surface p-6 text-ink-2">
                      Uploading files isn’t available right now. Please paste your Canva link instead, or call us
                      and we’ll take your file another way.
                    </p>
                  ) : chosen ? (
                    <FileCard chosen={chosen} onRemove={removeFile} onRetry={() => void upload(chosen.file)} />
                  ) : (
                    <label
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={onDrop}
                      className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors focus-within:outline focus-within:outline-3 focus-within:outline-focus-ring ${
                        dragging ? "border-plum bg-mist-2" : "border-line-2 bg-surface hover:border-plum"
                      }`}
                    >
                      <FileText size={36} strokeWidth={1.5} aria-hidden className="text-plum" />
                      <span className="btn btn-outline pointer-events-none">Choose your PDF</span>
                      <span className="text-ink-2">or drag it here</span>
                      <span className="text-[15px] text-ink-3">PDF only, up to {MAX_MB} MB</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={`${ARTWORK_CONTENT_TYPE},.pdf`}
                        className="sr-only"
                        onChange={(event) => pickFile(event.target.files)}
                      />
                    </label>
                  )}
                  {fileError && (
                    <p role="alert" className="mt-3 text-block-text">
                      {fileError}
                    </p>
                  )}
                </div>

                <aside className="rounded-xl border border-line bg-surface p-6">
                  <h3 className="font-display text-[24px] leading-tight text-ink">Saving your PDF from Canva</h3>
                  <ol className="mt-4 list-decimal space-y-2 pl-6">
                    <li>
                      Click <strong>Share</strong>, then <strong>Download</strong>
                    </li>
                    <li>
                      For file type, choose <strong>PDF Print</strong>
                    </li>
                    <li>
                      Tick <strong>Crop marks and bleed</strong>
                    </li>
                    <li>
                      Click <strong>Download</strong> and upload that file here
                    </li>
                  </ol>
                  <p className="mt-4 text-ink-2">
                    Stuck?{" "}
                    <button type="button" className="link" onClick={() => setMode("canva")}>
                      Send us your Canva link instead
                    </button>{" "}
                    and we’ll do it for you.
                  </p>
                </aside>
              </div>
            ) : (
              <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="canva-link" className="font-semibold">
                    Your Canva link
                  </label>
                  <input
                    id="canva-link"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    className="field"
                    placeholder="https://www.canva.com/design/…"
                    value={canvaLink}
                    aria-invalid={canvaLink.trim() !== "" && !parsedCanva}
                    aria-describedby="canva-link-help"
                    onChange={(event) => {
                      setCanvaLink(event.target.value);
                      setCanvaUploadId(null);
                    }}
                  />
                  <p id="canva-link-help" className="text-[15px] text-ink-3">
                    {canvaLink.trim() !== "" && !parsedCanva
                      ? "That doesn’t look like a Canva design link — it should start canva.com/design/"
                      : "We’ll download it at print quality and check it before it’s printed."}
                  </p>
                </div>
                <aside className="rounded-xl border border-line bg-surface p-6">
                  <h3 className="font-display text-[24px] leading-tight text-ink">Sharing your Canva design</h3>
                  <ol className="mt-4 list-decimal space-y-2 pl-6">
                    <li>
                      In Canva, click <strong>Share</strong>
                    </li>
                    <li>
                      Under <strong>Collaboration link</strong>, choose <strong>Anyone with the link</strong>
                    </li>
                    <li>
                      Click <strong>Copy link</strong> and paste it here
                    </li>
                  </ol>
                </aside>
              </div>
            )}

            {alert}
            <StepFooter>
              <BackButton onClick={() => goTo(0)} />
              {mode === "pdf" ? (
                <button
                  type="button"
                  className="btn btn-primary min-h-[56px] text-lg"
                  disabled={chosen?.status !== "uploaded" || busy !== null}
                  onClick={() => void checkFile()}
                >
                  {busy === "checking" && <Loader2 size={20} className="animate-spin" aria-hidden />}
                  {busy === "checking" ? "Checking your file…" : "Check my file"}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary min-h-[56px] text-lg"
                  disabled={!parsedCanva || busy !== null}
                  onClick={() => void sendCanvaLink()}
                >
                  Continue
                </button>
              )}
            </StepFooter>
          </section>
        )}

        {step === 2 && report && (
          <section aria-labelledby="upload-step">
            {mode === "canva" ? (
              <div className="rounded-xl border border-line bg-surface p-6 sm:p-10">
                {heading("We’ll check your design for you")}
                <ul className="mt-6 flex flex-col gap-4">
                  {[
                    "We’ll open your Canva design and download it at print quality.",
                    `We check the size, ${pageOptions.length > 1 ? "the number of pages, " : ""}the photos and the fonts.`,
                    "If anything needs changing, we’ll call or email you before we print.",
                  ].map((line) => (
                    <li key={line} className="flex gap-3">
                      <Check size={22} aria-hidden className="mt-0.5 shrink-0 text-star" />
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-ink-2">
                  Your link: <span className="break-all text-ink">{parsedCanva}</span>
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-line bg-surface p-6 sm:p-10">
                  {heading("We’ve checked your file")}
                  <div className="mt-6">
                    <ArtworkCheckList checks={report.checks} />
                  </div>
                  {(report.blocking || report.warnings) && (
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line pt-6 sm:pl-12">
                      <button type="button" className="btn btn-outline" onClick={differentFile}>
                        Upload a different file
                      </button>
                      {report.checks.map((check) => {
                        const target = pageOptions.find((option) => option.id === check.switchPages?.optionId);
                        return (
                          target && (
                            <button
                              key={check.id}
                              type="button"
                              className="btn btn-primary"
                              disabled={busy !== null}
                              onClick={() => void switchPages(target.id)}
                            >
                              Switch to {pageOptionText(product.format, target)}
                            </button>
                          )
                        );
                      })}
                      {!report.blocking &&
                        (accepted ? (
                          <p className="flex items-center gap-2 font-semibold text-success-text">
                            <Check size={20} aria-hidden />
                            We’ll print it as it is
                          </p>
                        ) : (
                          <button type="button" className="link text-[17px] font-semibold" onClick={() => setAccepted(true)}>
                            Print it as it is
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <div className="mt-10 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-[30px] leading-tight text-ink">Preview</h2>
                  <p className="text-[15px] text-ink-3">{previewCaption(product.format.templatePages)}</p>
                </div>
                <div className="mt-4 overflow-x-auto rounded-xl bg-mist-3 p-6 sm:p-8">
                  {chosen?.doc ? (
                    <PdfPagePreview
                      doc={chosen.doc}
                      pageCount={chosen.doc.numPages}
                      templatePages={product.format.templatePages}
                      trim={product.format.trim}
                    />
                  ) : (
                    <p className="text-ink-2">
                      We can’t show a preview of this file here, but we’ve checked it — and we print exactly
                      what you sent.
                    </p>
                  )}
                  <p className="mt-5 text-[15px] text-ink-3">Click a page to see it larger.</p>
                </div>
              </>
            )}

            {alert}
            <StepFooter>
              <BackButton onClick={() => goTo(1)} />
              <button
                type="button"
                className="btn btn-primary min-h-[56px] text-lg"
                disabled={!canContinue || busy !== null}
                onClick={() => goTo(3)}
              >
                Looks good, continue
              </button>
            </StepFooter>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="upload-step" className="grid items-start gap-10 md:grid-cols-2">
            <div>
              {heading("Nearly done")}
              <div className="mt-7 flex flex-col gap-2">
                <label htmlFor="service-date" className="font-semibold">
                  Date of the service
                </label>
                <input
                  id="service-date"
                  type="date"
                  className="field max-w-[320px]"
                  value={serviceDate}
                  min={new Date().toISOString().slice(0, 10)}
                  aria-describedby="service-date-help"
                  onChange={(event) => setServiceDate(event.target.value)}
                />
                <p id="service-date-help" className="text-[15px] text-ink-3">
                  Helps us make sure it arrives in time.
                </p>
              </div>
              <label className="mt-7 flex cursor-pointer gap-4 rounded-xl border-[1.5px] border-line-2 bg-surface p-5 hover:border-plum">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-1 size-6 shrink-0 accent-plum"
                />
                <span>I’ve checked the names, dates and spelling. We print exactly what you send us.</span>
              </label>
            </div>

            <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
              <h2 className="font-display text-[26px] leading-tight text-ink">Your order</h2>
              <dl className="mt-5 flex flex-col gap-3">
                {[
                  ["Product", product.label],
                  ["Details", details],
                  ["Your design", mode === "pdf" ? chosen?.file.name ?? "" : "Canva link"],
                  [
                    "Delivery",
                    `${quote.delivery.label}${quote.delivery.pricePence > 0 ? ` (${formatPence(quote.delivery.pricePence)})` : ""}`,
                  ],
                ].map(([term, value]) => (
                  <div key={term} className="flex justify-between gap-6">
                    <dt className="text-ink-2">{term}</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-ink">{value}</dd>
                  </div>
                ))}
                <div className="mt-1 flex items-baseline justify-between gap-6 border-t border-line pt-4">
                  <dt className="font-semibold text-ink">Total</dt>
                  <dd className="text-right">
                    <span className="block font-display text-[32px] leading-none text-ink">
                      {formatPence(quote.totalPence)}
                    </span>
                    <span className="text-sm text-ink-3">Includes VAT</span>
                  </dd>
                </div>
              </dl>
              <div className="mt-5 flex items-start gap-3 rounded-lg bg-mist-2 px-3.5 py-3">
                <Truck size={22} strokeWidth={1.7} aria-hidden className="mt-0.5 shrink-0 text-plum" />
                <span>
                  {quote.delivery.note || quote.delivery.label}
                  {product.pricing.delivery.length > 1 && " You can choose faster delivery in your basket."}
                </span>
              </div>
              {alert}
              <button
                type="button"
                className="btn btn-primary mt-6 min-h-[58px] w-full text-lg"
                disabled={!confirmed || busy !== null}
                onClick={() => void addToBasket()}
              >
                {busy === "adding" && <Loader2 size={20} className="animate-spin" aria-hidden />}
                Add to basket
              </button>
              {!confirmed && (
                <p className="mt-2 text-center text-[15px] text-ink-3">Tick the box to say you’ve checked it.</p>
              )}
              <div className="mt-4 flex justify-center">
                <BackButton onClick={() => goTo(2)}>Back to preview</BackButton>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/** The chosen file on step 2: uploading, uploaded, or failed with a retry. */
function FileCard({
  chosen,
  onRemove,
  onRetry,
}: {
  chosen: ChosenFile;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const pages = chosen.doc?.numPages;
  const facts = [
    ...(pages ? [`${pages} ${pages === 1 ? "page" : "pages"}`] : []),
    fileSizeText(chosen.file.size),
    chosen.status === "uploaded" ? "uploaded" : chosen.status === "uploading" ? `uploading… ${Math.round(chosen.progress * 100)}%` : "not uploaded",
  ].join(" · ");

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md border border-line-2 bg-mist-2 text-xs font-bold text-plum">
          PDF
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[19px] font-semibold text-ink">{chosen.file.name}</p>
          <p aria-live="polite" className="text-[15px] text-ink-2">
            {facts}
          </p>
        </div>
        <button type="button" className="btn btn-ghost px-4 font-semibold text-plum" onClick={onRemove}>
          Remove
        </button>
      </div>
      {chosen.status === "uploading" && (
        <div
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(chosen.progress * 100)}
          className="mt-4 h-2 overflow-hidden rounded-full bg-mist-3"
        >
          <div className="h-full rounded-full bg-plum transition-[width]" style={{ width: `${chosen.progress * 100}%` }} />
        </div>
      )}
      {chosen.status === "failed" && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p role="alert" className="text-block-text">
            {chosen.error}
          </p>
          <button type="button" className="link font-semibold" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
