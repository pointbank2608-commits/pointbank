import { builderParts, type CourseSlide, type LessonGroup } from '../../data/phonicsLessons';
import type { PhonicsBankEntry } from '../../lib/types';
import { Stage1Picture, Stage1Speaker, Stage1Word } from './Stage1Art';

export type UnitOneActivity = 'builder' | 'choose' | 'sort' | 'read';

export function unitOneActivity(unitId: string, slide: CourseSlide): UnitOneActivity | null {
  if (unitId !== 'course-2-1') return null;
  if (slide.kind === 'builder' || slide.kind === 'choose' || slide.kind === 'sort') return slide.kind;
  if (slide.kind === 'readAlone' || (slide.kind === 'memory' && slide.phase === 0)) return 'read';
  return null;
}

export function sortBoardEntries(words: PhonicsBankEntry[], groups: LessonGroup[]) {
  const bins = groups.map(group => ({ label: group.label, id: group.id, words: words.filter(word => group.entries.some(entry => entry.id === word.id)) }));
  const rowCount = Math.max(0, ...bins.map(bin => bin.words.length));
  const interleaved = Array.from({ length: rowCount }, (_, row) => bins.flatMap(bin => bin.words.slice(row, row + 1))).flat();
  return { bins, mixed: [...interleaved.slice(1), ...interleaved.slice(0, 1)] };
}

function SortBoard({ words, groups, revealed }: {
  words: PhonicsBankEntry[];
  groups: LessonGroup[];
  revealed: boolean;
}) {
  const { bins, mixed } = sortBoardEntries(words, groups);

  return <>
    <div className="rc-unit-one-word-bank">{mixed.map(word => <span key={word.id}>{word.word}</span>)}</div>
    <div className="rc-unit-one-bins">
      {bins.map(bin => <section key={bin.id} data-rule={bin.label} className="rc-unit-one-bin">
        <h3>{bin.label}</h3>
        <div className="rc-unit-one-bin-words">{revealed && bin.words.map(word => <Stage1Word key={word.id} entry={word} />)}</div>
      </section>)}
    </div>
  </>;
}

export default function ReadyClassUnitOneActivity({ activity, slide, words, groups }: {
  activity: UnitOneActivity;
  slide: CourseSlide;
  words: PhonicsBankEntry[];
  groups: LessonGroup[];
}) {
  const revealed = slide.phase > 0;
  const promptWord = words.find(word => slide.answerIds.includes(word.id));
  const title = activity === 'builder' ? 'Listen and Blend' : activity === 'read' ? 'Read on Your Own' : slide.title;

  return <div className="rc-unit-one-board" data-ready-activity={activity}>
    <h2 className="rc-unit-one-heading">{title}</h2>
    <p className="rc-unit-one-instruction">{slide.hint}</p>
    {(activity === 'choose' || activity === 'sort') && <span className="pc-activity-guide rc-unit-one-guide" data-guide={activity} aria-hidden="true" />}

    {activity === 'builder' && <>
      <div className="rc-unit-one-equation">
        {builderParts(words[0], 2).map((part, index) => <span className="rc-unit-one-equation-part" key={index}>
          {index > 0 && <span className="rc-unit-one-operator">+</span>}
          <span className="rc-unit-one-letter-card" data-builder-part={part}>{part}</span>
        </span>)}
        <span className="rc-unit-one-operator">→</span>
        <span className="rc-unit-one-letter-card rc-unit-one-result"><Stage1Word entry={words[0]} /></span>
      </div>
      <div className="rc-unit-one-blend-audio"><Stage1Speaker entry={words[0]} /></div>
    </>}

    {activity === 'choose' && <>
      <div className="rc-unit-one-listen-audio"><Stage1Speaker entry={promptWord} /></div>
      <div className="rc-unit-one-choices">
        {words.map(word => <div className={`rc-unit-one-choice${revealed && slide.answerIds.includes(word.id) ? ' pc-answer' : ''}`} key={word.id} data-entry={word.id}>
          <Stage1Picture entry={word} />
          {revealed && <div className="rc-unit-one-choice-label"><Stage1Word entry={word} /><Stage1Speaker entry={word} /></div>}
        </div>)}
      </div>
    </>}

    {activity === 'sort' && <SortBoard words={words} groups={groups} revealed={revealed} />}

    {activity === 'read' && <div className="rc-unit-one-independent">
      {words.map(word => <span key={word.id}>{word.word}</span>)}
    </div>}
  </div>;
}
