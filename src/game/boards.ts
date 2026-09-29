import type { Board, BoardId, Kind, L10n, Square } from './types';

/*
 * Όλες οι τιμές του παιχνιδιού βρίσκονται εδώ και αλλάζουν εύκολα.
 * All game values live here and are easy to change.
 */

const GROUP_COLORS_CLASSIC = [
  '#8a5a34', '#8fcbea', '#d23f8c', '#ef8a2e',
  '#d9362f', '#f2cf37', '#2f9a52', '#2c4fae',
];
const GROUP_COLORS_LARGE = [
  '#8a5a34', '#8fcbea', '#d23f8c', '#ef8a2e', '#1f9f98', '#d9362f',
  '#98c23e', '#f2cf37', '#7a4fc0', '#2f9a52', '#2c4fae',
];

/** classic street data per group: [price, rent[6], houseCost] for each street */
type StreetDef = [number, number[], number];
const CLASSIC_GROUPS: StreetDef[][] = [
  [[60, [2, 10, 30, 90, 160, 250], 50], [60, [4, 20, 60, 180, 320, 450], 50]],
  [[100, [6, 30, 90, 270, 400, 550], 50], [100, [6, 30, 90, 270, 400, 550], 50], [120, [8, 40, 100, 300, 450, 600], 50]],
  [[140, [10, 50, 150, 450, 625, 750], 100], [140, [10, 50, 150, 450, 625, 750], 100], [160, [12, 60, 180, 500, 700, 900], 100]],
  [[180, [14, 70, 200, 550, 750, 950], 100], [180, [14, 70, 200, 550, 750, 950], 100], [200, [16, 80, 220, 600, 800, 1000], 100]],
  [[220, [18, 90, 250, 700, 875, 1050], 150], [220, [18, 90, 250, 700, 875, 1050], 150], [240, [20, 100, 300, 750, 925, 1100], 150]],
  [[260, [22, 110, 330, 800, 975, 1150], 150], [260, [22, 110, 330, 800, 975, 1150], 150], [280, [24, 120, 360, 850, 1025, 1200], 150]],
  [[300, [26, 130, 390, 900, 1100, 1275], 200], [300, [26, 130, 390, 900, 1100, 1275], 200], [320, [28, 150, 450, 1000, 1200, 1400], 200]],
  [[350, [35, 175, 500, 1100, 1300, 1500], 200], [400, [50, 200, 600, 1400, 1700, 2000], 200]],
];

const STREET_NAMES_CLASSIC: [string, string][][] = [
  [['Πετράλωνα', 'Petralona'], ['Κυψέλη', 'Kypseli']],
  [['Παγκράτι', 'Pangrati'], ['Γκύζη', 'Gyzi'], ['Νέος Κόσμος', 'Neos Kosmos']],
  [['Εξάρχεια', 'Exarchia'], ['Μεταξουργείο', 'Metaxourgeio'], ['Κουκάκι', 'Koukaki']],
  [['Ψυρρή', 'Psyrri'], ['Θησείο', 'Thiseio'], ['Μοναστηράκι', 'Monastiraki']],
  [['Χαλάνδρι', 'Chalandri'], ['Μαρούσι', 'Marousi'], ['Κηφισιά', 'Kifisia']],
  [['Γλυφάδα', 'Glyfada'], ['Βούλα', 'Voula'], ['Βουλιαγμένη', 'Vouliagmeni']],
  [['Ψυχικό', 'Psychiko'], ['Φιλοθέη', 'Filothei'], ['Εκάλη', 'Ekali']],
  [['Κολωνάκι', 'Kolonaki'], ['Πλάκα', 'Plaka']],
];

