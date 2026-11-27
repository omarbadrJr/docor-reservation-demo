"use client";

import { AlertCircle, Camera, CameraOff, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

interface BarcodeDetectionMatch {
  rawValue?: string;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<BarcodeDetectionMatch[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

export interface ReceptionistQrScannerProps {
  disabled?: boolean;
  onScan: (rawValue: string) => void;
}

const UNSUPPORTED_CAMERA_MESSAGE =
  "المتصفح ده مش بيدعم مسح كود QR بالكاميرا مباشرة. تقدر تكتب رقم الحجز أو تستخدم جهاز قارئ QR في الخانة اللي فوق.";
const PERMISSION_DENIED_MESSAGE =
  "مقدرتش أفتح الكاميرا. اتأكد إنك سمحت للمتصفح باستخدام الكاميرا أو اكتب رقم الحجز فوق.";
const NO_CAMERA_MESSAGE =
  "مفيش كاميرا متوصلة أو متاحة دلوقتي. تقدر تكتب رقم الحجز في الخانة اللي فوق.";

export function ReceptionistQrScanner({
  disabled = false,
  onScan,
}: ReceptionistQrScannerProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectBusyRef = useRef(false);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stopResources = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }

    detectBusyRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      stopResources();
      setIsStarting(false);
      setIsScanning(false);
      setScannerError(null);
    };
  }, [stopResources]);

  function handleStopCamera() {
    stopResources();
    setIsStarting(false);
    setIsScanning(false);
  }

  async function handleStartCamera() {
    if (disabled || isStarting || isScanning) {
      return;
    }

    setScannerError(null);

    const hasMedia =
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia);
    const DetectorCtor =
      typeof window !== "undefined"
        ? (
            window as unknown as {
              BarcodeDetector?: BarcodeDetectorConstructor;
            }
          ).BarcodeDetector
        : undefined;

    if (!hasMedia || !DetectorCtor) {
      setScannerError(UNSUPPORTED_CAMERA_MESSAGE);
      return;
    }

    setIsStarting(true);

    try {
      const detector = new DetectorCtor({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }

      setIsStarting(false);
      setIsScanning(true);

      scanTimerRef.current = setInterval(() => {
        const activeVideo = videoRef.current;
        if (
          !activeVideo ||
          activeVideo.readyState < 2 ||
          detectBusyRef.current
        ) {
          return;
        }

        detectBusyRef.current = true;
        detector
          .detect(activeVideo)
          .then((matches) => {
            const firstMatch = matches.find(
              (item) => typeof item.rawValue === "string" && item.rawValue.trim().length > 0,
            );
            if (firstMatch?.rawValue) {
              const scannedValue = firstMatch.rawValue.trim();
              stopResources();
              setIsScanning(false);
              onScanRef.current(scannedValue);
            }
          })
          .catch(() => {
            // Keep scanning on transient frame decode errors.
          })
          .finally(() => {
            detectBusyRef.current = false;
          });
      }, 250);
    } catch (error) {
      stopResources();
      setIsStarting(false);
      setIsScanning(false);

      const errorName = error instanceof Error ? error.name : "";
      if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
        setScannerError(NO_CAMERA_MESSAGE);
      } else {
        setScannerError(PERMISSION_DENIED_MESSAGE);
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-foreground">
            مسح كود QR من موبايل المريض
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            وجّه الكاميرا ناحية كود QR المطبوع أو اللي على شاشة المريض.
          </p>
        </div>

        {isScanning ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleStopCamera}
          >
            <CameraOff className="size-4" aria-hidden="true" />
            قفل الكاميرا
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || isStarting}
            onClick={() => void handleStartCamera()}
          >
            {isStarting ? (
              <>
                <Loader2
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
                بنفتح الكاميرا...
              </>
            ) : (
              <>
                <Camera className="size-4" aria-hidden="true" />
                مسح كود QR بالكاميرا
              </>
            )}
          </Button>
        )}
      </div>

      <video
        ref={videoRef}
        playsInline
        muted
        aria-label="معاينة كاميرا مسح كود QR"
        className={
          isScanning
            ? "aspect-video w-full max-w-md rounded-md border border-border bg-black object-cover"
            : "hidden"
        }
      />

      {isScanning ? (
        <p role="status" className="text-xs font-bold text-primary">
          الكاميرا مفتوحة — قرّب كود QR في منتصف الشاشة.
        </p>
      ) : null}

      {scannerError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 font-semibold text-destructive"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{scannerError}</p>
        </div>
      ) : null}
    </div>
  );
}
