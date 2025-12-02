import { CardData, Player, Rank, Suit, BotAction } from '../types';
import { SUITS, RANKS, RANK_VALUES } from '../constants';

// --- Deck Management ---

export const createDeck = (): CardData[] => {
  const deck: CardData[] = [];
  let idCounter = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `card-${idCounter++}-${rank}-${suit}`,
        suit,
        rank,
        value: RANK_VALUES[rank],
      });
    }
  }
  return shuffleDeck(deck);
};

export const shuffleDeck = (deck: CardData[]): CardData[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

// --- Scoring ---

export const calculateHandValue = (hand: CardData[], joker: CardData | null): number => {
  if (!joker) return hand.reduce((sum, card) => sum + card.value, 0);

  return hand.reduce((sum, card) => {
    // Check if card is the joker (Rank AND Suit match)
    if (card.rank === joker.rank && card.suit === joker.suit) {
      return sum + 0;
    }
    return sum + card.value;
  }, 0);
};

export const getRoundScores = (
  players: Player[], 
  callerIndex: number, 
  joker: CardData | null
): { playerId: number; roundScore: number }[] => {
  
  const handValues = players.map(p => ({
    id: p.id,
    val: calculateHandValue(p.hand, joker)
  }));

  const callerValue = handValues.find(h => h.id === players[callerIndex].id)?.val || 0;
  const lowestValue = Math.min(...handValues.map(h => h.val));
  
  // Count how many players share the lowest value
  const winnersCount = handValues.filter(h => h.val === lowestValue).length;
  const callerIsLowest = callerValue === lowestValue;

  return players.map(p => {
    const handVal = calculateHandValue(p.hand, joker);
    let roundScore = handVal;

    if (p.id === players[callerIndex].id) {
      if (callerIsLowest && winnersCount === 1) {
        // Case A: Caller is unique lowest
        roundScore = 0;
      } else if (callerIsLowest && winnersCount > 1) {
        // Case B: Caller ties for lowest
        roundScore = 25;
      } else {
        // Case C: Caller is NOT lowest
        roundScore = 50;
      }
    }

    return { playerId: p.id, roundScore };
  });
};

// --- Bot Logic ---

export const decideBotAction = (player: Player, joker: CardData | null, tossedThisTurn: boolean): BotAction => {
  const hand = player.hand;
  const currentScore = calculateHandValue(hand, joker);

  // 1. Check for TOSS (Priority)
  // Only toss if we haven't tossed this turn
  if (!tossedThisTurn) {
    const rankCounts: Record<string, CardData[]> = {};
    for (const card of hand) {
      if (!rankCounts[card.rank]) rankCounts[card.rank] = [];
      rankCounts[card.rank].push(card);
    }
  
    for (const rank in rankCounts) {
      if (rankCounts[rank].length >= 2) {
        // Found a pair!
        // Don't toss if it's a pair of Jokers (0 value), but that's impossible since only 1 joker exists per round
        return { 
          type: 'TOSS', 
          cardIds: [rankCounts[rank][0].id, rankCounts[rank][1].id] 
        };
      }
    }
  }

  // 2. Check for SHOW
  // Aggressive: Show if <= 5 points. Conservative: Show if <= 3.
  // Dynamic: Show if score is very low based on round number? Let's keep it simple.
  if (currentScore <= 5) {
    return { type: 'SHOW' };
  }

  // 3. DISCARD
  // Discard the highest value card.
  // Avoid discarding potential pairs (smart bot), but for now, just high value.
  let highestCard = hand[0];
  let highestVal = -1;

  hand.forEach(c => {
    const val = (c.rank === joker?.rank && c.suit === joker?.suit) ? 0 : c.value;
    if (val > highestVal) {
      highestVal = val;
      highestCard = c;
    }
  });

  return { type: 'DISCARD', cardIds: [highestCard.id] };
};