const STREET_NAMES_LARGE: [string, string][][] = [
  [['Πετράλωνα', 'Petralona'], ['Κυψέλη', 'Kypseli']],
  [['Παγκράτι', 'Pangrati'], ['Γκύζη', 'Gyzi'], ['Νέος Κόσμος', 'Neos Kosmos']],
  [['Εξάρχεια', 'Exarchia'], ['Μεταξουργείο', 'Metaxourgeio'], ['Κουκάκι', 'Koukaki']],
  [['Ψυρρή', 'Psyrri'], ['Θησείο', 'Thiseio'], ['Μοναστηράκι', 'Monastiraki']],
  [['Βύρωνας', 'Vyronas'], ['Ζωγράφου', 'Zografou'], ['Καισαριανή', 'Kaisariani']],
  [['Χαλάνδρι', 'Chalandri'], ['Μαρούσι', 'Marousi'], ['Κηφισιά', 'Kifisia']],
  [['Νέα Σμύρνη', 'Nea Smyrni'], ['Παλαιό Φάληρο', 'Palaio Faliro'], ['Άλιμος', 'Alimos']],
  [['Γλυφάδα', 'Glyfada'], ['Βούλα', 'Voula'], ['Βουλιαγμένη', 'Vouliagmeni']],
  [['Ψυχικό', 'Psychiko'], ['Φιλοθέη', 'Filothei'], ['Εκάλη', 'Ekali']],
  [['Λυκαβηττός', 'Lycabettus'], ['Μετς', 'Mets'], ['Μακρυγιάννη', 'Makrygianni']],
  [['Κολωνάκι', 'Kolonaki'], ['Πλάκα', 'Plaka']],
];

const STATION_NAMES: [string, string][] = [
  ['Σταθμός Λαρίσης', 'Larissa Station'],
  ['Σταθμός Πειραιά', 'Piraeus Station'],
  ['Σταθμός Μοναστηρακίου', 'Monastiraki Station'],
  ['Σταθμός Συντάγματος', 'Syntagma Station'],
  ['Σταθμός Ομονοίας', 'Omonia Station'],
  ['Σταθμός Αεροδρομίου', 'Airport Station'],
];
const UTIL_NAMES: [string, string][] = [
  ['Εταιρεία Ρεύματος', 'Power Company'],
  ['Εταιρεία Νερού', 'Water Company'],
  ['Εταιρεία Ίντερνετ', 'Internet Company'],
];

const FIXED: Record<string, L10n> = {
  go: { el: 'Αφετηρία', en: 'Start' },
  jail: { el: 'Φυλακή', en: 'Jail' },
  parking: { el: 'Δωρεάν Πάρκινγκ', en: 'Free Parking' },
  gotojail: { el: 'Πήγαινε Φυλακή', en: 'Go to Jail' },
  chance: { el: 'Ευκαιρία', en: 'Chance' },
  chest: { el: 'Κοινοτικό Ταμείο', en: 'Community Chest' },
  tax1: { el: 'Φόρος Εισοδήματος', en: 'Income Tax' },
  tax2: { el: 'Φόρος Πολυτελείας', en: 'Luxury Tax' },
  tax3: { el: 'Φόρος Ακινήτων', en: 'Property Tax' },
  tax4: { el: 'Δημοτικά Τέλη', en: 'City Fees' },
};

/** layout tokens: gN = street of group N, S = station, U = utility, C = chance, H = chest, T = tax */
const CLASSIC_LAYOUT = [
  'go', 'g0', 'H', 'g0', 'T', 'S', 'g1', 'C', 'g1', 'g1',
  'jail', 'g2', 'U', 'g2', 'g2', 'S', 'g3', 'H', 'g3', 'g3',
  'parking', 'g4', 'C', 'g4', 'g4', 'S', 'g5', 'g5', 'U', 'g5',
  'gotojail', 'g6', 'g6', 'H', 'g6', 'S', 'C', 'g7', 'T', 'g7',
];
const CLASSIC_TAXES = [200, 100];

const LARGE_LAYOUT = [
  'go', 'g0', 'H', 'g0', 'T', 'S', 'g1', 'C', 'g1', 'g1', 'S', 'g2', 'U', 'g2',
  'jail', 'g2', 'H', 'g3', 'g3', 'g3', 'S', 'g4', 'C', 'g4', 'g4', 'T', 'g5', 'g5',
  'parking', 'g5', 'C', 'g6', 'g6', 'g6', 'S', 'g7', 'H', 'g7', 'U', 'g7', 'S', 'T',
  'gotojail', 'g8', 'g8', 'H', 'g8', 'S', 'g9', 'C', 'g9', 'g9', 'U', 'g10', 'T', 'g10',
];
const LARGE_TAXES = [200, 100, 150, 100];

