// Ported from solaris-games/solaris (GPL-3.0-or-later): common/src/utilities/utils.ts
// Only the helpers used by the combat code are kept.

export const maxBy = <T>(max: (a: T) => number, list: T[]): number => {
    let lastScore = Number.MIN_SAFE_INTEGER;
    for (let el of list) {
        const elScore = max(el);
        if (elScore > lastScore) {
            lastScore = elScore;
        }
    }

    return lastScore;
};

export const maxOf = <T>(
    max: (arg0: T) => number,
    list: T[],
): T | undefined => {
    let lastScore = Number.MIN_SAFE_INTEGER;
    let largest: T | undefined = undefined;

    for (let el of list) {
        const elScore = max(el);
        if (elScore > lastScore) {
            lastScore = elScore;
            largest = el;
        }
    }

    return largest;
};

export const minOf = <T>(
    min: (arg0: T) => number,
    list: T[],
): T | undefined => {
    let lastScore = Number.MAX_SAFE_INTEGER;
    let smallest: T | undefined = undefined;

    for (let el of list) {
        const elScore = min(el);
        if (elScore < lastScore) {
            lastScore = elScore;
            smallest = el;
        }
    }

    return smallest;
};

export const notUndefined = <T>(val: T | undefined): val is T => {
    return val !== undefined;
};

export const groupBy = <T, K>(
    list: T[],
    keyFunc: (item: T) => K,
): Map<K, T[]> => {
    const map = new Map<K, T[]>();

    for (const item of list) {
        const key = keyFunc(item);
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)!.push(item);
    }

    return map;
};
