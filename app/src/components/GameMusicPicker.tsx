import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { deleteGameAudio, listGameAudio, uploadGameAudio, type GameAudioFile } from '../lib/api';
import { BUILTIN_SOUNDS, playMusic } from '../lib/gameMusic';
import type { MusicSelection } from '../lib/types';

interface Props {
  academyId: string;
  isStaff: boolean;
  value: MusicSelection | null | undefined;
  onChange: (music: MusicSelection | null) => void;
  /** 픽커 앞에 붙는 이름. 배경음악/결과 사운드처럼 한 화면에 여러 개 둘 때 구분용. */
  label?: string;
}

export default function GameMusicPicker({ academyId, isStaff, value, onChange, label }: Props) {
  const { notify } = useToast();
  const { t } = useTranslation();
  const pickerLabel = label ?? t('musicPicker.backgroundMusic');
  const [uploads, setUploads] = useState<GameAudioFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listGameAudio(academyId)
      .then(setUploads)
      .catch(() => {
        /* 목록 실패해도 게임 진행엔 지장 없으니 조용히 무시 */
      });
  }, [academyId]);

  const selectValue = !value ? 'none' : value.kind === 'builtin' ? `builtin:${value.id}` : `upload:${value.path}`;

  function handleSelect(v: string) {
    if (v === 'none') {
      onChange(null);
      return;
    }
    if (v.startsWith('builtin:')) {
      onChange({ kind: 'builtin', id: v.slice('builtin:'.length) });
      return;
    }
    const path = v.slice('upload:'.length);
    const f = uploads.find((u) => u.path === path);
    if (f) onChange({ kind: 'upload', path: f.path, name: f.name, url: f.url });
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const f = await uploadGameAudio(academyId, file);
      setUploads((prev) => [f, ...prev]);
      onChange({ kind: 'upload', path: f.path, name: f.name, url: f.url });
      notify(t('musicPicker.uploadedToast'));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteUpload() {
    if (!value || value.kind !== 'upload') return;
    if (!confirm(t('musicPicker.deleteUploadConfirm', { name: value.name }))) return;
    try {
      await deleteGameAudio(value.path);
      setUploads((prev) => prev.filter((u) => u.path !== value.path));
      onChange(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  function preview() {
    const stop = playMusic(value);
    setTimeout(stop, 4000);
  }

  const currentLabel = !value
    ? t('musicPicker.none')
    : value.kind === 'builtin'
      ? `${BUILTIN_SOUNDS.find((s) => s.id === value.id)?.emoji ?? '🎵'} ${t(`gameSound.${value.id}`)}`
      : `🎵 ${value.name}`;

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="font-label-md text-label-md text-on-surface-variant shrink-0">{pickerLabel}</span>

      {isStaff ? (
        <select
          value={selectValue}
          onChange={(e) => handleSelect(e.target.value)}
          className="min-w-0 max-w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        >
          <option value="none">{t('musicPicker.none')}</option>
          <optgroup label={t('musicPicker.builtinGroup')}>
            {BUILTIN_SOUNDS.map((s) => (
              <option key={s.id} value={`builtin:${s.id}`}>
                {s.emoji} {t(`gameSound.${s.id}`)}
              </option>
            ))}
          </optgroup>
          {uploads.length > 0 && (
            <optgroup label={t('musicPicker.uploadedGroup')}>
              {uploads.map((u) => (
                <option key={u.path} value={`upload:${u.path}`}>
                  {u.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      ) : (
        <span className="font-body-md text-body-md text-on-surface">{currentLabel}</span>
      )}

      {value && (
        <button
          type="button"
          onClick={preview}
          className="font-label-md text-label-md text-primary hover:underline"
        >
          {t('musicPicker.preview')}
        </button>
      )}

      {isStaff && (
        <>
          <label className="font-label-md text-label-md text-primary hover:underline cursor-pointer">
            {uploading ? t('musicPicker.uploading') : t('musicPicker.uploadMy')}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              hidden
              disabled={uploading}
              onChange={(e) => void handleUploadFile(e)}
            />
          </label>
          {value?.kind === 'upload' && (
            <button
              type="button"
              onClick={() => void handleDeleteUpload()}
              className="font-label-md text-label-md text-error hover:underline"
            >
              {t('musicPicker.deleteUpload')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
