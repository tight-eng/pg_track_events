export function intersection(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>();

  for (const item of a) {
    if (b.has(item)) {
      result.add(item);
    }
  }

  return result;
}

export function difference(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>();

  for (const item of a) {
    if (!b.has(item)) {
      result.add(item);
    }
  }

  return result;
}

export function union(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>(a);

  for (const item of b) {
    result.add(item);
  }

  return result;
}

// Assumption: If two sets have the same size and all elements of 'a' are in 'b',
// then all elements of 'b' must also be in 'a' (i.e., the sets are equal).
export function isEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  return difference(a, b).size === 0;
}
