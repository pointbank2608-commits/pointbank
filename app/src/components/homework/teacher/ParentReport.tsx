import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { fetchReportExtras, type LearningCard, type ReportExtras } from '../../../lib/homework';
import { strengthsAndFocus, subLabelKey, type Grade, type StatSheet } from '../../../lib/homework/stats';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const GRADE_BG: Record<Grade, string> = { 'S+': '#f5c542', S: '#f0a93b', A: '#4cc38a', B: '#5aa9f0', C: '#b39ddb' };

/**
 * 학부모 리포트 카드(Classbank Student ⑤, 2026-10-05) — 학습 카드 숫자로 A4 한 장 리포트를 만든다(AI 없음, 규칙 문장).
 * 선생님 한마디는 자동 문장으로 채워 두고 고칠 수 있다. 인쇄(새 창)와 카톡용 글 복사.
 * 다른 학생과 비교·순위는 넣지 않는다. 기록이 모자라면 등급 대신 "기록을 모으는 중".
 */
export default function ParentReport({ card, sheet, onBack }: { card: LearningCard; sheet: StatSheet; onBack: () => void }) {
  const { t } = useTranslation();
  const { academy, pointUnit } = useAuth();
  const { notify } = useToast();
  const [extras, setExtras] = useState<ReportExtras | null>(null);
  const name = card.student.name;
  const days = card.days as 30 | 90;
  const { strengths, focus } = useMemo(() => strengthsAndFocus(sheet), [sheet]);

  useEffect(() => {
    fetchReportExtras(card.student.id, days).then(setExtras, () => setExtras(null));
  }, [card.student.id, days]);

  const autoComment = useMemo(() => {
    const lines: string[] = [];
    if (card.habit.assigned > 0) lines.push(t('studentHw.rpt_cHomework', { name, days, finished: card.habit.finished, assigned: card.habit.assigned }));
    if (!sheet.enough) lines.push(t('studentHw.rpt_cCollecting'));
    else {
      if (strengths.length) lines.push(t('studentHw.rpt_cStrength', { skills: strengths.map((s) => t(subLabelKey(s.key))).join(', ') }));
      if (focus.length) lines.push(t('studentHw.rpt_cFocus', { skills: focus.map((s) => t(subLabelKey(s.key))).join(', ') }));
      const up = sheet.abilities.flatMap((a) => a.subs).filter((s) => !s.key.startsWith('habit.') && (s.delta ?? 0) >= 5);
      if (up.length) lines.push(t('studentHw.rpt_cUp', { skills: up.slice(0, 2).map((s) => t(subLabelKey(s.key))).join(', ') }));
    }
    if (card.retries.corrected > 0) lines.push(t('studentHw.rpt_cRetry', { count: card.retries.corrected }));
    lines.push(t('studentHw.rpt_cClosing'));
    return lines.join(' ');
  }, [card, sheet, strengths, focus, name, days, t]);
  const [comment, setComment] = useState<string | null>(null);
  const finalComment = comment ?? autoComment;

  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' });
  const period = `${fmt(from)} ~ ${fmt(to)}`;
  const review = card.wrong_words.slice(0, 6).map((w) => w.word);

  const html = useMemo(() => {
    const stat = (label: string, value: string) => `<div class="st"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
    const stats = [
      extras ? stat(t('studentHw.rpt_attended'), t('studentHw.rpt_daysN', { n: extras.attended_days })) : '',
      stat(t('studentHw.rpt_online'), `${card.habit.finished}/${card.habit.assigned}`),
      stat(t('studentHw.rpt_passbook'), t('studentHw.rpt_timesN', { n: card.passbook_homework.done })),
      extras ? stat(t('studentHw.rpt_points'), `${extras.points_earned} ${pointUnit}`) : '',
    ].join('');
    const abilities = sheet.abilities
      .map((a) => {
        const g = a.grade;
        const badge = `<span class="g" style="background:${g ? GRADE_BG[g] : '#e6e8ee'}">${g ?? '?'}</span>`;
        const subs = a.subs.map((s) => `<span class="sub">${esc(t(subLabelKey(s.key)))} <b>${s.grade ?? '?'}</b></span>`).join('');
        const note = a.key === 'reading' ? `<span class="sub muted">${esc(t('studentHw.readingSoon'))}</span>` : '';
        return `<div class="ab">${badge}<div><div class="abn">${esc(t(`studentHw.ability_${a.key}`))}</div><div>${subs}${note}</div></div></div>`;
      })
      .join('');
    const list = (items: string[]) => (items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="muted">${esc(t('studentHw.rpt_none'))}</p>`);
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(t('studentHw.rpt_title'))} · ${esc(name)}</title>
<style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box}
body{font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;margin:0;color:#142a46;font-size:11pt;line-height:1.5}
.wrap{max-width:186mm;margin:0 auto;padding:4mm}
.hd{display:flex;align-items:center;gap:4mm;border-bottom:2px solid #142a46;padding-bottom:3mm}
.hd img{height:14mm;width:auto}
.hd h1{font-size:18pt;margin:0}
.muted{color:#6b7280}
.who{margin:3mm 0 4mm;font-size:12pt}
.who b{font-size:16pt}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-bottom:4mm}
.st{border:1px solid #d7dbe5;border-radius:3mm;padding:3mm;text-align:center}
.st b{display:block;font-size:15pt}
.st span{font-size:9pt;color:#6b7280}
h2{font-size:12pt;margin:4mm 0 2mm;border-left:4px solid #f5c542;padding-left:2mm}
.abs{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm}
.ab{display:flex;gap:3mm;align-items:center;border:1px solid #e6e8ee;border-radius:3mm;padding:2.5mm}
.g{display:inline-flex;align-items:center;justify-content:center;width:11mm;height:11mm;border-radius:2.5mm;font-weight:900;font-style:italic;font-size:13pt;flex-shrink:0}
.abn{font-weight:800}
.sub{display:inline-block;font-size:9pt;margin-right:2.5mm}
.two{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
ul{margin:0;padding-left:5mm}
.cm{border:1.5px solid #142a46;border-radius:3mm;padding:3mm;white-space:pre-wrap;min-height:22mm}
.ft{margin-top:4mm;font-size:8.5pt;color:#6b7280}
</style></head><body><div class="wrap">
<div class="hd">${academy?.logo_url ? `<img src="${esc(academy.logo_url)}" alt="">` : ''}<div><div class="muted">${esc(academy?.name ?? '')}</div><h1>${esc(t('studentHw.rpt_title'))}</h1></div></div>
<div class="who"><b>${esc(name)}</b> ${extras?.class_name ? `· ${esc(extras.class_name)}` : ''} <span class="muted">· ${esc(period)}</span></div>
<div class="stats">${stats}</div>
<h2>${esc(t('studentHw.rpt_abilities'))}</h2>
${sheet.enough ? '' : `<p class="muted">${esc(t('studentHw.collectingTitle'))} · ${esc(t('studentHw.collectingBody'))}</p>`}
<div class="abs">${abilities}</div>
<div class="two">
<div><h2>${esc(t('studentHw.rpt_strengths'))}</h2>${list(strengths.map((s) => t(subLabelKey(s.key))))}</div>
<div><h2>${esc(t('studentHw.rpt_focus'))}</h2>${list([...focus.map((s) => t(subLabelKey(s.key))), ...(review.length ? [t('studentHw.rpt_words', { words: review.join(', ') })] : [])])}</div>
</div>
<h2>${esc(t('studentHw.rpt_comment'))}</h2>
<div class="cm">${esc(finalComment)}</div>
<div class="ft">${esc(t('studentHw.rpt_footer'))}</div>
</div></body></html>`;
  }, [academy, card, extras, finalComment, focus, name, period, pointUnit, review, sheet, strengths, t]);

  const text = useMemo(
    () =>
      [
        `[${t('studentHw.rpt_title')}] ${name} (${period})`,
        extras ? `· ${t('studentHw.rpt_attended')}: ${t('studentHw.rpt_daysN', { n: extras.attended_days })}` : '',
        `· ${t('studentHw.rpt_online')}: ${card.habit.finished}/${card.habit.assigned}`,
        `· ${t('studentHw.rpt_passbook')}: ${t('studentHw.rpt_timesN', { n: card.passbook_homework.done })}`,
        extras ? `· ${t('studentHw.rpt_points')}: ${extras.points_earned} ${pointUnit}` : '',
        sheet.enough ? `· ${t('studentHw.rpt_abilities')}: ${sheet.abilities.map((a) => `${t(`studentHw.ability_${a.key}`)} ${a.grade ?? '?'}`).join(' / ')}` : '',
        review.length ? `· ${t('studentHw.rpt_words', { words: review.join(', ') })}` : '',
        '',
        finalComment,
      ]
        .filter((x) => x !== '')
        .join('\n'),
    [card, extras, finalComment, name, period, pointUnit, review, sheet, t],
  );

  function print() {
    const w = window.open('', '_blank');
    if (!w) {
      notify(t('studentHw.popupBlocked'), 'error');
      return;
    }
    w.document.write(html.replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body>'));
    w.document.close();
  }

  const btn = 'flex min-h-11 items-center gap-1.5 rounded-full px-4 font-label-md text-label-md';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className={`${btn} border border-outline-variant text-on-surface`}>
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {t('studentHw.back')}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard.writeText(text).then(
              () => notify(t('studentHw.rpt_copied')),
              () => notify(t('studentHw.copyFailed'), 'error'),
            )
          }
          className={`${btn} border border-outline-variant text-on-surface`}
        >
          <span className="material-symbols-outlined text-[18px]">chat</span>
          {t('studentHw.rpt_copyText')}
        </button>
        <button type="button" onClick={print} className={`${btn} bg-primary text-on-primary`}>
          <span className="material-symbols-outlined text-[18px]">print</span>
          {t('studentHw.rpt_print')}
        </button>
      </div>
      <label className="block space-y-1">
        <span className="font-label-md text-label-md text-on-surface">{t('studentHw.rpt_comment')}</span>
        <textarea
          value={finalComment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-base outline-none focus:border-primary"
        />
        <span className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
          {t('studentHw.rpt_commentHint')}
          {comment !== null && (
            <button type="button" onClick={() => setComment(null)} className="min-h-9 rounded-full px-2 text-primary underline">
              {t('studentHw.rpt_resetComment')}
            </button>
          )}
        </span>
      </label>
      <iframe title={t('studentHw.rpt_preview')} srcDoc={html} className="h-[560px] w-full rounded-xl border border-outline-variant bg-white" />
    </div>
  );
}
