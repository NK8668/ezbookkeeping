import { describe, it, expect } from 'vitest';
import { BOOK_TAG_NAMES, bookTagIds, transactionBookScope, setTransactionBookScope, bookHistoryFilter } from './book_scope.ts';

const tags = {
    b: { id: 'b', name: BOOK_TAG_NAMES.business },
    p: { id: 'p', name: BOOK_TAG_NAMES.personal },
    food: { id: 'food', name: '餐饮' }
};

describe('per-transaction public / private bookkeeping', () => {
    it('allows entries from the same payment account to have different books', () => {
        expect(transactionBookScope(['b'], tags)).toBe('business');
        expect(transactionBookScope(['p'], tags)).toBe('personal');
    });

    it('keeps old, imported and unknown-tag entries unclassified', () => {
        expect(transactionBookScope([], tags)).toBeNull();
        expect(transactionBookScope(['food'], tags)).toBeNull();
        expect(transactionBookScope(['missing'], tags)).toBeNull();
    });

    it('does not silently choose a book when both are selected', () => {
        expect(transactionBookScope(['b', 'p', 'food'], tags)).toBeNull();
    });

    it('switches books mutually exclusively and preserves unrelated tags and unknown IDs', () => {
        expect(setTransactionBookScope(['b', 'food', 'legacy'], 'personal', tags)).toEqual(['food', 'legacy', 'p']);
        expect(setTransactionBookScope(['b', 'p', 'food'], 'business', tags)).toEqual(['food', 'b']);
    });

    it('normalises duplicate tag IDs on repeated selection', () => {
        expect(setTransactionBookScope(['p', 'p', 'food'], 'personal', tags)).toEqual(['food', 'p']);
    });

    it('fails closed for missing, renamed or duplicate dedicated tags', () => {
        expect(() => setTransactionBookScope(['food'], 'business', {})).toThrow();
        const duplicate = { ...tags, b2: { id: 'b2', name: BOOK_TAG_NAMES.business } };
        expect(bookTagIds(duplicate).business).toBeNull();
        expect(() => setTransactionBookScope(['food'], 'business', duplicate)).toThrow();
        expect(bookTagIds({ b: { id: 'b', name: 'renamed' } }).business).toBeNull();
    });

    it('constructs mutually exclusive book queries and refuses an unfiltered fallback', () => {
        expect(bookHistoryFilter('business', tags)).toBe('0:b;2:p');
        expect(bookHistoryFilter('personal', tags)).toBe('0:p;2:b');
        expect(bookHistoryFilter('business', {})).toBeNull();
    });
});
