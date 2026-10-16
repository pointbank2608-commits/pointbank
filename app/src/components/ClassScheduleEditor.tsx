import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassSchedule } from '../lib/classSchedule';

interface Props {
  value: ClassSchedule | null | undefined;
  onSave: (next: ClassSchedule | null) => void;
  onCancel: () => void;
}

const DAYS = [1, 2, 3, 4, 5, 6, 0];

/** 반의 수업 요일·시간 입력 칸(설정 > 반 관리). */
export default function ClassScheduleEditor({ value, onSave, onCancel }: Props) {
  const { t } = useTranslation();
  const [days, setDays] = useState<number[]>(value?.days ?? []);
  const [time, setTime] = useState(value?.time ?? '15:30');
  const [minutes, setMinutes] = useState(value?.minutes ?? 40);
  const toggle = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  return (
    <div className="mt-2 space-y-3 rounded-xl bg-surface-container-low p-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('classSchedule.days')}>
        {DAYS.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={days.includes(d)}
            onClick={() => toggle(d)}
            className={`min-h-11 min-w-11 rounded-full px-3 font-label-md text-label-md ${
              days.includes(d) ? 'bg-primary text-on-primary' : 'border border-outline-variant bg-surface-container-lowest text-on-surface-variant'
            }`}
          >
            {t(`classSchedule.day${d}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
          {t('classSchedule.time')}
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-3" />
        </label>
        <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
          {t('classSchedule.minutes')}
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-3">
            {[20, 30, 40, 50, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={days.length === 0 || !time}
          onClick={() => onSave({ days: [...days].sort(), time, minutes })}
          className="min-h-11 rounded-full bg-primary px-5 font-label-md text-label-md text-on-primary disabled:opacity-50"
        >
          {t('classSchedule.save')}
        </button>
        {value && (
          <button type="button" onClick={() => onSave(null)} className="min-h-11 rounded-full border border-outline-variant px-4 font-label-md text-label-md text-on-surface-variant">
            {t('classSchedule.clear')}
          </button>
        )}
        <button type="button" onClick={onCancel} className="min-h-11 rounded-full px-4 font-label-md text-label-md text-on-surface-variant">
          {t('classSchedule.cancel')}
        </button>
      </div>
    </div>
  );
}
