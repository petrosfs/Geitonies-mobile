import type { Board, Lang } from './game/types';

/*
 * The rules shown in the app. Amounts come from the board being played ({salary}, {fine}, ...),
 * so the text always matches what the rules engine actually does.
 */

export interface RuleSection {
  id: string;
  icon: string;
  title: string;
  /** one line, always visible */
  short: string;
  /** shown when the section is opened */
  details: string[];
}

export type RuleValues = Record<'start' | 'salary' | 'fine' | 'houses' | 'hotels' | 'stations' | 'utils' | 'squares', string>;

const el: RuleSection[] = [
  {
    id: 'goal', icon: '🎯', title: 'Στόχος',
    short: 'Αγόρασε γειτονιές, χτίσε, εισέπραξε ενοίκια και μείνε τελευταίος που δεν χρεοκόπησε.',
    details: [
      'Κάθε παίκτης ξεκινά με {start} και το πιόνι του στην Αφετηρία. Το ταμπλό έχει {squares} τετράγωνα.',
      'Νικητής είναι όποιος μείνει τελευταίος, ή, αν η παρτίδα έχει όριο χρόνου, όποιος έχει τη μεγαλύτερη αξία στο τέλος.',
    ],
  },
  {
    id: 'turn', icon: '🎲', title: 'Η σειρά σου',
    short: 'Ρίχνεις δύο ζάρια και προχωράς. Με διπλές ξαναρίχνεις.',
    details: [
      'Πατάς «Ρίξε ζάρια» ή κουνάς το κινητό, και το πιόνι προχωρά όσα τετράγωνα δείχνουν τα ζάρια.',
      'Αν φέρεις διπλές (ίδιο νούμερο και στα δύο ζάρια), ξαναρίχνεις. Με τρίτες διπλές στη σειρά πας κατευθείαν φυλακή.',
      'Κάθε φορά που περνάς ή σταματάς στην Αφετηρία παίρνεις μισθό {salary}.',
      'Στη σειρά σου μπορείς επίσης να χτίσεις, να βάλεις ή να σηκώσεις υποθήκες (από «Τα ακίνητά μου») και να προτείνεις ανταλλαγή. Όταν τελειώσεις, πατάς «Τέλος σειράς».',
    ],
  },
  {
    id: 'buy', icon: '🏠', title: 'Αγορές και δημοπρασίες',
    short: 'Σε ελεύθερη περιοχή: την αγοράζεις στην τιμή της ή πάει σε δημοπρασία.',
    details: [
      'Αγοράζονται οι γειτονιές, οι σταθμοί και οι εταιρείες. Η τιμή φαίνεται πάνω στο τετράγωνο.',
      'Αν δεν θέλεις ή δεν μπορείς να την αγοράσεις, πάει σε δημοπρασία, όπου μπορούν να πάρουν μέρος όλοι, ακόμα και εσύ.',
      'Ανοιχτή δημοπρασία: όλοι βλέπουν τις προσφορές και ανεβάζουν με +10, +50 ή +100. Όποιος δεν θέλει άλλο πατά «Πάσο». Κερδίζει η τελευταία προσφορά όταν όλοι οι άλλοι έχουν πει πάσο.',
      'Κρυφή δημοπρασία: ο καθένας γράφει μία προσφορά που δεν τη βλέπουν οι άλλοι (0 = πάσο). Κερδίζει η μεγαλύτερη. Σε ισοπαλία κερδίζει όποιος είναι πιο κοντά στη σειρά μετά τον παίκτη που παίζει.',
      'Αν δεν δώσει κανείς προσφορά, η περιοχή μένει στην τράπεζα. Όποιος αποκτά μια περιοχή μπορεί να της δώσει δικό του όνομα.',
    ],
  },
  {
    id: 'rent', icon: '💶', title: 'Ενοίκια',
    short: 'Σε περιοχή άλλου παίκτη πληρώνεις ενοίκιο. Ολόκληρη ομάδα χρώματος = διπλό ενοίκιο.',
    details: [
      'Γειτονιά: βασικό ενοίκιο. Αν ο ιδιοκτήτης έχει όλες τις γειτονιές του ίδιου χρώματος, το ενοίκιο διπλασιάζεται. Με σπίτια και ξενοδοχείο ανεβαίνει πολύ (πάτα το τετράγωνο για να δεις τον πίνακα).',
      'Σταθμοί: το ενοίκιο ανεβαίνει όσο περισσότερους σταθμούς έχει ο ιδιοκτήτης: {stations}.',
      'Εταιρείες: πληρώνεις τα ζάρια που έφερες × {utils}, ανάλογα με το πόσες εταιρείες έχει ο ιδιοκτήτης.',
      'Οι περιοχές σε υποθήκη δεν φέρνουν ενοίκιο.',
    ],
  },
  {
    id: 'build', icon: '🏗️', title: 'Χτίσιμο',
    short: 'Με όλη την ομάδα χρώματος χτίζεις σπίτια ισόποσα, και μετά ξενοδοχείο.',
    details: [
      'Χτίζεις μόνο όταν έχεις όλες τις γειτονιές ενός χρώματος και καμία δεν είναι σε υποθήκη.',
      'Χτίζεις ισόποσα: δεν μπορείς να βάλεις δεύτερο σπίτι σε μια γειτονιά πριν έχουν από ένα όλες οι άλλες της ομάδας.',
      'Όταν όλες έχουν 4 σπίτια, μπορείς να τα αντικαταστήσεις με ξενοδοχείο (τα 4 σπίτια επιστρέφουν στην τράπεζα).',
      'Η τράπεζα έχει {houses} σπίτια και {hotels} ξενοδοχεία. Όταν τελειώσουν, κανείς δεν χτίζει μέχρι να επιστραφούν.',
      'Τα κτίρια πουλιούνται πίσω στην τράπεζα στο μισό της τιμής τους, επίσης ισόποσα.',
    ],
  },
  {
    id: 'mortgage', icon: '🏦', title: 'Υποθήκες',
    short: 'Παίρνεις τη μισή τιμή μιας περιοχής. Για να τη σηκώσεις πληρώνεις +10%.',
    details: [
      'Βάζοντας υποθήκη παίρνεις αμέσως από την τράπεζα τη μισή τιμή της περιοχής. Η περιοχή μένει δική σου αλλά δεν φέρνει ενοίκιο.',
      'Για να σηκώσεις την υποθήκη πληρώνεις τη μισή τιμή +10%.',
      'Δεν μπαίνει υποθήκη σε περιοχή αν υπάρχουν κτίρια σε οποιαδήποτε γειτονιά του ίδιου χρώματος: πούλησέ τα πρώτα.',
    ],
  },
  {
    id: 'jail', icon: '⛓️', title: 'Φυλακή',
    short: 'Μπαίνεις με το «Πήγαινε φυλακή», με κάρτα ή με τρίτες διπλές. Βγαίνεις με διπλή, {fine} ή κάρτα.',
    details: [
      'Αν απλώς σταματήσεις στο τετράγωνο της Φυλακής, είσαι επισκέπτης και δεν συμβαίνει τίποτα.',
      'Στη φυλακή, στη σειρά σου: πληρώνεις {fine} και ρίχνεις κανονικά, χρησιμοποιείς κάρτα αποφυλάκισης, ή ρίχνεις για διπλή.',
      'Αν φέρεις διπλή βγαίνεις και προχωράς, χωρίς να ξαναρίξεις. Μετά από 3 αποτυχημένες προσπάθειες πληρώνεις υποχρεωτικά {fine} και προχωράς.',
      'Στη φυλακή συνεχίζεις να εισπράττεις ενοίκια, εκτός αν ισχύει ο αντίστοιχος κανόνας σπιτιού.',
    ],
  },
  {
    id: 'cards', icon: '🃏', title: 'Κάρτες',
    short: 'Στα τετράγωνα Ευκαιρία και Κοινοτικό Ταμείο τραβάς κάρτα και κάνεις ό,τι λέει.',
    details: [
      'Οι κάρτες μπορεί να σου δίνουν ή να σου παίρνουν χρήματα, να σε μετακινούν, να σε στέλνουν φυλακή ή να χρεώνουν επισκευές για τα κτίρια σου.',
      'Την κάρτα αποφυλάκισης την κρατάς μέχρι να τη χρειαστείς, ή την ανταλλάσσεις.',
      'Στην αρχή της παρτίδας μπορείτε να προσθέσετε και δικές σας κάρτες.',
    ],
  },
  {
    id: 'trade', icon: '🤝', title: 'Ανταλλαγές',
    short: 'Στη σειρά σου προτείνεις σε άλλον χρήματα, ακίνητα ή κάρτες. Δέχεται, αρνείται ή κάνει αντιπρόταση.',
    details: [
      'Πατάς «Ανταλλαγή», διαλέγεις παίκτη και τι δίνεις και τι παίρνεις.',
      'Ο άλλος παίκτης δέχεται, αρνείται ή στέλνει αντιπρόταση.',
      'Δεν ανταλλάσσονται γειτονιές αν η ομάδα τους έχει κτίρια.',
      'Όποιος παίρνει περιοχή σε υποθήκη πληρώνει αμέσως τόκο 10% της αξίας υποθήκης.',
    ],
  },
  {
    id: 'debt', icon: '💸', title: 'Χρέη και χρεοκοπία',
    short: 'Αν δεν φτάνουν τα μετρητά, πουλάς κτίρια ή βάζεις υποθήκες. Αλλιώς χρεοκοπείς.',
    details: [
      'Όταν χρωστάς περισσότερα από όσα έχεις, το παιχνίδι περιμένει: πούλησε κτίρια ή βάλε υποθήκες από «Τα ακίνητά μου» και μετά πάτα «Πλήρωσε».',
      'Αν δεν γίνεται, κηρύσσεις χρεοκοπία και βγαίνεις από το παιχνίδι.',
      'Αν χρωστούσες σε παίκτη, εκείνος παίρνει όλα σου τα ακίνητα και τα μετρητά (τα κτίρια πουλιούνται πρώτα στην τράπεζα). Αν χρωστούσες στην τράπεζα, τα ακίνητά σου βγαίνουν σε δημοπρασία.',
    ],
  },
  {
    id: 'end', icon: '🏁', title: 'Τέλος παιχνιδιού',
    short: 'Κερδίζει ο τελευταίος που μένει, ή όποιος έχει τη μεγαλύτερη αξία όταν λήξει ο χρόνος.',
    details: [
      'Όταν μείνει ένας μόνο παίκτης, αυτός κερδίζει.',
      'Με όριο χρόνου: όταν τελειώσει ο χρόνος, ολοκληρώνεται ο γύρος που παίζεται και κερδίζει όποιος έχει τη μεγαλύτερη αξία.',
      'Αξία = μετρητά + τιμή των ακινήτων (τα υποθηκευμένα μετράνε το μισό) + κόστος των κτιρίων.',
      'Στο τέλος βλέπετε στατιστικά και μπορείτε να ξεκινήσετε ρεβάνς με τους ίδιους παίκτες.',
    ],
  },
  {
    id: 'house', icon: '🧩', title: 'Κανόνες σπιτιού (προαιρετικοί)',
    short: 'Τους επιλέγετε στην αρχή της παρτίδας.',
    details: [
      'Πάρκινγκ: φόροι και πρόστιμα μαζεύονται στο κέντρο του ταμπλό, και τα παίρνει όποιος σταματήσει στο Δωρεάν Πάρκινγκ.',
      'Διπλός μισθός: όποιος σταματήσει ακριβώς στην Αφετηρία παίρνει {salary} × 2.',
      'Όχι ενοίκιο από τη φυλακή: όσο ο ιδιοκτήτης είναι στη φυλακή, δεν εισπράττει ενοίκια.',
      'Αγορές μετά τον πρώτο γύρο: κανείς δεν αγοράζει (ούτε σε δημοπρασία) πριν κάνει έναν πλήρη γύρο.',
      'Πάσο: όποιος σταματά σε ελεύθερη περιοχή μπορεί, εκτός από αγορά ή δημοπρασία, να πει πάσο. Η περιοχή μένει στην τράπεζα.',
    ],
  },
  {
    id: 'online', icon: '📱', title: 'Online παιχνίδι',
    short: 'Ο οικοδεσπότης δίνει κωδικό ή QR και οι άλλοι συνδέονται από τα κινητά τους.',
    details: [
      'Ο οικοδεσπότης κρατά την «επίσημη» παρτίδα, και καλό είναι να έχει το παιχνίδι ανοιχτό στην οθόνη.',
      'Αν κάποιος αποσυνδεθεί, μετά από λίγο παίζει αυτόματα, και ο οικοδεσπότης μπορεί να τον αφαιρέσει.',
      'Αν χαθεί ο οικοδεσπότης, η παρτίδα περιμένει. Μετά από 5 λεπτά οποιοσδήποτε μπορεί να πατήσει «Ανάληψη οικοδεσπότη».',
      'Αν η οθόνη σου δεν ενημερώνεται, πάτα «🔄 Επανασύνδεση» στο μενού ✕.',
    ],
  },
];

