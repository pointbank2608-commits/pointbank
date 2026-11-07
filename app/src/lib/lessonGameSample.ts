import { AIRPORT_PLACES } from './airportRoleplay';
import { PATIENTS } from './doctorVisit';
import { auctionLots, labRounds, verbRounds, writeRounds } from './grammarGames';
import { compareRounds, frameRounds, habitRounds, linkRounds, posRounds } from './grammarGamesB';
import { askRounds, condRounds, passiveRounds, relativeRounds, shopRounds } from './grammarGamesC';
import { REMEMBER_LINES } from './iceCreamShop';
import { RESTAURANTS } from './restaurantRoleplay';
import type { GameType } from './types';

interface GameExample { prompt: string; choices?: string[] }

/** Read-only examples of native activities that need a dedicated setup. */
export function dedicatedGameSample(type: GameType): GameExample | undefined {
  switch (type) {
    case 'grammarlab': {
      const round = labRounds('third-s')[0];
      return round && { prompt: round.from, choices: round.chips };
    }
    case 'grammarverb': {
      const round = verbRounds('third-s')[0];
      return round && { prompt: `${round.before} ___ ${round.after}`, choices: round.options };
    }
    case 'grammarauction': {
      const round = auctionLots('third-s')[0];
      return round && { prompt: round.sentence, choices: ['Correct', 'Fix it'] };
    }
    case 'grammarwrite': {
      const round = writeRounds('third-s')[0];
      return round && { prompt: `${round.ko} · ${round.cond}` };
    }
    case 'grammarpos': {
      const round = posRounds('third-s')[0];
      return round && { prompt: `Find the ${round.cat}.`, choices: round.tokens };
    }
    case 'grammarframe': {
      const round = frameRounds('third-s')[0];
      return round && { prompt: 'Build the sentence.', choices: round.order.map(part => round[part]) };
    }
    case 'grammarcompare': {
      const round = compareRounds('comparative')[0];
      return round && { prompt: `${round.before} ___ ${round.after}`, choices: round.options };
    }
    case 'grammarlink': {
      const round = linkRounds('because')[0];
      return round && { prompt: `${round.a} ___ ${round.b}.`, choices: round.options };
    }
    case 'grammarhabit': {
      const round = habitRounds('frequency')[0];
      return round?.kind === 'calendar' ? { prompt: `${round.before} ___ ${round.after}`, choices: round.options } : undefined;
    }
    case 'grammarpassive': {
      const round = passiveRounds('m-passive')[0];
      return round && { prompt: `${round.before} ___ ${round.after}`, choices: round.options };
    }
    case 'grammarcond': {
      const round = condRounds('m-if-conditional')[0];
      return round && { prompt: `${round.before} ___ ${round.after}`, choices: round.options };
    }
    case 'grammarrelative': {
      const round = relativeRounds('m-relative-subject')[0];
      return round && { prompt: round.clue, choices: round.options };
    }
    case 'grammarask': {
      const round = askRounds('does-he')[0];
      return round && { prompt: round.questions[0].text, choices: round.chars.slice(0, 3).map(char => char.n) };
    }
    case 'grammarshop': {
      const round = shopRounds('countable-uncountable')[0];
      return round && { prompt: `${round.before} ___ ${round.after}`, choices: round.options };
    }
    case 'airport': return { prompt: AIRPORT_PLACES[0].lines[0].text, choices: [AIRPORT_PLACES[0].lines[1].text] };
    case 'doctor': return { prompt: PATIENTS[0].doctorAsk, choices: [PATIENTS[0].patientAnswer] };
    case 'restaurant': return { prompt: RESTAURANTS[0].lines[0].text, choices: RESTAURANTS[0].sections[0].items.slice(0, 3).map(item => item.name) };
    case 'icecream': return { prompt: REMEMBER_LINES[0].text, choices: ['chocolate', 'vanilla', 'strawberry'] };
    case 'mathgen': return { prompt: '8 + 4 = ___' };
    case 'watermelon': return { prompt: 'Build a sentence.', choices: ['She', 'likes', 'apples.'] };
    case 'groupsort': return { prompt: 'Sort the words.', choices: ['Food · apple', 'Animals · cat'] };
    default: return undefined;
  }
}
