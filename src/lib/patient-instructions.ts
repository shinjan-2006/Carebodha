/** Older imports stored entire document pages alongside extracted instructions. */
export function isSourcePageInstruction(instruction: { title: string }) {
  return /^Source instruction\s+\d+$/i.test(instruction.title.trim());
}