const en: RuleSection[] = [
  {
    id: 'goal', icon: '🎯', title: 'Goal',
    short: 'Buy neighbourhoods, build, collect rent and be the last player standing.',
    details: [
      'Everyone starts with {start} and their piece on Start. The board has {squares} squares.',
      'The winner is the last player left or, in a game with a time limit, the player worth the most at the end.',
    ],
  },
  {
    id: 'turn', icon: '🎲', title: 'Your turn',
    short: 'Roll two dice and move. Doubles let you roll again.',
    details: [
      'Tap “Roll dice” (or shake the phone) and your piece moves that many squares.',
      'Doubles (the same number on both dice) give you another roll. A third double in a row sends you straight to jail.',
      'Every time you pass or land on Start you collect a salary of {salary}.',
      'On your turn you can also build, mortgage or lift mortgages (from “My properties”) and offer trades. When you are done, tap “End turn”.',
    ],
  },
  {
    id: 'buy', icon: '🏠', title: 'Buying and auctions',
    short: 'On a free property: buy it at its price, or it goes to auction.',
    details: [
      'Neighbourhoods, stations and companies can be bought. The price is shown on the square.',
      'If you don’t want it or can’t afford it, it is auctioned and everyone may bid, you included.',
      'Open auction: everyone sees the bids and raises by +10, +50 or +100. Players who are done tap “Pass”. The last bid wins once all others have passed.',
      'Sealed auction: everyone makes one hidden bid (0 = pass). The highest bid wins. On a tie, the player closest in turn order after the current player wins.',
      'If nobody bids, the property stays with the bank. Whoever gets a property may give it their own name.',
    ],
  },
  {
    id: 'rent', icon: '💶', title: 'Rent',
    short: 'On someone else’s property you pay rent. A whole colour group means double rent.',
    details: [
      'Neighbourhood: base rent, doubled if the owner has every neighbourhood of that colour. Houses and a hotel raise it a lot (tap the square to see its table).',
      'Stations: rent grows with the number of stations the owner has: {stations}.',
      'Companies: you pay your dice roll × {utils}, depending on how many companies the owner has.',
      'Mortgaged properties collect no rent.',
    ],
  },
  {
    id: 'build', icon: '🏗️', title: 'Building',
    short: 'With a whole colour group you build houses evenly, then a hotel.',
    details: [
      'You can only build when you own every neighbourhood of a colour and none of them is mortgaged.',
      'Build evenly: no second house on one neighbourhood before every other one in the group has one.',
      'When they all have 4 houses you can replace them with a hotel (the 4 houses go back to the bank).',
      'The bank has {houses} houses and {hotels} hotels. When they run out, nobody can build until some are returned.',
      'Buildings are sold back to the bank for half their cost, also evenly.',
    ],
  },
  {
    id: 'mortgage', icon: '🏦', title: 'Mortgages',
    short: 'Get half a property’s price. Lifting the mortgage costs that plus 10%.',
    details: [
      'Mortgaging gives you half the property’s price from the bank at once. You keep the property but it collects no rent.',
      'To lift the mortgage you pay half the price plus 10%.',
      'You can’t mortgage while any neighbourhood of that colour has buildings: sell them first.',
    ],
  },
  {
    id: 'jail', icon: '⛓️', title: 'Jail',
    short: 'You go to jail from “Go to Jail”, a card or a third double. Get out with a double, {fine} or a card.',
    details: [
      'If you just land on the Jail square you are only visiting and nothing happens.',
      'In jail, on your turn: pay {fine} and roll normally, use a get-out-of-jail card, or roll for a double.',
      'A double gets you out and moves you, without another roll. After 3 failed tries you must pay {fine} and move.',
      'You still collect rent while in jail, unless the house rule says otherwise.',
    ],
  },
  {
    id: 'cards', icon: '🃏', title: 'Cards',
    short: 'On Chance and Community Chest you draw a card and do what it says.',
    details: [
      'Cards may give or take money, move you, send you to jail or charge repairs for your buildings.',
      'Keep the get-out-of-jail card until you need it, or trade it.',
      'You can add your own cards when setting up a game.',
    ],
  },
  {
    id: 'trade', icon: '🤝', title: 'Trades',
    short: 'On your turn offer money, properties or cards to another player. They accept, refuse or counter.',
    details: [
      'Tap “Trade”, pick a player and choose what you give and what you get.',
      'The other player accepts, refuses or sends a counter-offer.',
      'Neighbourhoods can’t be traded while their group has buildings.',
      'Whoever receives a mortgaged property pays 10% of its mortgage value as interest straight away.',
    ],
  },
  {
    id: 'debt', icon: '💸', title: 'Debts and bankruptcy',
    short: 'Not enough cash? Sell buildings or mortgage. Otherwise you go bankrupt.',
    details: [
      'When you owe more than you have, the game waits: sell buildings or mortgage from “My properties”, then tap “Pay”.',
      'If that isn’t possible, you declare bankruptcy and leave the game.',
      'If you owed a player, they get all your properties and cash (buildings are sold to the bank first). If you owed the bank, your properties are auctioned.',
    ],
  },
  {
    id: 'end', icon: '🏁', title: 'End of the game',
    short: 'The last player left wins, or the one worth the most when time runs out.',
    details: [
      'When only one player is left, they win.',
      'With a time limit: when time is up the current round is finished, and the player worth the most wins.',
      'Worth = cash + property prices (mortgaged ones count half) + the cost of buildings.',
      'At the end you see statistics and can start a rematch with the same players.',
    ],
  },
  {
    id: 'house', icon: '🧩', title: 'House rules (optional)',
    short: 'Chosen when you set up a game.',
    details: [
      'Parking: taxes and fines are collected in the middle of the board, and whoever lands on Free Parking takes them.',
      'Double salary: landing exactly on Start pays {salary} × 2.',
      'No rent from jail: owners in jail don’t collect rent.',
      'Buy after the first lap: nobody buys (or bids) before completing a full lap.',
      'Pass: a player on a free property may, besides buying or auctioning it, simply pass. It stays with the bank.',
    ],
  },
  {
    id: 'online', icon: '📱', title: 'Online play',
    short: 'The host shares a code or QR, the others join from their own phones.',
    details: [
      'The host keeps the “official” game and should keep the app open on screen.',
      'If someone disconnects, their turns are played automatically after a while, and the host can remove them.',
      'If the host is lost, the game waits. After 5 minutes anyone can tap “Take over as host”.',
      'If your screen doesn’t update, tap “🔄 Reconnect” in the ✕ menu.',
    ],
  },
];

export const RULES: Record<Lang, RuleSection[]> = { el, en };

/** values for the placeholders, from the board being played */
export function ruleValues(b: Board, money: (n: number) => string): RuleValues {
  return {
    start: money(b.startCash),
    salary: money(b.salary),
    fine: money(b.jailFine),
    houses: String(b.houses),
    hotels: String(b.hotels),
    squares: String(b.squares.length),
    stations: b.stationRent.map((r) => money(r)).join(' / '),
    utils: b.utilMult.join(' / '),
  };
}

export function fill(text: string, v: RuleValues): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? v[k as keyof RuleValues] : m));
}
