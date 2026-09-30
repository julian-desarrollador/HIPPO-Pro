export function comparableChoiceLabel(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function choiceQueryMatchesAny<T extends { label: string }>(options: readonly T[], query: string): boolean {
  const needle = comparableChoiceLabel(query);
  if (!needle) {
    return true;
  }
  return options.some((option) => comparableChoiceLabel(option.label).includes(needle));
}

export function filterChoiceOptions<T extends { id: string; label: string }>(
  options: readonly T[],
  query: string,
  selectedId: string,
): T[] {
  const needle = comparableChoiceLabel(query);
  if (!needle) {
    return [...options];
  }

  const matches = options.filter((option) => comparableChoiceLabel(option.label).includes(needle));
  const selected = options.find((option) => option.id === selectedId);
  if (selected && !matches.some((option) => option.id === selectedId)) {
    return [selected, ...matches];
  }
  return matches;
}
