import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { uploadGameImage } from '../lib/api';

interface UploadedImage {
  path: string;
  url: string;
}

interface Props {
  academyId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  /** 미리보기 썸네일 높이(px). 배경 이미지는 크게, 목록 안 사진은 작게. */
  previewHeight?: number;
  /** 다른 버킷에 올리고 싶을 때 주입(기본은 game-images 버킷용 uploadGameImage) —
   * 예: 커리큘럼 슬라이드 이미지는 lesson-slide-images 버킷을 쓰는 uploadLessonSlideImage. */
  uploadFn?: (academyId: string, file: File) => Promise<UploadedImage>;
  /** url 외에 스토리지 경로(path)까지 필요하면 이걸로 받는다(나중에 삭제할 때 씀). */
  onUploaded?: (result: UploadedImage) => void;
}

/** 사진 한 장을 올리고 미리보는 공용 위젯. 다이어그램 배경·이미지 퀴즈 사진(game-images)이
 * 기본이고, uploadFn 을 주면 다른 버킷(예: 커리큘럼 슬라이드)에도 그대로 재사용할 수 있다. */
export default function GameImagePicker({
  academyId,
  value,
  onChange,
  previewHeight = 96,
  uploadFn = uploadGameImage,
  onUploaded,
}: Props) {
  const { notify } = useToast();
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const f = await uploadFn(academyId, file);
      onChange(f.url);
      onUploaded?.(f);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {value && (
        <img
          src={value}
          alt=""
          className="rounded-lg border border-outline-variant/40 object-cover"
          style={{ height: previewHeight, width: previewHeight * 1.4 }}
        />
      )}
      <div className="flex flex-col gap-1 items-start">
        <label className="font-label-md text-label-md text-primary hover:underline cursor-pointer">
          {uploading ? t('imagePicker.uploading') : value ? t('imagePicker.replace') : t('imagePicker.upload')}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            disabled={uploading}
            onChange={(e) => void handleUploadFile(e)}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="font-caption text-caption text-error hover:underline"
          >
            {t('imagePicker.remove')}
          </button>
        )}
      </div>
    </div>
  );
}
