import { useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { deleteGameAudio, listGameAudio, uploadGameAudio, type GameAudioFile } from '../lib/api';
import { BUILTIN_SOUNDS, playMusic } from '../lib/gameMusic';
import type { MusicSelection } from '../lib/types';

interface Props {
  academyId: string;
  isStaff: boolean;
  value: MusicSelection | null | undefined;
  onChange: (music: MusicSelection | null) => void;
}

export default function GameMusicPicker({ academyId, isStaff, value, onChange }: Props) {
  const { notify } = useToast();
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
      notify('음악을 업로드했습니다.');
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteUpload() {
    if (!value || value.kind !== 'upload') return;
    if (!confirm(`"${value.name}" 음악을 삭제할까요?`)) return;
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
    ? '없음'
    : value.kind === 'builtin'
      ? `${BUILTIN_SOUNDS.find((s) => s.id === value.id)?.emoji ?? '🎵'} ${
          BUILTIN_SOUNDS.find((s) => s.id === value.id)?.label ?? value.id
        }`
      : `🎵 ${value.name}`;

  return (
    <div className="game-music-picker">
      <span className="gmp-label">배경음악</span>

      {isStaff ? (
        <select className="gmp-select" value={selectValue} onChange={(e) => handleSelect(e.target.value)}>
          <option value="none">없음</option>
          <optgroup label="기본 제공 효과음">
            {BUILTIN_SOUNDS.map((s) => (
              <option key={s.id} value={`builtin:${s.id}`}>
                {s.emoji} {s.label}
              </option>
            ))}
          </optgroup>
          {uploads.length > 0 && (
            <optgroup label="내가 올린 음악">
              {uploads.map((u) => (
                <option key={u.path} value={`upload:${u.path}`}>
                  {u.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      ) : (
        <span className="gmp-current">{currentLabel}</span>
      )}

      {value && (
        <button type="button" className="linkish dark" onClick={preview}>
          미리듣기
        </button>
      )}

      {isStaff && (
        <>
          <label className="linkish dark gmp-upload-label">
            {uploading ? '업로드 중…' : '+ 내 음악 업로드'}
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
            <button type="button" className="link-danger" onClick={() => void handleDeleteUpload()}>
              업로드 삭제
            </button>
          )}
        </>
      )}
    </div>
  );
}
