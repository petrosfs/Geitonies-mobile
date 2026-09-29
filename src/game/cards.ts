import type { Board, Card, CustomCard, Deck, Effect, L10n } from './types';

/*
 * Default κάρτες: ίδιοι μηχανισμοί με την κλασική, δικά μας κείμενα.
 * {sq} is replaced by the (possibly renamed) square name.
 */
type Def = { el: string; en: string; fx: (b: Board) => Effect };

function streetOf(b: Board, group: number, idx: number) {
  const g = b.groups[Math.min(group, b.groups.length - 1)];
  return g.members[Math.min(idx, g.members.length - 1)];
}
const lastStreet = (b: Board) => b.groups[b.groups.length - 1].members.slice(-1)[0];
const firstStation = (b: Board) => b.squares.findIndex((s) => s.kind === 'station');
const midHigh = (b: Board) => streetOf(b, Math.round((b.groups.length - 1) * 0.57), 2);

const CHANCE: Def[] = [
  { el: 'Προχώρα στην Αφετηρία και πάρε τον μισθό σου.', en: 'Advance to Start and collect your salary.', fx: () => ({ t: 'goto', sq: 0, go: true }) },
  { el: 'Κάνε μια βόλτα στην περιοχή {sq}.', en: 'Take a walk to {sq}.', fx: (b) => ({ t: 'goto', sq: lastStreet(b), go: true }) },
  { el: 'Πήγαινε στην περιοχή {sq}. Αν περάσεις από την Αφετηρία, πάρε μισθό.', en: 'Go to {sq}. If you pass Start, collect your salary.', fx: (b) => ({ t: 'goto', sq: midHigh(b), go: true }) },
  { el: 'Πήγαινε στην περιοχή {sq}. Αν περάσεις από την Αφετηρία, πάρε μισθό.', en: 'Go to {sq}. If you pass Start, collect your salary.', fx: (b) => ({ t: 'goto', sq: streetOf(b, 2, 0), go: true }) },
  { el: 'Πήγαινε στον πλησιέστερο σταθμό. Αν έχει ιδιοκτήτη, πλήρωσε διπλό ενοίκιο.', en: 'Go to the nearest station. If it is owned, pay double rent.', fx: () => ({ t: 'nearest', kind: 'station' }) },
  { el: 'Πήγαινε στον πλησιέστερο σταθμό. Αν έχει ιδιοκτήτη, πλήρωσε διπλό ενοίκιο.', en: 'Go to the nearest station. If it is owned, pay double rent.', fx: () => ({ t: 'nearest', kind: 'station' }) },
  { el: 'Πήγαινε στην πλησιέστερη εταιρεία. Αν έχει ιδιοκτήτη, ρίξε ζάρια και πλήρωσε 10 φορές το αποτέλεσμα.', en: 'Go to the nearest company. If it is owned, roll and pay 10 times the result.', fx: () => ({ t: 'nearest', kind: 'utility' }) },
  { el: 'Η τράπεζα σού δίνει μέρισμα 50 €.', en: 'The bank pays you a 50 € dividend.', fx: () => ({ t: 'money', amount: 50 }) },
  { el: 'Βγαίνεις από τη φυλακή δωρεάν. Κράτησε την κάρτα μέχρι να τη χρειαστείς.', en: 'Get out of jail free. Keep this card until you need it.', fx: () => ({ t: 'jailCard' }) },
  { el: 'Γύρνα πίσω 3 θέσεις.', en: 'Go back 3 spaces.', fx: () => ({ t: 'move', steps: -3 }) },
  { el: 'Πήγαινε κατευθείαν φυλακή, χωρίς να περάσεις από την Αφετηρία.', en: 'Go straight to jail without passing Start.', fx: () => ({ t: 'jail' }) },
  { el: 'Συντήρηση κτιρίων: 25 € για κάθε σπίτι, 100 € για κάθε ξενοδοχείο.', en: 'Building upkeep: 25 € per house, 100 € per hotel.', fx: () => ({ t: 'repairs', house: 25, hotel: 100 }) },
  { el: 'Κλήση για υπερβολική ταχύτητα: πλήρωσε 15 €.', en: 'Speeding ticket: pay 15 €.', fx: () => ({ t: 'money', amount: -15 }) },
  { el: 'Ταξίδι με τρένο στον {sq}. Αν περάσεις από την Αφετηρία, πάρε μισθό.', en: 'Take a train to {sq}. If you pass Start, collect your salary.', fx: (b) => ({ t: 'goto', sq: firstStation(b), go: true }) },
  { el: 'Εκλέχτηκες πρόεδρος της γειτονιάς: πλήρωσε 50 € σε κάθε παίκτη.', en: 'You were elected neighbourhood chair: pay each player 50 €.', fx: () => ({ t: 'each', amount: -50 }) },
  { el: 'Το δάνειο για την οικοδομή σου λήγει: πάρε 150 €.', en: 'Your building loan matures: collect 150 €.', fx: () => ({ t: 'money', amount: 150 }) },
];

