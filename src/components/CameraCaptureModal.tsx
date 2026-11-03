import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string) => void;
  bookCode?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  bookCode,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setErrorMsg(null);
      return;
    }

    startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setErrorMsg(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setErrorMsg('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง หรือเลือกอัปโหลดไฟล์แทน');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-xl flex flex-col border border-[#E8ECF2] animate-in slide-in-from-bottom-5">
        <div className="w-10 h-1 bg-[#E8ECF2] rounded-full mx-auto my-2 sm:hidden" />
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8ECF2]">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#4CAF4F]" />
            <h3 className="font-medium text-xs sm:text-sm text-[#263238]">
              ถ่ายภาพหน้าปก {bookCode ? `(${bookCode})` : ''}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#717171] hover:text-[#263238] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative bg-[#263238] aspect-[4/3] flex items-center justify-center overflow-hidden">
          {errorMsg ? (
            <div className="p-4 text-center text-white max-w-xs font-normal">
              <AlertCircle className="w-8 h-8 text-[#E8F5E9] mx-auto mb-2 opacity-80" />
              <p className="text-xs">{errorMsg}</p>
            </div>
          ) : capturedImage ? (
            <img src={capturedImage} alt="Snapshot" className="w-full h-full object-contain" />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-6 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex items-center justify-center">
                <span className="text-[10px] text-white bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-xs font-normal">
                  จัดหน้าปกให้อยู่ในกรอบ
                </span>
              </div>
            </>
          )}

          {!capturedImage && !errorMsg && (
            <button
              onClick={toggleFacingMode}
              className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-xs"
              title="สลับกล้อง"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-3 bg-[#F5F7FA] flex items-center justify-between gap-2 border-t border-[#E8ECF2]">
          {capturedImage ? (
            <>
              <button
                onClick={handleRetake}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#4D4D4D] bg-white border border-[#E8ECF2] rounded-xl hover:bg-[#F5F7FA] tracking-tight"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#717171]" />
                ถ่ายใหม่
              </button>
              <button
                onClick={handleConfirm}
                className="flex items-center gap-1 px-5 py-1.5 text-xs font-medium text-white bg-[#2a3b4c] hover:bg-[#1e2b38] rounded-xl shadow-xs cursor-pointer transition-colors tracking-tight"
              >
                <Check className="w-3.5 h-3.5" />
                ใช้รูปนี้
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-[#717171] font-normal cursor-pointer tracking-tight"
              >
                ยกเลิก
              </button>
              <button
                disabled={Boolean(errorMsg)}
                onClick={handleTakeSnapshot}
                className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-medium text-white bg-[#2a3b4c] hover:bg-[#1e2b38] rounded-xl shadow-xs disabled:opacity-40 cursor-pointer transition-colors tracking-tight"
              >
                <Camera className="w-4 h-4" />
                ถ่ายภาพ
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
