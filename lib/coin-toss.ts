// Both sides have equal probability. Live play selects this once on the server;
// every overlay receives that saved result rather than drawing its own coin.
export function coinOutcome(randomValue:number):'Heads'|'Tails' {
 return (randomValue & 1) === 0 ? 'Heads' : 'Tails';
}
