// Real transaction tags persist per-entry book choices and sync across devices.
// Account ownership must not determine the book: a payment account can be mixed.
export type BookScope = 'business' | 'personal';
export interface BookTag { id: string; name: string; }
export const BOOK_TAG_NAMES: Record<BookScope, string> = {
    business: '账本：公账',
    personal: '账本：私账'
};

export function bookTagIds(tags: Record<string, BookTag>): Record<BookScope, string | null> {
    function uniqueId(scope: BookScope): string | null {
        const matches = Object.values(tags).filter(tag => tag.name === BOOK_TAG_NAMES[scope]);
        return matches.length === 1 ? matches[0]!.id : null;
    }
    return { business: uniqueId('business'), personal: uniqueId('personal') };
}

export function transactionBookScope(tagIds: string[], tags: Record<string, BookTag>): BookScope | null {
    const scopes = new Set(tagIds.map(id => tags[id]?.name).filter(name => Object.values(BOOK_TAG_NAMES).includes(name || '')));
    if (scopes.size !== 1) return null;
    return scopes.has(BOOK_TAG_NAMES.business) ? 'business' : 'personal';
}

export function setTransactionBookScope(tagIds: string[], scope: BookScope, tags: Record<string, BookTag>): string[] {
    const selectedId = bookTagIds(tags)[scope];
    if (!selectedId) throw new Error('公私账标签缺失或重名，请回到首页重新启用，或检查标签设置。');
    const unrelated = tagIds.filter(id => !Object.values(BOOK_TAG_NAMES).includes(tags[id]?.name || ''));
    return [...new Set([...unrelated, selectedId])];
}

export function bookScopeLabel(scope: BookScope | null): string {
    return scope === 'business' ? '公账 · 生意的钱' : scope === 'personal' ? '私账 · 个人的钱' : '未归类 / 归属冲突';
}

export function bookHistoryFilter(scope: BookScope, tags: Record<string, BookTag>): string | null {
    const ids = bookTagIds(tags);
    const opposite = scope === 'business' ? 'personal' : 'business';
    // Include this book and exclude records carrying both book tags.
    return ids[scope] && ids[opposite] ? `0:${ids[scope]};2:${ids[opposite]}` : null;
}
