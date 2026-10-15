/**
 * 공항 롤플레이(2026-10-15) 자료 — PPT "ESL Airport Role Play Lesson for Beginners"의 대본·낱말·전광판 문제를 옮겼다.
 * 대본은 PPT 슬라이드 5~10(체크인·보안 검색·탑승구)의 줄 순서(위→아래)와 같고, 빈칸 낱말은 슬라이드 6·8·10에서
 * 지워진 낱말이다. PPT의 오타 둘(set 34A → seat 34A, flight attending → flight attendant)은 바로잡았다.
 * 우리말 해석(ko)은 Claude 초안(선생님 검수 전)이다.
 */

export type AirportPlaceId = 'checkin' | 'security' | 'gate';
export type AirportRole = 'staff' | 'customer';

export interface AirportLine {
  who: AirportRole;
  /** PPT에 적힌 말하는 사람 이름 */
  speaker: string;
  text: string;
  ko: string;
  /** 기억하기 단계에서 가려지는 낱말·구절(text 안에 그대로 들어 있어야 한다) */
  blank?: string[];
}

export interface AirportPlace {
  id: AirportPlaceId;
  /** 슬라이드 4의 장소 이름 */
  name: string;
  /** 슬라이드 제목(대본 이름) */
  title: string;
  /** 직원 역할 이름 */
  staff: string;
  ko: string;
  /** 장면 그림(public/skins/airport) */
  scene: string;
  /** 장소 그림 */
  art: string;
  /** 직원 캐릭터 그림 */
  staffArt: string;
  color: string;
  lines: AirportLine[];
}