function lerp(a: number, b: number, f: number) { return a + (b - a) * f; }

function round(n: number, step: number) { return Math.max(step, Math.round(n / step) * step); }

/**
 * Large board streets: interpolated from the classic groups (11 groups spread over the 8 classic ones).
 * Prices are rounded to tens. (To be revisited later.)
 */
function largeStreets(): StreetDef[][] {
  const counts = STREET_NAMES_LARGE.map((g) => g.length);
  return counts.map((count, gi) => {
    const f = (gi * (CLASSIC_GROUPS.length - 1)) / (counts.length - 1);
    const lo = Math.floor(f);
    const hi = Math.min(CLASSIC_GROUPS.length - 1, lo + 1);
    const w = f - lo;
    const low = (g: StreetDef[]) => g[0];
    const high = (g: StreetDef[]) => g[g.length - 1];
    const mk = (pick: (g: StreetDef[]) => StreetDef): StreetDef => {
      const a = pick(CLASSIC_GROUPS[lo]);
      const b = pick(CLASSIC_GROUPS[hi]);
      return [
        round(lerp(a[0], b[0], w), 10),
        a[1].map((r, i) => round(lerp(r, b[1][i], w), r < 50 ? 1 : 5)),
        round(lerp(a[2], b[2], w), 50),
      ];
    };
    const cheap = mk(low);
    const dear = mk(high);
    return Array.from({ length: count }, (_, i) => (i === count - 1 ? dear : cheap));
  });
}

function build(id: BoardId): Board {
  const layout = id === 'classic' ? CLASSIC_LAYOUT : LARGE_LAYOUT;
  const streets = id === 'classic' ? CLASSIC_GROUPS : largeStreets();
  const names = id === 'classic' ? STREET_NAMES_CLASSIC : STREET_NAMES_LARGE;
  const colors = id === 'classic' ? GROUP_COLORS_CLASSIC : GROUP_COLORS_LARGE;
  const taxes = id === 'classic' ? CLASSIC_TAXES : LARGE_TAXES;
  const used = streets.map(() => 0);
  let st = 0, ut = 0, tx = 0;
  const groups = colors.map((color) => ({ color, members: [] as number[] }));
  const squares: Square[] = layout.map((tok, i) => {
    if (/^g\d+$/.test(tok)) {
      const g = Number(tok.slice(1));
      const k = used[g]++;
      const [price, rent, house] = streets[g][k];
      const [el, en] = names[g][k];
      groups[g].members.push(i);
      return { kind: 'street', group: g, price, rent, house, name: { el, en } };
    }
    if (tok === 'S') {
      const [el, en] = STATION_NAMES[st++];
      return { kind: 'station', price: 200, name: { el, en } };
    }
    if (tok === 'U') {
      const [el, en] = UTIL_NAMES[ut++];
      return { kind: 'utility', price: 150, name: { el, en } };
    }
    if (tok === 'C') return { kind: 'chance', name: FIXED.chance };
    if (tok === 'H') return { kind: 'chest', name: FIXED.chest };
    if (tok === 'T') {
      const n = tx++;
      return { kind: 'tax', tax: taxes[n], name: FIXED['tax' + (n + 1)] };
    }
    return { kind: tok as Kind, name: FIXED[tok] };
  });
  return {
    id,
    squares,
    groups,
    houses: id === 'classic' ? 32 : 48,
    hotels: id === 'classic' ? 12 : 18,
    startCash: id === 'classic' ? 1500 : 2000,
    salary: 200,
    jailFine: 50,
    jail: squares.findIndex((s) => s.kind === 'jail'),
    stationRent: id === 'classic' ? [25, 50, 100, 200] : [25, 50, 100, 200, 300, 400],
    utilMult: id === 'classic' ? [4, 10] : [4, 10, 20],
  };
}

export const BOARDS: Record<BoardId, Board> = { classic: build('classic'), large: build('large') };

export function isOwnable(s: Square) {
  return s.kind === 'street' || s.kind === 'station' || s.kind === 'utility';
}