const CHEST: Def[] = [
  { el: 'Προχώρα στην Αφετηρία και πάρε τον μισθό σου.', en: 'Advance to Start and collect your salary.', fx: () => ({ t: 'goto', sq: 0, go: true }) },
  { el: 'Λάθος της τράπεζας υπέρ σου: πάρε 200 €.', en: 'Bank error in your favour: collect 200 €.', fx: () => ({ t: 'money', amount: 200 }) },
  { el: 'Επίσκεψη στον γιατρό: πλήρωσε 50 €.', en: 'Doctor visit: pay 50 €.', fx: () => ({ t: 'money', amount: -50 }) },
  { el: 'Πούλησες μετοχές: πάρε 50 €.', en: 'You sold some shares: collect 50 €.', fx: () => ({ t: 'money', amount: 50 }) },
  { el: 'Βγαίνεις από τη φυλακή δωρεάν. Κράτησε την κάρτα μέχρι να τη χρειαστείς.', en: 'Get out of jail free. Keep this card until you need it.', fx: () => ({ t: 'jailCard' }) },
  { el: 'Πήγαινε κατευθείαν φυλακή, χωρίς να περάσεις από την Αφετηρία.', en: 'Go straight to jail without passing Start.', fx: () => ({ t: 'jail' }) },
  { el: 'Το ταμείο διακοπών σου απέδωσε: πάρε 100 €.', en: 'Your holiday savings paid off: collect 100 €.', fx: () => ({ t: 'money', amount: 100 }) },
  { el: 'Επιστροφή φόρου: πάρε 20 €.', en: 'Tax refund: collect 20 €.', fx: () => ({ t: 'money', amount: 20 }) },
  { el: 'Έχεις γενέθλια! Πάρε 10 € από κάθε παίκτη.', en: 'It is your birthday! Collect 10 € from each player.', fx: () => ({ t: 'each', amount: 10 }) },
  { el: 'Η ασφάλειά σου λήγει: πάρε 100 €.', en: 'Your insurance matures: collect 100 €.', fx: () => ({ t: 'money', amount: 100 }) },
  { el: 'Νοσοκομειακά έξοδα: πλήρωσε 100 €.', en: 'Hospital bill: pay 100 €.', fx: () => ({ t: 'money', amount: -100 }) },
  { el: 'Δίδακτρα: πλήρωσε 50 €.', en: 'Tuition fees: pay 50 €.', fx: () => ({ t: 'money', amount: -50 }) },
  { el: 'Αμοιβή για συμβουλές: πάρε 25 €.', en: 'Consulting fee: collect 25 €.', fx: () => ({ t: 'money', amount: 25 }) },
  { el: 'Επισκευές δρόμου: 40 € για κάθε σπίτι, 115 € για κάθε ξενοδοχείο.', en: 'Street repairs: 40 € per house, 115 € per hotel.', fx: () => ({ t: 'repairs', house: 40, hotel: 115 }) },
  { el: 'Κέρδισες δεύτερο βραβείο σε διαγωνισμό: πάρε 10 €.', en: 'You won second prize in a contest: collect 10 €.', fx: () => ({ t: 'money', amount: 10 }) },
  { el: 'Κληρονομιά: πάρε 100 €.', en: 'Inheritance: collect 100 €.', fx: () => ({ t: 'money', amount: 100 }) },
];

export function buildCards(b: Board, custom: CustomCard[]): Card[] {
  const out: Card[] = [];
  const add = (deck: Deck, text: L10n | string, fx: Effect) => out.push({ id: out.length, deck, text, fx });
  CHANCE.forEach((d) => add('chance', { el: d.el, en: d.en }, d.fx(b)));
  CHEST.forEach((d) => add('chest', { el: d.el, en: d.en }, d.fx(b)));
  custom.forEach((c) => add(c.deck, c.text, c.fx));
  return out;
}

/** effects offered to players when they write their own cards */
export const CUSTOM_EFFECTS = ['gain', 'pay', 'collectEach', 'payEach', 'goto', 'move', 'jail', 'jailCard', 'repairs'] as const;
export type CustomEffectKind = (typeof CUSTOM_EFFECTS)[number];
