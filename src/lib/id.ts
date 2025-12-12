export function uid(prefix = 'pin'): string {
    const rnd = Math.random().toString(36).slice(2, 8);
    const time = Date.now().toString(36);
    return `${prefix}_${time}_${rnd}`;
}
