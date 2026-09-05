import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import BrandMark from '../components/BrandMark';
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
  updateMyDisplayName,
  updatePresetHomeworkFlag,
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
  const { t } = useTranslation();
  const { classes, reload: reloadClasses } = useClasses(academy?.id);

  const [name, setName] = useState(academy?.name ?? '');
  const [unit, setUnit] = useState(academy?.point_unit ?? '');
  const [myName, setMyName] = useState(profile?.display_name ?? '');
  const [myNameBusy, setMyNameBusy] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetDelta, setNewPresetDelta] = useState('');
  const [newPresetHomework, setNewPresetHomework] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [inviteCode, setInviteCode] = useState(academy?.invite_code ?? '');
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(academy?.name ?? '');
    setUnit(academy?.point_unit ?? '');
    setInviteCode(academy?.invite_code ?? '');
  }, [academy]);

  useEffect(() => {
    setMyName(profile?.display_name ?? '');
  }, [profile?.display_name]);

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
      t('settings.academySaveToast'),
    );
    if (ok) await refresh();
  }

  async function saveMyName() {
    if (!myName.trim()) return;
    setMyNameBusy(true);
    const ok = await run(() => updateMyDisplayName(myName.trim()), t('settings.myNameToast'));
    setMyNameBusy(false);
    if (ok) await refresh();
  }

  async function addPreset() {
    if (!academy?.id) return;
    const delta = parseInt(newPresetDelta, 10);
    if (!newPresetLabel.trim() || !delta) {
      notify(t('settings.presetInputError'), 'error');
      return;
    }
    const ok = await run(async () => {
      await createPreset(academy.id, newPresetLabel.trim(), delta, presets.length, newPresetHomework);
    }, t('settings.presetAddedToast'));
    if (ok) {
      setNewPresetLabel('');
      setNewPresetDelta('');
      setNewPresetHomework(false);
      await loadPresets();
    }
  }

  async function removePreset(id: string) {
    const ok = await run(() => deletePreset(id), t('settings.presetRemovedToast'));
    if (ok) setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  async function toggleHomeworkFlag(id: string, next: boolean) {
    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, is_homework: next } : p)));
    try {
      await updatePresetHomeworkFlag(id, next);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
      await loadPresets();
    }
  }

  async function addClass() {
    if (!academy?.id || !newClassName.trim()) return;
    const ok = await run(async () => {
      await createClass(academy.id, newClassName.trim(), classes.length);
    }, t('settings.classAddedToast'));
    if (ok) {
      setNewClassName('');
      await reloadClasses();
    }
  }

  async function handleRenameClass(id: string, current: string) {
    const next = prompt(t('settings.classRenamePrompt'), current);
    if (!next?.trim() || next.trim() === current) return;
    const ok = await run(() => renameClass(id, next.trim()), t('settings.classRenamedToast'));
    if (ok) await reloadClasses();
  }

  async function handleDeleteClass(id: string, className: string) {
    if (!confirm(t('settings.classDeleteConfirm', { name: className }))) return;
    const ok = await run(() => deleteClass(id), t('settings.classDeletedToast'));
    if (ok) await reloadClasses();
  }

  async function handleRotate() {
    if (!confirm(t('settings.rotateConfirm'))) return;
    try {
      const code = await rotateInviteCode();
      setInviteCode(code);
      notify(t('settings.rotateToast'));
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
      notify(t('settings.logoImageOnlyError'), 'error');
      return;
    }
    if (file.size > MAX_LOGO_FILE_SIZE) {
      notify(t('settings.logoTooLargeError'), 'error');
      return;
    }

    setLogoBusy(true);
    const ok = await run(async () => {
      const resized = await resizeImageToPng(file);
      await uploadAcademyLogo(academy.id, resized);
    }, t('settings.logoUploadedToast'));
    setLogoBusy(false);
    if (ok) await refresh();
  }

  async function handleLogoRemove() {
    if (!academy?.id) return;
    if (!confirm(t('settings.logoRemoveConfirm'))) return;
    const ok = await run(() => removeAcademyLogo(academy.id), t('settings.logoRemovedToast'));
    if (ok) await refresh();
  }

  function copy(text: string, what: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => notify(t('settings.copiedToast', { what })))
      .catch(() => notify(t('settings.copyFailedToast'), 'error'));
  }

  /* ---------- 렌더 ---------- */

  return (
    <div className="space-y-6">
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('settings.title')}
      </h2>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
        <h4 className="font-title-md text-title-md text-on-surface">{t('settings.myNameTitle')}</h4>
        <div>
          <label htmlFor="myname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
            {t('settings.myNameHint')}
          </label>
          <div className="flex gap-2">
            <input
              id="myname"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveMyName();
              }}
              placeholder={t('settings.myNamePlaceholder')}
              className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <button
              onClick={() => void saveMyName()}
              disabled={myNameBusy}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 hover:bg-primary-container transition-colors whitespace-nowrap"
            >
              {myNameBusy ? t('settings.saving') : t('settings.save')}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <h4 className="font-title-md text-title-md text-on-surface mb-1.5">{t('settings.logoTitle')}</h4>
        <p className="font-caption text-caption text-on-surface-variant mb-4">{t('settings.logoHint')}</p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-surface-container-low flex items-center justify-center text-3xl overflow-hidden shrink-0">
            {academy?.logo_url ? (
              <img src={academy.logo_url} alt={t('settings.logoAlt')} className="w-full h-full object-cover" />
            ) : (
              <BrandMark className="h-12 w-12" />
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={logoBusy}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 hover:bg-primary-container transition-colors"
            >
              {logoBusy ? t('settings.logoUploading') : academy?.logo_url ? t('settings.logoChange') : t('settings.logoUpload')}
            </button>
            {academy?.logo_url && (
              <button
                onClick={() => void handleLogoRemove()}
                disabled={logoBusy}
                className="px-4 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-60"
              >
                {t('settings.logoResetDefault')}
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
        <h4 className="font-title-md text-title-md text-on-surface">{t('settings.academyTitle')}</h4>
        <div>
          <label htmlFor="aname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
            {t('settings.academyName')}
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
            {t('settings.pointUnit')}
          </label>
          <input
            id="aunit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={t('settings.pointUnitPlaceholder')}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <button
          onClick={() => void saveAcademy()}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors"
        >
          {t('settings.save')}
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <h4 className="font-title-md text-title-md text-on-surface mb-1.5">{t('settings.presetsTitle')}</h4>
        <p className="font-caption text-caption text-on-surface-variant mb-3">
          {t('settings.presetsHintBefore')}
          <span className="material-symbols-outlined text-[14px] align-middle">calendar_month</span>
          {t('settings.presetsHintAfter')}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {presets.length === 0 ? (
            <span className="font-caption text-caption text-on-surface-variant">{t('settings.noPresets')}</span>
          ) : (
            presets.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full font-label-md text-label-md ${
                  p.is_homework
                    ? 'bg-secondary-container/40 text-on-secondary-container'
                    : 'bg-surface-container-low text-on-surface'
                }`}
              >
                <button
                  onClick={() => void toggleHomeworkFlag(p.id, !p.is_homework)}
                  title={t('settings.homeworkToggleTitle')}
                  className="flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {p.is_homework ? 'calendar_month' : 'calendar_add_on'}
                  </span>
                  {p.label} ({signed(p.delta)})
                </button>
                <button onClick={() => void removePreset(p.id)} className="text-on-surface-variant hover:text-error">
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder={t('settings.presetLabelPlaceholder')}
            value={newPresetLabel}
            onChange={(e) => setNewPresetLabel(e.target.value)}
            className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          <input
            type="number"
            placeholder={t('settings.amountPlaceholder')}
            value={newPresetDelta}
            onChange={(e) => setNewPresetDelta(e.target.value)}
            className="w-24 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          <label className="flex items-center gap-1.5 font-caption text-caption text-on-surface-variant whitespace-nowrap">
            <input
              type="checkbox"
              checked={newPresetHomework}
              onChange={(e) => setNewPresetHomework(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            {t('settings.homeworkCheckbox')}
          </label>
          <button
            onClick={() => void addPreset()}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors whitespace-nowrap"
          >
            {t('settings.add')}
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <h4 className="font-title-md text-title-md text-on-surface mb-3">{t('settings.classManageTitle')}</h4>
        {classes.length === 0 ? (
          <div className="font-body-md text-body-md text-on-surface-variant mb-3">{t('settings.noClasses')}</div>
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
                    {t('settings.renameClass')}
                  </button>
                  <button
                    onClick={() => void handleDeleteClass(c.id, c.name)}
                    className="font-label-md text-label-md text-error hover:underline"
                  >
                    {t('settings.deleteClass')}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            placeholder={t('settings.newClassPlaceholder')}
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
            {t('settings.addClass')}
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <h4 className="font-title-md text-title-md text-on-surface mb-1.5">{t('settings.studentLoginTitle')}</h4>
        <p className="font-caption text-caption text-on-surface-variant">{t('settings.studentLoginHint')}</p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <h4 className="font-title-md text-title-md text-on-surface mb-1.5">{t('settings.inviteTitle')}</h4>
        <p className="font-caption text-caption text-on-surface-variant mb-3">
          {t('settings.inviteHint')}
          {isOwner ? '' : t('settings.inviteHintOwnerOnly')}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            title={t('settings.inviteCopyHint')}
            onClick={() => copy(inviteCode, t('settings.inviteCodeLabel'))}
            className="cursor-pointer px-4 py-2 rounded-lg bg-secondary-container text-on-secondary-container font-title-md text-title-md tracking-wider"
          >
            {inviteCode}
          </span>
          {isOwner && (
            <button
              onClick={() => void handleRotate()}
              className="px-4 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              {t('settings.rotateInvite')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
