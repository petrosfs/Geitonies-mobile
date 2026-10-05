import { BOARDS } from './boards';
import type { BoardId, CityId, L10n, Lang } from './types';

/*
 * Neighbourhood names per city, cheapest group first, for the large board (11 colour groups:
 * 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2 streets). The classic board uses 8 of those groups.
 * Players can move any name to any square before the game (Setup → Names).
 */

type N = [string, string]; // [Greek, English]

export interface City {
  id: CityId;
  name: L10n;
  /** 11 groups for the large board */
  streets: N[][];
  /** 6 stations (the classic board uses the first 4) */
  stations: N[];
}

/** which large-board groups make the 8 classic groups */
export const CLASSIC_FROM_LARGE = [0, 1, 2, 3, 5, 7, 8, 10];

export const CITIES: Record<CityId, City> = {
  athens: {
    id: 'athens',
    name: { el: 'Αθήνα', en: 'Athens' },
    streets: [
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
    ],
    stations: [
      ['Σταθμός Λαρίσης', 'Larissa Station'], ['Σταθμός Πειραιά', 'Piraeus Station'],
      ['Σταθμός Μοναστηρακίου', 'Monastiraki Station'], ['Σταθμός Συντάγματος', 'Syntagma Station'],
      ['Σταθμός Ομονοίας', 'Omonia Station'], ['Σταθμός Αεροδρομίου', 'Airport Station'],
    ],
  },
  patras: {
    id: 'patras',
    name: { el: 'Πάτρα', en: 'Patras' },
    streets: [
      [['Ζαρουχλέικα', 'Zarouchleika'], ['Ταραμπούρα', 'Tarampoura']],
      [['Προσφυγικά', 'Prosfygika'], ['Κοτρώνι', 'Kotroni'], ['Μεσάτιδα', 'Mesatida']],
      [['Ροΐτικα', 'Roitika'], ['Τσουκαλέικα', 'Tsoukaleika'], ['Αγία Σοφία', 'Agia Sofia']],
      [['Περιβόλα', 'Perivola'], ['Μποζαΐτικα', 'Bozaitika'], ['Συχαινά', 'Sychaina']],
      [['Σκαγιοπούλειο', 'Skagiopouleio'], ['Εγλυκάδα', 'Eglykada'], ['Ζαβλάνι', 'Zavlani']],
      [['Αρόη', 'Aroi'], ['Καστελλόκαμπος', 'Kastellokampos'], ['Αγία Τριάδα', 'Agia Triada']],
      [['Ψηλαλώνια', 'Psilalonia'], ['Άνω Πόλη', 'Ano Poli'], ['Δασύλλιο', 'Dasyllio']],
      [['Αγυιά', 'Agyia'], ['Ρίο', 'Rio'], ['Ακτή Δυμαίων', 'Akti Dymaion']],
      [['Πλατεία Όλγας', 'Olgas Square'], ['Τριών Συμμάχων', 'Trion Symmachon'], ['Ρήγα Φεραίου', 'Riga Feraiou']],
      [['Αγίου Νικολάου', 'Agiou Nikolaou'], ['Μαιζώνος', 'Maizonos'], ['Κορίνθου', 'Korinthou']],
      [['Πλατεία Γεωργίου', 'Georgiou Square'], ['Παραλία Πάτρας', 'Patras Seafront']],
    ],
    stations: [
      ['Σταθμός Πατρών', 'Patras Station'], ['Νέο Λιμάνι', 'New Port'],
      ['ΚΤΕΛ Αχαΐας', 'Achaia Bus Station'], ['Σταθμός Ρίου', 'Rio Station'],
      ['Αεροδρόμιο Αράξου', 'Araxos Airport'], ['Παλιό Λιμάνι', 'Old Port'],
    ],
  },
  thessaloniki: {
    id: 'thessaloniki',
    name: { el: 'Θεσσαλονίκη', en: 'Thessaloniki' },
    streets: [
      [['Μενεμένη', 'Menemeni'], ['Κορδελιό', 'Kordelio']],
      [['Εύοσμος', 'Evosmos'], ['Πολίχνη', 'Polichni'], ['Ευκαρπία', 'Efkarpia']],
      [['Σταυρούπολη', 'Stavroupoli'], ['Νεάπολη', 'Neapoli'], ['Συκιές', 'Sykies']],
      [['Ξηροκρήνη', 'Xirokrini'], ['Βαρδάρης', 'Vardaris'], ['Λαδάδικα', 'Ladadika']],
      [['Άνω Πόλη', 'Ano Poli'], ['Τούμπα', 'Toumba'], ['Χαριλάου', 'Charilaou']],
      [['Ντεπώ', 'Depot'], ['Μπότσαρη', 'Botsari'], ['Ροτόντα', 'Rotonda']],
      [['Ναυαρίνου', 'Navarinou'], ['Καμάρα', 'Kamara'], ['Αγία Σοφία', 'Agia Sofia']],
      [['Καλαμαριά', 'Kalamaria'], ['Πυλαία', 'Pylaia'], ['Ωραιόκαστρο', 'Oraiokastro']],
      [['Πανόραμα', 'Panorama'], ['Θέρμη', 'Thermi'], ['Περαία', 'Peraia']],
      [['Νέα Παραλία', 'New Waterfront'], ['Τσιμισκή', 'Tsimiski'], ['Λευκός Πύργος', 'White Tower']],
      [['Λεωφόρος Νίκης', 'Nikis Avenue'], ['Πλατεία Αριστοτέλους', 'Aristotelous Square']],
    ],
    stations: [
      ['Σιδηροδρομικός Σταθμός', 'Railway Station'], ['Λιμάνι Θεσσαλονίκης', 'Thessaloniki Port'],
      ['ΚΤΕΛ Μακεδονία', 'Makedonia Bus Station'], ['Μετρό Βενιζέλου', 'Venizelou Metro'],
      ['Αεροδρόμιο Μακεδονία', 'Makedonia Airport'], ['Μετρό Αγίας Σοφίας', 'Agias Sofias Metro'],
    ],
  },
};

