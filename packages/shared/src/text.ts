/**
 * Change only the first letter, leaving the rest of the string alone.
 *
 * Both directions are needed because stored text is written to stand on its
 * own -- "Off Treasure Avenue", "Bins go out after 6pm" -- and then gets used
 * both at the start of a sentence and in the middle of one. Five places had
 * written this out, one of them behind a non-null assertion.
 *
 * `charAt` rather than `[0]`: it returns "" for an empty string instead of
 * undefined, and settings text is allowed to be empty.
 */
export const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

export const decapitalize = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1);