export const AIRPORT_PLACES: AirportPlace[] = [
  {
    id: 'checkin',
    name: 'Check in Desk',
    title: 'Check Your Bags',
    staff: 'Airport Worker',
    ko: '체크인 데스크',
    scene: 'scene-checkin',
    art: 'checkin',
    staffArt: 'worker',
    color: '#3b82f6',
    lines: [
      { who: 'customer', speaker: 'Customer', text: 'Can I check in please?', ko: '체크인해도 될까요?', blank: ['check in'] },
      { who: 'staff', speaker: 'Airport Worker', text: 'Sure. How many bags do you have?', ko: '그럼요. 가방이 몇 개 있으세요?', blank: ['bags'] },
      { who: 'customer', speaker: 'Customer', text: 'Just 1 Bag.', ko: '하나뿐이에요.' },
      { who: 'staff', speaker: 'Airport Worker', text: 'Ok. Can you put it on the scale please?', ko: '알겠습니다. 저울 위에 올려 주시겠어요?' },
      { who: 'customer', speaker: 'Customer', text: 'Ok', ko: '네.' },
      { who: 'staff', speaker: 'Airport Worker', text: 'Great! You can go to the security check now.', ko: '좋아요! 이제 보안 검색대로 가시면 돼요.', blank: ['security check'] },
      { who: 'customer', speaker: 'Customer', text: 'Thank you!', ko: '고맙습니다!' },
    ],
  },
  {
    id: 'security',
    name: 'Security Check',
    title: 'Security Check',
    staff: 'Security Worker',
    ko: '보안 검색대',
    scene: 'scene-security',
    art: 'security',
    staffArt: 'officer',
    color: '#0f766e',
    lines: [
      { who: 'staff', speaker: 'Security Worker', text: 'Please put your bags into the tray.', ko: '가방을 바구니에 넣어 주세요.', blank: ['tray'] },
      { who: 'customer', speaker: 'Customer', text: 'Ok', ko: '네.' },
      { who: 'staff', speaker: 'Security Worker', text: 'Do you have any electronics?', ko: '전자 기기가 있으세요?', blank: ['electronics'] },
      { who: 'customer', speaker: 'Customer', text: 'Yes, I have a laptop.', ko: '네, 노트북이 있어요.' },
      { who: 'staff', speaker: 'Security Worker', text: 'Please put your laptop into a tray. Do you have any water bottles?', ko: '노트북을 바구니에 넣어 주세요. 물병이 있으세요?' },
      { who: 'customer', speaker: 'Customer', text: 'Yes, I have a plastic water bottle.', ko: '네, 플라스틱 물병이 있어요.' },
      { who: 'staff', speaker: 'Security Worker', text: 'Please throw it away in the rubbish bin.', ko: '쓰레기통에 버려 주세요.' },
      { who: 'customer', speaker: 'Customer', text: 'OK. Can I walk through the body scanner now?', ko: '네. 이제 보디 스캐너를 지나가도 될까요?', blank: ['body scanner'] },
      { who: 'staff', speaker: 'Security Worker', text: 'Yes please, then you can collect your things from the trays.', ko: '네, 그런 다음 바구니에서 짐을 가져가시면 돼요.' },
    ],
  },
  {
    id: 'gate',
    name: 'Boarding Gate',
    title: 'Boarding Gate',
    staff: 'Flight Attendant',
    ko: '탑승구',
    scene: 'scene-gate',
    art: 'gate',
    staffArt: 'attendant-full',
    color: '#dc2626',
    lines: [
      { who: 'staff', speaker: 'Flight attendant', text: 'Good morning! Can I see your boarding pass and passport please?', ko: '안녕하세요! 탑승권과 여권을 보여 주시겠어요?', blank: ['boarding pass', 'passport'] },
      { who: 'customer', speaker: 'Customer', text: 'Good morning. Here it is!', ko: '안녕하세요. 여기 있어요!' },
      {
        who: 'staff',
        speaker: 'Flight attendant',
        text: 'Thank you. You can walk through the gate and board the plane now. Please show your boarding pass to the flight attendant on the aeroplane.',
        ko: '감사합니다. 게이트를 지나 비행기에 타세요. 비행기 안 승무원에게 탑승권을 보여 주세요.',
      },
      { who: 'staff', speaker: 'Flight attendant 2', text: 'Welcome to your flight. Can I see your boarding pass please?', ko: '탑승을 환영합니다. 탑승권을 보여 주시겠어요?', blank: ['boarding pass'] },
      { who: 'customer', speaker: 'Customer', text: 'Sure.', ko: '물론이죠.' },
      { who: 'staff', speaker: 'Flight attendant 2', text: 'You are in seat 34A, next to the window. Enjoy your flight!', ko: '좌석은 창가 쪽 34A예요. 즐거운 비행 되세요!' },
      { who: 'customer', speaker: 'Customer', text: 'Thank you!', ko: '고맙습니다!' },
    ],
  },
];

export function airportPlace(id: string): AirportPlace {
  return AIRPORT_PLACES.find((p) => p.id === id) ?? AIRPORT_PLACES[0];
}

/** 슬라이드 3 — 그림을 눌러 낱말을 확인한다(PPT 순서) */
export interface AirportWord {
  word: string;
  ko: string;
  art: string;
}

export const DEFAULT_AIRPORT_WORDS: AirportWord[] = [
  { word: 'Ticket / Boarding Pass', ko: '탑승권', art: 'boardingpass' },
  { word: 'Arrivals and Departures Board', ko: '도착·출발 안내 전광판', art: 'board' },
  { word: 'Passport', ko: '여권', art: 'passport' },
  { word: 'Flight Attendants', ko: '승무원', art: 'attendant' },
  { word: 'Suitcase', ko: '여행 가방', art: 'suitcase' },
];

const ART_KEYS: [RegExp, string][] = [
  [/boarding|ticket/i, 'boardingpass'],
  [/board|departure|arrival/i, 'board'],
  [/passport/i, 'passport'],
  [/attendant|crew|stewardess/i, 'attendant'],
  [/suitcase|luggage|baggage|\bbag\b/i, 'suitcase'],
  [/plane|airplane|aeroplane|flight/i, 'plane'],
  [/security|scanner|tray/i, 'security'],
  [/gate/i, 'gate'],
  [/check/i, 'checkin'],
];

