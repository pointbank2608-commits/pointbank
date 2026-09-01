import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImportCandidate } from '../lib/api';

interface Props {
  candidates: ImportCandidate[];
  /** 이 게임이 공용 items 목록(단어·참가자 등)을 쓰는지 — false면 구조화된 콘텐츠라 명단 교체 선택지를 안 보여준다. */
  offerRosterSwap: boolean;
  onImport: (sourceTemplateId: string, mode: 'keep' | 'roster') => Promise<void>;
}

/** 다른 반에 있는 같은 게임의 템플릿을 지금 반으로 복사해서 새로 만들어주는 목록. */
export default function ImportFromClass({ candidates, offerRosterSwap, onImport }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (candidates.length === 0) return null;

  async function runImport(id: string, mode: 'keep' | 'roster') {
    if (busy) return;
    setBusy(true);
    try {
      await onImport(id, mode);
    } finally {
      setBusy(false);
      setPendingId(null);
    }
  }

  function handleClick(candidateId: string) {
    if (busy) return;
    if (!offerRosterSwap) {
      void runImport(candidateId, 'keep');
      return;
    }
    setPendingId((prev) => (prev === candidateId ? null : candidateId));
  }

  return (
    <div className="mb-4">
      <div className="font-caption text-caption text-on-surface-variant mb-2">
        {t('gameAdmin.importFromClassLabel')}
      </div>
      <div className="flex flex-col gap-1.5">
        {candidates.map((c) => (
          <div key={c.templateId}>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleClick(c.templateId)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container disabled:opacity-60 text-on-surface-variant hover:text-primary font-label-md text-label-md transition-colors w-fit"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              {c.className} · {c.templateName}
              <span className="font-caption text-caption opacity-70">({c.itemCount})</span>
            </button>
            {pendingId === c.templateId && (
              <div className="flex flex-wrap gap-2 mt-1.5 ml-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runImport(c.templateId, 'keep')}
                  className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-caption text-caption hover:opacity-90 disabled:opacity-60"
                >
                  {t('gameAdmin.importKeepItems')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runImport(c.templateId, 'roster')}
                  className="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container font-caption text-caption hover:opacity-90 disabled:opacity-60"
                >
                  {t('gameAdmin.importUseRoster')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
