// Letters of other scripts drawn exactly like Latin ones, which a name can be spelt with to look the
// same as another and still differ (ADR-0110). The table is small on purpose: it holds the
// Cyrillic and Greek letters that every font draws as the Latin letter beside them, the ones
// copying a name with needs. Look-alikes within one script (I and l, rn and m, 0 and O) are left
// out: fonts tell many of them apart, and folding them would number names that differ for real.
// Each letter is folded in its own case, before names are lowercased: a capital Greek nu is an N,
// a small one a v.

const LOOK_ALIKES: Readonly<Record<string, string>> = {
  // Cyrillic capitals.
  '\u0410': 'A', // cyrillic capital letter a
  '\u0412': 'B', // cyrillic capital letter ve
  '\u0415': 'E', // cyrillic capital letter ie
  '\u04BA': 'H', // cyrillic capital letter shha
  '\u041D': 'H', // cyrillic capital letter en
  '\u0406': 'I', // cyrillic capital letter byelorussian-ukrainian i
  '\u04C0': 'I', // cyrillic letter palochka
  '\u0408': 'J', // cyrillic capital letter je
  '\u041A': 'K', // cyrillic capital letter ka
  '\u041C': 'M', // cyrillic capital letter em
  '\u041E': 'O', // cyrillic capital letter o
  '\u0420': 'P', // cyrillic capital letter er
  '\u051A': 'Q', // cyrillic capital letter qa
  '\u0405': 'S', // cyrillic capital letter dze
  '\u0422': 'T', // cyrillic capital letter te
  '\u04AE': 'Y', // cyrillic capital letter straight u
  '\u0423': 'Y', // cyrillic capital letter u
  '\u051C': 'W', // cyrillic capital letter we
  '\u0425': 'X', // cyrillic capital letter ha
  // Cyrillic small letters.
  '\u0430': 'a', // cyrillic small letter a
  '\u0441': 'c', // cyrillic small letter es
  '\u0501': 'd', // cyrillic small letter komi de
  '\u0435': 'e', // cyrillic small letter ie
  '\u04BB': 'h', // cyrillic small letter shha
  '\u0456': 'i', // cyrillic small letter byelorussian-ukrainian i
  '\u0458': 'j', // cyrillic small letter je
  '\u043A': 'k', // cyrillic small letter ka
  '\u04CF': 'l', // cyrillic small letter palochka
  '\u043E': 'o', // cyrillic small letter o
  '\u0440': 'p', // cyrillic small letter er
  '\u051B': 'q', // cyrillic small letter qa
  '\u0455': 's', // cyrillic small letter dze
  '\u0443': 'y', // cyrillic small letter u
  '\u051D': 'w', // cyrillic small letter we
  '\u0445': 'x', // cyrillic small letter ha
  // Greek capitals.
  '\u0391': 'A', // greek capital letter alpha
  '\u0392': 'B', // greek capital letter beta
  '\u0395': 'E', // greek capital letter epsilon
  '\u0396': 'Z', // greek capital letter zeta
  '\u0397': 'H', // greek capital letter eta
  '\u0399': 'I', // greek capital letter iota
  '\u039A': 'K', // greek capital letter kappa
  '\u039C': 'M', // greek capital letter mu
  '\u039D': 'N', // greek capital letter nu
  '\u039F': 'O', // greek capital letter omicron
  '\u03A1': 'P', // greek capital letter rho
  '\u03A4': 'T', // greek capital letter tau
  '\u03A5': 'Y', // greek capital letter upsilon
  '\u03A7': 'X', // greek capital letter chi
  '\u03F9': 'C', // greek capital lunate sigma symbol
  // Greek small letters.
  '\u03BF': 'o', // greek small letter omicron
  '\u03C1': 'p', // greek small letter rho
  '\u03BD': 'v', // greek small letter nu
  '\u03F2': 'c', // greek lunate sigma symbol
  // Latin letters of phonetics drawn as plain ones.
  '\u0251': 'a', // latin small letter alpha
  '\u0261': 'g', // latin small letter script g
};

/** The text with each look-alike letter in its Latin form; accents, apart, are kept. */
export function foldLookAlikes(text: string): string {
  return Array.from(text, (character) => LOOK_ALIKES[character] ?? character).join('');
}
