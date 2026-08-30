import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createClass,
  createPreset,
  deleteClass,
  deletePreset,
  fetchPresets,
  removeAcademyLogo,
  renameClass,
  rotateInviteCode,
  updateAcademy,
  uploadAcademyLogo,
} from '../lib/api';
import { signed } from '../lib/format';
import { resizeImageToPng } from '../lib/image';
import { useClasses } from '../lib/useClasses';
import type { Preset } from '../lib/types';

const MAX_LOGO_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function SettingsPage() {
  const { academy, profile, refresh } = useAuth();
  const { notify, run } = useToast();
  const { classes, reload: reloadClasses } = useClasses(academy?.id);

  const [name, setName] = useState(academy?.name ?? '');
  const [unit, setUnit] = useState(academy?.point_unit ?? '');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetDelta, setNewPresetDelta] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [inviteCode, setInviteCode] = useState(academy?.invite_code ?? '');
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(academy?.name ?? '');
    setUnit(academy?.point_unit ?? '');
    setInviteCode(academy?.invite_code ?? '');
  }, [academy]);

  const loadPresets = useCallback(async () => {
    if (!academy?.id) return;
    try {
      setPresets(await fetchPresets(academy.id));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
  }, [academy?.id, notify]);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  const isOwner = profile?.role === 'owner';

  /* ---------- 핸들러 ---------- */

  async function saveAcademy() {
    if (!academy?.id) return;
    const ok = await run(
      () => updateAcademy(academy.id, { name: name.trim(), point_unit: unit.trim() }),
      '저장했습니다.',
    );
    if (ok) await refresh();
  }

  async function addPreset() {
    if (!academy?.id) return;
    const delta = parseInt(newPresetDelta, 10);
    if (!newPresetLabel.trim() || !delta) {
      notify('사유와 0이 아닌 점수를 입력해 주세요.', 'error');
      return;
    }
    const ok = await run(async () => {
      await createPreset(academy.id, newPresetLabel.trim(), delta, presets.length);
    }, '프리셋을 추가했습니다.');
    if (ok) {
      setNewPresetLabel('');
      setNewPresetDelta('');
      await loadPresets();
    }
  }

  async function removePreset(id: string) {
    const ok = await run(() => deletePreset(id), '프리셋을 삭제했습니다.');
    if (ok) setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  async function addClass() {
    if (!academy?.id || !newClassName.trim()) return;
    const ok = await run(async () => {
      await createClass(academy.id, newClassName.trim(), classes.length);
    }, '반을 추가했습니다.');
    if (ok) {
      setNewClassName('');
      await reloadClasses();
    }
  }

  async function handleRenameClass(id: string, current: string) {
    const next = prompt('반 이름을 입력하세요', current);
    if (!next?.trim() || next.trim() === current) return;
    const ok = await run(() => renameClass(id, next.trim()), '이름을 변경했습니다.');
    if (ok) await reloadClasses();
  }

  async function handleDeleteClass(id: string, className: string) {
    if (!confirm(`"${className}" 반과 소속 학생·거래 기록을 모두 삭제할까요?\n되돌릴 수 없습니다.`))
      return;
    const ok = await run(() => deleteClass(id), '반을 삭제했습니다.');
    if (ok) await reloadClasses();
  }

  async function handleRotate() {
    if (!confirm('초대 코드를 새로 발급하면 기존 코드는 사용할 수 없게 됩니다. 계속할까요?')) return;
    try {
      const code = await rotateInviteCode();
      setInviteCode(code);
      notify('새 초대 코드를 발급했습니다.');
      await refresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  async function handleLogoSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 선택해도 change 가 발생하도록
    if (!file || !academy?.id) return;

    if (!file.type.startsWith('image/')) {
      notify('이미지 파일만 업로드할 수 있어요.', 'error');
      return;
    }
    if (file.size > MAX_LOGO_FILE_SIZE) {
      notify('이미지 용량은 5MB 이하로 올려주세요.', 'error');
      return;
    }

    setLogoBusy(true);
    const ok = await run(async () => {
      const resized = await resizeImageToPng(file);
      await uploadAcademyLogo(academy.id, resized);
    }, '로고를 업로드했습니다.');
    setLogoBusy(false);
    if (ok) await refresh();
  }

  async function handleLogoRemove() {
    if (!academy?.id) return;
    if (!confirm('로고를 삭제하고 기본 이미지로 되돌릴까요?')) return;
    const ok = await run(() => removeAcademyLogo(academy.id), '로고를 삭제했습니다.');
    if (ok) await refresh();
  }

  function copy(text: string, what: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => notify(`${what}를 복사했습니다.`))
      .catch(() => notify('복사에 실패했습니다.', 'error'));
  }

  /* ---------- 렌더 ---------- */

  return (
    <div className="space-y-6">
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        설정
      </h2>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <h4 className="font-title-md text-title-md text-on-surface mb-1.5">학원 로고</h4>
        <p className="font-caption text-caption text-on-surface-variant mb-4">
          업로드하면 화면 위쪽 브랜드 마크(기본은 🐷)가 학원 로고로 바뀝니다. 정사각형에 가까운
          이미지가 가장 예쁘게 나옵니다.
        </p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-surface-container-low flex items-center justify-center text-3xl overflow-hidden shrink-0">
            {academy?.logo_url ? (
              <img src={academy.logo_url} alt="학원 로고" className="w-full h-full object-cover" />
            ) : (
              <span>🐷</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={logoBusy}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 hover:bg-primary-container transition-colors"
            >
              {logoBusy ? '업로드 중…' : academy?.logo_url ? '로고 바꾸기' : '로고 업로드'}
            </button>
            {academy?.logo_url && (
              <button
                onClick={() => void handleLogoRemove()}
                disabled={logoBusy}
                className="px-4 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-60"
              >
                기본 이미지로
              </button>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void handleLogoSelect(e)}
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
        <h4 className="font-title-md text-title-md text-on-surface">학원 · 포인트 기본 설정</h4>
        <div>
          <label htmlFor="aname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
            학원 이름
          </label>
          <input
            id="aname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <div>
          <label htmlFor="aunit" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
            포인트 단위
          </label>
          <input
            id="aunit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="별, 달러, 포인트 …"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <button
          onClick={() => void saveAcademy()}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors"
        >
          저장
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <h4 className="font-title-md text-title-md text-on-surface mb-1.5">지급 / 차감 사유 프리셋</h4>
        <p className="font-caption text-caption text-on-surface-variant mb-3">
          통장 카드에 버튼으로 표시됩니다. 자주 쓰는 사유를 등록해 두세요.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {presets.length === 0 ? (
            <span className="font-caption text-caption text-on-surface-variant">등록된 사유가 없습니다.</span>
          ) : (
            presets.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface"
              >
                {p.label} ({signed(p.delta)})
                <button onClick={() => void removePreset(p.id)} className="text-on-surface-variant hover:text-error">
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="사유 (예: 지각)"
            value={newPresetLabel}
            onChange={(e) => setNewPresetLabel(e.target.value)}
            className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          <input
            type="number"
            placeholder="±숫자"
            value={newPresetDelta}
            onChange={(e) => setNewPresetDelta(e.target.value)}
            className="w-24 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          <button
            onClick={() => void addPreset()}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors whitespace-nowrap"
          >
            추가
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <h4 className="font-title-md text-title-md text-on-surface mb-3">반 관리</h4>
        {classes.length === 0 ? (
          <div className="font-body-md text-body-md text-on-surface-variant mb-3">등록된 반이 없습니다.</div>
        ) : (
          <div className="space-y-1 mb-4">
            {classes.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2.5 border-b border-surface-container last:border-0"
              >
                <span className="font-label-md text-label-md text-on-surface">{c.name}</span>
                <span className="flex gap-4">
                  <button
                    onClick={() => void handleRenameClass(c.id, c.name)}
                    className="font-label-md text-label-md text-primary hover:underline"
                  >
                    이름 변경
                  </button>
                  <button
                    onClick={() => void handleDeleteClass(c.id, c.name)}
                    className="font-label-md text-label-md text-error hover:underline"
                  >
                    삭제
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            placeholder="새 반 이름 (예: 고등 2반)"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addClass();
            }}
            className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          <button
            onClick={() => void addClass()}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors whitespace-nowrap"
          >
            반 추가
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <h4 className="font-title-md text-title-md text-on-surface mb-1.5">학생 로그인 코드</h4>
        <p className="font-caption text-caption text-on-surface-variant">
          베타 기간 동안은 원장·선생님만 로그인할 수 있어 학생 로그인을 잠시 꺼두었습니다. 학생은
          아직 직접 접속할 수 없고, 반별 통장은 선생님 화면에서 관리합니다.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <h4 className="font-title-md text-title-md text-on-surface mb-1.5">선생님 초대 코드</h4>
        <p className="font-caption text-caption text-on-surface-variant mb-3">
          다른 선생님이 회원가입 후 이 코드를 입력하면 같은 학원에 합류합니다.
          {isOwner ? '' : ' (재발급은 원장만 가능합니다)'}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            title="클릭하면 복사됩니다"
            onClick={() => copy(inviteCode, '초대 코드')}
            className="cursor-pointer px-4 py-2 rounded-lg bg-secondary-container text-on-secondary-container font-title-md text-title-md tracking-wider"
          >
            {inviteCode}
          </span>
          {isOwner && (
            <button
              onClick={() => void handleRotate()}
              className="px-4 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              새 코드 발급
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
