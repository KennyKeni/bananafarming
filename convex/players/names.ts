export const ADJECTIVES = [
  "Festive", "Silent", "Groovy", "Cosmic", "Sunny", "Mighty", "Sleepy", "Zesty",
  "Brave", "Clever", "Dapper", "Eager", "Fuzzy", "Gentle", "Happy", "Jolly",
  "Kindly", "Lively", "Merry", "Noble", "Plucky", "Quirky", "Rowdy", "Snappy",
  "Tipsy", "Witty", "Breezy", "Chirpy", "Dreamy", "Frosty", "Giddy", "Humble",
  "Jazzy", "Loopy", "Minty", "Nimble", "Peppy", "Quick", "Rustic", "Sparkly",
  "Tangy", "Upbeat", "Velvet", "Wacky", "Zippy", "Bashful", "Cheery", "Dandy",
  "Earthy", "Funky",
  "Radiant", "Stoic", "Thrifty", "Yonder", "Crafty", "Dashing", "Elegant", "Fiery",
  "Gallant", "Hearty", "Ironic", "Jagged", "Keen", "Luminous", "Mellow", "Nifty",
  "Obscure", "Prismatic", "Regal", "Savvy", "Turbo", "Urbane", "Vivid", "Whimsy",
  "Yummy", "Ambient", "Bubbly", "Crimson", "Drowsy", "Effusive", "Feral", "Glossy",
  "Hushed", "Icy", "Jaunty", "Knotty", "Lucid", "Misty", "Neon", "Opaline",
  "Plummy", "Quaint", "Rascal", "Shady", "Tranquil", "Umber", "Vexing", "Wistful",
  "Xenial", "Yolked",
] as const;

export const ANIMALS = [
  "Flamingo", "Otter", "Wombat", "Penguin", "Narwhal", "Axolotl", "Panda", "Koala",
  "Sloth", "Capybara", "Hedgehog", "Platypus", "Okapi", "Lemur", "Toucan", "Quokka",
  "Raccoon", "Fennec", "Tapir", "Puffin", "Meerkat", "Pangolin", "Binturong", "Kinkajou",
  "Numbat", "Dugong", "Gecko", "Ibis", "Jerboa", "Kiwi", "Ocelot", "Quoll",
  "Saola", "Tarsier", "Uakari", "Viper", "Walrus", "Xerus", "Yak", "Zebu",
  "Basilisk", "Coati", "Dhole", "Eland", "Galago", "Hoatzin", "Iguana", "Jackal",
  "Kestrel", "Lynx",
  "Manatee", "Newt", "Osprey", "Porcupine", "Quetzal", "Rhea", "Stoat", "Tamarin",
  "Urchin", "Vicuna", "Weasel", "Xenops", "Yapok", "Zorilla", "Aardvark", "Bison",
  "Civet", "Duiker", "Echidna", "Ferret", "Gibbon", "Heron", "Impala", "Jaguar",
  "Kudu", "Loris", "Mongoose", "Nutria", "Oryx", "Peccary", "Quagga", "Reindeer",
  "Skunk", "Tigress", "Uromastyx", "Vulture", "Wolverine", "Yabby", "Zebra", "Armadillo",
  "Badger", "Chinchilla", "Dingo", "Emu", "Falcon", "Grouse", "Harrier", "Indri",
  "Jabiru", "Kouprey",
] as const;

const ADJ_MASK = ADJECTIVES.length;
const ANI_MASK = ANIMALS.length;
const SUFFIX_RANGE = 90; // 10..99

export function hashPlayerId(input: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const ADJ_SET = new Set<string>(ADJECTIVES);
const ANI_SET = new Set<string>(ANIMALS);

export function validateName(name: string): boolean {
  const match = /^([A-Z][a-z]+)([A-Z][a-z]+)(\d{2})$/.exec(name);
  if (!match) return false;
  const [, adj, ani, digits] = match;
  if (!ADJ_SET.has(adj)) return false;
  if (!ANI_SET.has(ani)) return false;
  const n = parseInt(digits, 10);
  if (n < 10 || n > 99) return false;
  return true;
}

export function generateName(playerId: string, attempt = 0): string {
  const h = hashPlayerId(playerId);
  const adj = ADJECTIVES[h % ADJ_MASK];
  const ani = ANIMALS[((h >>> 8) % ANI_MASK + ANI_MASK) % ANI_MASK];
  const num = (((h >>> 16) % SUFFIX_RANGE) + 10)
    .toString()
    .padStart(2, "0");
  const base = `${adj}${ani}${num}`;
  if (attempt === 0) return base;
  // Collision suffix: derive 2 hex chars deterministically from hash + attempt
  const extra = hashPlayerId(`${playerId}:${attempt}`) & 0xff;
  return `${base}${extra.toString(16).padStart(2, "0")}`;
}
