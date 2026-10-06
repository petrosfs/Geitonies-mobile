export type Lang = 'el' | 'en';
export type L10n = { el: string; en: string };
export type BoardId = 'classic' | 'large';
export type CityId = 'athens' | 'patras' | 'thessaloniki';
export type Kind =
  | 'go' | 'street' | 'station' | 'utility' | 'chance' | 'chest'
  | 'tax' | 'jail' | 'parking' | 'gotojail';

export interface Square {
  kind: Kind;
  name: L10n;
  group?: number;
  price?: number;
  /** street: [base, 1 house, 2, 3, 4, hotel] */
  rent?: number[];
  house?: number;
  tax?: number;
}

export interface Board {
  id: BoardId;
  squares: Square[];
  groups: { color: string; members: number[] }[];
  houses: number;
  hotels: number;
  startCash: number;
  salary: number;
  jailFine: number;
  jail: number;
  stationRent: number[];
  utilMult: number[];
}

export type Deck = 'chance' | 'chest';

export type Effect =
  | { t: 'money'; amount: number }
  | { t: 'each'; amount: number }
  | { t: 'goto'; sq: number; go: boolean }
  | { t: 'move'; steps: number }
  | { t: 'jail' }
  | { t: 'jailCard' }
  | { t: 'repairs'; house: number; hotel: number }
  | { t: 'nearest'; kind: 'station' | 'utility' };

export interface Card {
  id: number;
  deck: Deck;
  /** default cards are bilingual, custom cards are plain text */
  text: L10n | string;
  fx: Effect;
}

export interface Rules {
  auction: 'open' | 'sealed';
  freeParking: boolean;
  doubleGo: boolean;
  noRentInJail: boolean;
  buyAfterLap: boolean;
  /** a player who lands on a free property may pass: it stays with the bank, no auction (missing = off) */
  allowPass?: boolean;
  /** 0 = off */
  timeLimitMin: number;
  autoMoveSec: number;
  /** starting money for every player (default: the board's) */
  startCash?: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  emoji: string;
  photo?: string;
  device: string;
  cash: number;
  pos: number;
  jail: boolean;
  jailTries: number;
  jailCards: number[];
  out: boolean;
  lapped: boolean;
}

export interface Prop {
  owner: string | null;
  /** 0-4 houses, 5 = hotel */
  houses: number;
  mort: boolean;
}

export type Owed = { to: string; amount: number }; // to: player id | 'bank' | 'pot'

export type Pending =
  | { k: 'buy'; sq: number; who: string }
  | { k: 'card'; card: number; who: string }
  | { k: 'rename'; sq: number; who: string }
  | { k: 'debt'; who: string; owed: Owed[]; then?: { move: number } }
  | {
      k: 'auction';
      sq: number;
      high: number;
      bidder: string | null;
      passed: string[];
      sealed: Record<string, number>;
      eligible: string[];
    };

export interface Offer { cash: number; props: number[]; cards: number }
export interface Trade { from: string; to: string; give: Offer; get: Offer }

export interface LogEntry { k: string; a?: Record<string, string | number> }

export interface PlayerStats { rentIn: number; rentOut: number; jail: number; bought: number; maxWorth: number }
export interface Stats {
  players: Record<string, PlayerStats>;
  /** rent collected per square */
  sq: Record<number, number>;
  /** net worth of everyone, once per round */
  worth: { round: number; w: Record<string, number> }[];
}

export interface Game {
  /** unique id of this game (a rematch gets a new one) */
  gid?: string;
  v: number;
  boardId: BoardId;
  /** '' = default name (shown in each device's language) */
  names: string[];
  city?: CityId;
  nameMap?: number[];
  prices?: Record<number, number>;
  rules: Rules;
  players: Player[];
  cur: number;
  startIdx: number;
  rolled: boolean;
  again: boolean;
  doubles: number;
  dice: [number, number] | null;
  props: Record<number, Prop>;
  cards: Card[];
  decks: { chance: number[]; chest: number[] };
  q: Pending[];
  trade: Trade | null;
  pot: number;
  log: LogEntry[];
  rng: number;
  clock: { elapsed: number; last: number };
  timeUp: boolean;
  turnNo: number;
  /** counts dice rolls (drives the dice animation) */
  rolls?: number;
  /** counts log entries ever written (the log itself is trimmed) */
  logSeq?: number;
  /** statistics for the end-of-game screen (missing in older saves) */
  stats?: Stats;
  round?: number;
  over: null | { rank: { id: string; worth: number }[] };
}

export type Action =
  | { t: 'roll' }
  | { t: 'buy' }
  | { t: 'decline' }
  | { t: 'skip' }
  | { t: 'bid'; amount: number }
  | { t: 'pass' }
  | { t: 'sealed'; amount: number }
  | { t: 'cardOk' }
  | { t: 'rename'; name: string }
  | { t: 'skipRename' }
  | { t: 'payJail' }
  | { t: 'useCard' }
  | { t: 'build'; sq: number }
  | { t: 'sell'; sq: number }
  | { t: 'mortgage'; sq: number }
  | { t: 'unmortgage'; sq: number }
  | { t: 'payDebt' }
  | { t: 'bankrupt' }
  | { t: 'endTurn' }
  | { t: 'propose'; trade: Trade }
  | { t: 'accept' }
  | { t: 'reject' }
  | { t: 'counter'; trade: Trade }
  | { t: 'cancelTrade' }
  | { t: 'kick'; id: string }
  /** host only: a new player joins a game that has already started */
  | { t: 'addPlayer'; player: PlayerSetup }
  | { t: 'tick' };

export interface PlayerSetup {
  id: string;
  name: string;
  color: string;
  emoji: string;
  photo?: string;
  device: string;
}

export interface CustomCard { deck: Deck; text: string; fx: Effect }

export interface Setup {
  players: PlayerSetup[];
  boardId: BoardId;
  names: string[];
  /** which city's neighbourhood names (default Athens) */
  city?: CityId;
  /** nameMap[square] = the square whose default name is shown there (names moved between squares) */
  nameMap?: number[];
  /** custom prices per square (multiples of 10) */
  prices?: Record<number, number>;
  customCards: CustomCard[];
  rules: Rules;
}
