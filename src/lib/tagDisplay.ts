const CATEGORY_TOKENS = [
  "mesh",
  "material",
  "texture",
  "sound",
  "audio",
  "ui",
  "blueprint",
  "animation",
  "vfx",
  "effects",
  "characters",
];

function normalizeTag(tag?: string | null): string | undefined {
  if (tag == null) return undefined;
  const trimmed = String(tag).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function computeTagDisplay(
  tags: Array<string | null | undefined> | undefined,
  category?: string | null,
  limit = 4,
  maxCharacters = 36
): { visible: string[]; extra: number } {
  const categoriesSet = new Set(CATEGORY_TOKENS);
  const allUnique: string[] = [];
  const allSeen = new Set<string>();
  const categoryTags: string[] = [];
  const nonCategoryTags: string[] = [];

  const addTag = (tag?: string | null) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    const lower = normalized.toLowerCase();
    if (!allSeen.has(lower)) {
      allSeen.add(lower);
      allUnique.push(normalized);
      if (categoriesSet.has(lower)) {
        categoryTags.push(normalized);
      } else {
        nonCategoryTags.push(normalized);
      }
    }
  };

  addTag(category);
  if (tags) {
    for (const raw of tags) {
      addTag(raw);
    }
  }

  const visible: string[] = [];
  const visibleSeen = new Set<string>();

  let characterCount = 0;

  const pushVisible = (tag: string, force = false) => {
    if (visible.length >= limit) return;
    const lower = tag.toLowerCase();
    if (visibleSeen.has(lower)) return;
    const tagLength = tag.length;
    const nextLength =
      characterCount === 0 ? tagLength : characterCount + 1 + tagLength;
    if (!force && nextLength > maxCharacters) return;
    visibleSeen.add(lower);
    visible.push(tag);
    characterCount = nextLength;
  };

  for (const tag of nonCategoryTags) {
    pushVisible(tag, visible.length === 0);
  }
  for (const tag of categoryTags) {
    pushVisible(tag, visible.length === 0);
  }

  if (visible.length === 0) {
    for (const tag of allUnique) {
      pushVisible(tag, visible.length === 0);
      if (visible.length >= limit) break;
    }
  }

  const extra = Math.max(0, allUnique.length - visible.length);
  return { visible, extra };
}