/** 선생님이 직접 넣은 낱말("영어 | 뜻")에 맞는 그림을 찾는다(없으면 null) */
export function airportArtFor(word: string): string | null {
  for (const [re, art] of ART_KEYS) if (re.test(word)) return art;
  return null;
}

/** 슬라이드 4 — 공항에서 가는 순서 */
export const AIRPORT_ROUTE: { name: string; ko: string; art: string }[] = [
  { name: 'Check in Desk', ko: '체크인 데스크', art: 'checkin' },
  { name: 'Security Check', ko: '보안 검색대', art: 'security' },
  { name: 'Boarding Gate', ko: '탑승구', art: 'gate' },
  { name: 'Aeroplane', ko: '비행기', art: 'plane' },
];

/** 슬라이드 12 — 도착·출발 전광판(PPT 그림의 표를 우리 화면에서 다시 그린다) */
export const AIRPORT_ARRIVALS: [string, string][] = [
  ['10:55', 'Los Angeles'],
  ['11:10', 'Dublin'],
  ['11:15', 'Dusseldorf'],
  ['11:20', 'London'],
  ['11:25', 'Gran Canaria'],
  ['11:35', 'Belfast'],
  ['11:40', 'Oslo'],
  ['11:45', 'Vienna'],
  ['11:55', 'Toronto'],
  ['12:00', 'Chicago'],
  ['12:15', 'Barcelona'],
];

export const AIRPORT_DEPARTURES: [string, string][] = [
  ['10:30', 'New York'],
  ['10:35', 'Orlando'],
  ['10:45', 'Cancun'],
  ['10:50', 'Brussels'],
  ['10:55', 'Washington'],
  ['11:00', 'Atlanta'],
  ['11:05', 'Tenerife'],
  ['11:10', 'Philadelphia'],
  ['11:15', 'Lyon'],
  ['11:25', 'Faro'],
  ['11:45', 'Amsterdam'],
];

export interface BoardQuestion {
  q: string;
  ko: string;
  answer: string;
  /** 정답이 있는 줄(표 강조) */
  board: 'arrivals' | 'departures';
  row: number;
}

export const BOARD_QUESTIONS: BoardQuestion[] = [
  { q: 'When does the flight to London arrive?', ko: '런던행 비행기는 언제 도착하나요?', answer: '11:20', board: 'arrivals', row: 3 },
  { q: 'When does the flight to Lyon depart?', ko: '리옹행 비행기는 언제 출발하나요?', answer: '11:15', board: 'departures', row: 8 },
  { q: 'Where is the flight departing at 10:35 going?', ko: '10시 35분에 출발하는 비행기는 어디로 가나요?', answer: 'Orlando', board: 'departures', row: 1 },
  { q: 'Where is the flight arriving at 12:00 coming from?', ko: '12시에 도착하는 비행기는 어디에서 오나요?', answer: 'Chicago', board: 'arrivals', row: 9 },
];

/** 대본에서 빈칸 낱말을 가린 조각으로 나눈다 */
export interface LineSegment {
  text: string;
  hidden: boolean;
}

export function splitLine(line: AirportLine, hide: boolean): LineSegment[] {
  if (!hide || !line.blank || line.blank.length === 0) return [{ text: line.text, hidden: false }];
  const lower = line.text.toLowerCase();
  const spans: [number, number][] = [];
  for (const b of line.blank) {
    const i = lower.indexOf(b.toLowerCase());
    if (i >= 0) spans.push([i, i + b.length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: LineSegment[] = [];
  let at = 0;
  for (const [s, e] of spans) {
    if (s < at) continue;
    if (s > at) out.push({ text: line.text.slice(at, s), hidden: false });
    out.push({ text: line.text.slice(s, e), hidden: true });
    at = e;
  }
  if (at < line.text.length) out.push({ text: line.text.slice(at), hidden: false });
  return out;
}
