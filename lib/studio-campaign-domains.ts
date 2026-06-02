// ============================================================
// Studio Campaign Domains — 50 cross-domain stimuli entries
// Used in Phase 3 of the Campaign Igniter (Cross-Domain Stimulation).
// Three are randomly selected per generation run.
//
// Each entry describes the domain AND the specific thinking lens it provides.
// The AI uses these as: "If this campaign was designed by a [domain expert],
// what would the core mechanic be?"
// ============================================================

export const CAMPAIGN_DOMAINS: string[] = [
  // Film & Performance
  'Film direction — Kubrick-style slow tension build and visual obsession with controlled information reveal',
  'Stand-up comedy — the setup/punchline structure, the rule of three, and the art of the callback',
  'Theater direction — the fourth wall break and the power of direct audience address',
  'Improv comedy — the "Yes, and" co-creation principle and the beauty of the unscripted moment',
  'Documentary filmmaking — building trust through contradiction and the courage to show the inconvenient truth',
  'Circus performance — the danger reveal, the extended build-up, and the cathartic relief payoff',

  // Visual Arts & Design
  'Street art — unexpected placement, fleeting existence, and the public provocation that forces a reaction',
  'Graffiti art — territorial marking, the tag as identity claim, and the unsanctioned voice in sanctioned space',
  'Bauhaus design — form follows function; strip every non-essential element until only the truth remains',
  'Dadaism — deliberate absurdity as a protest against convention and the shock of the nonsensical made earnest',
  'Surrealism — the subconscious logic that feels truer than rational reality, the dream image that cannot be unseen',
  'Propaganda poster design — single image, single emotion, zero ambiguity; the whole argument in one frame',
  'Children\'s book illustration — maximum emotional meaning with minimum visual complexity',
  'Protest art — the image that cannot be ignored in public space, the message that travels without permission',
  'Calligraphy — the weight of a single mark, what precision communicates before meaning is read',
  'Origami — how constraint creates elegance; the beauty that emerges only when you cannot add, only fold',

  // Strategy & Competition
  'Military strategy — feint, misdirection, and controlling the terrain before the first engagement',
  'Competitive chess theory — sacrifice material now to win a positional advantage that pays off thirty moves later',
  'Competitive chess — the Zugzwang principle: structuring the situation so any move the opponent makes loses',
  'Martial arts — using the opponent\'s momentum and weight against themselves rather than matching force with force',
  'Competitive speedrunning — finding the unintended path through the system that the designers never thought to close',
  'Competitive gaming — information asymmetry and the meta-game played above the visible game',
  'Ocean navigation — reading invisible environmental signals to know exactly where you are without landmarks',

  // Science & Craft
  'Forensic investigation — building an airtight case from trace evidence when the obvious answer is wrong',
  'Watchmaking — the invisible micro-movement that makes the visible macro-hand turn with precision',
  'Perfumery — the top note that attracts, the heart note that engages, the base note that stays long after',
  'Bookbinding — the invisible structure that holds everything together and determines how the story opens',
  'Brewing and fermentation — patience as the active ingredient; time transforms what effort alone cannot',
  'Taxidermy — making the inanimate appear alive through the precise recreation of tension and posture',
  'Wine tasting — training perception to articulate what others experience but cannot name or distinguish',
  'Map-making — the editorial decision of what to show and what to omit, knowing both choices change behavior',

  // Communication & Language
  'Political speechwriting — the single line that everyone is still quoting three days later',
  'TED Talk writing — the single idea worth spreading and the 18-minute earned journey to its revelation',
  'Sign language interpretation — translating not just words but emotional register, rhythm, and the space between',
  'Crossword puzzle design — where the surface answer and the hidden answer are both correct and both satisfying',
  'Museum curation — how you sequence objects and what you place next to what changes what everything means',
  '1960s advertising — the era when the idea came first and the product second; when ads were the culture',

  // Architecture & Space
  'Architecture — how the path through a building tells its story before a single word is read',
  'Urban planning — designing for how people will actually behave, not the ideal behavior you want them to have',
  'Theme park design — the controlled reveal, the invisible queue, the story you are already inside before you notice',
  'Escape room design — the puzzle that is perfectly obvious in retrospect and completely impossible in the moment',

  // Music & Sport
  'Jazz improvisation — the structured freedom of playing within constraints you define for yourself mid-performance',
  'Competitive swimming — the race is decided in the turns and the underwaters, not the visible straight-line sprints',

  // Specialized Expertise
  'Magic and illusion — what you choose to show determines what they think they see; what you hide creates the effect',
  'Fashion design — the silhouette communicates the entire message before fabric or color registers consciously',
  'Wilderness survival — ruthless triage; eliminate everything that does not directly contribute to survival right now',
  'Culinary arts — the Maillard reaction principle: transformation requires controlled intensity, not just more time',
  'Game design — the variable reward schedule and the compulsion loop that does not feel like a compulsion',
  'Competitive swimming (open water) — reading the current and drafting off competitors in ways the pool never demands',
]

/**
 * Returns n randomly-selected unique domain strings.
 * Falls back to the first n if the pool is smaller than n (should not happen).
 */
export function pickRandomDomains(n: number = 3): string[] {
  const pool = [...CAMPAIGN_DOMAINS]
  const selected: string[] = []

  while (selected.length < n && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length)
    selected.push(pool.splice(idx, 1)[0])
  }

  return selected
}