export const CITY_IDS = Object.keys(CITIES) as CityId[];

/** the city's street names, in board order (cheapest group first), for a board size */
export function cityStreets(city: CityId, boardId: BoardId): N[][] {
  const c = CITIES[city] ?? CITIES.athens;
  return boardId === 'classic' ? CLASSIC_FROM_LARGE.map((g) => c.streets[g]) : c.streets;
}

/** the default name of square `sq` in a city (streets and stations; other squares keep their own name) */
export function cityName(city: CityId | undefined, boardId: BoardId, sq: number, lang: Lang): string {
  const b = BOARDS[boardId];
  const s = b.squares[sq];
  if (!s) return '';
  const c = CITIES[city ?? 'athens'] ?? CITIES.athens;
  if (s.kind === 'street' && s.group !== undefined) {
    const k = b.groups[s.group].members.indexOf(sq);
    const n = cityStreets(c.id, boardId)[s.group]?.[k];
    if (n) return lang === 'el' ? n[0] : n[1];
  }
  if (s.kind === 'station') {
    const k = b.squares.slice(0, sq).filter((x) => x.kind === 'station').length;
    const n = c.stations[k];
    if (n) return lang === 'el' ? n[0] : n[1];
  }
  return s.name[lang];
}

/** a name map is valid if it only swaps streets with streets and stations with stations */
export function validNameMap(boardId: BoardId, map: number[] | undefined): number[] | undefined {
  const b = BOARDS[boardId];
  if (!map || map.length !== b.squares.length) return undefined;
  const seen = new Set<number>();
  for (let i = 0; i < map.length; i++) {
    const j = map[i];
    if (!Number.isInteger(j) || j < 0 || j >= map.length || seen.has(j)) return undefined;
    if (b.squares[i].kind !== b.squares[j].kind) return undefined;
    seen.add(j);
  }
  return map;
}

/** the name a square shows by default, after any names were moved between squares */
export function defaultName(boardId: BoardId, city: CityId | undefined, map: number[] | undefined, sq: number, lang: Lang): string {
  return cityName(city, boardId, map?.[sq] ?? sq, lang);
}
