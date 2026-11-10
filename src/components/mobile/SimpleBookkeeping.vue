<template>
    <section class="simple-bookkeeping" aria-label="简易记账">
        <h1>这笔钱，记在哪本账？</h1>
        <p>同一个微信或银行卡，也能逐笔分清公账和私账。</p>
        <p v-if="loading" role="status">正在读取，请稍候…</p>
        <template v-else-if="ready">
            <div class="book-choices">
                <button v-for="book in books" :key="book.scope" type="button"
                        :aria-pressed="selected === book.scope" :class="{ selected: selected === book.scope }"
                        @click="selected = book.scope">
                    <strong>{{ book.title }}</strong><span>{{ book.description }}</span>
                </button>
            </div>
            <div v-if="selected" aria-live="polite">
                <h2>当前：{{ bookScopeLabel(selected) }}</h2>
                <div class="book-actions">
                    <f7-link :href="addLink(TransactionType.Expense)">记支出</f7-link>
                    <f7-link :href="addLink(TransactionType.Income)">记收入</f7-link>
                </div>
                <f7-link class="book-history" :href="historyLink">查看{{ selected === 'business' ? '公账' : '私账' }}流水</f7-link>
            </div>
            <f7-link class="book-settings" :href="unclassifiedLink">查看未归类的旧账</f7-link>
            <f7-link class="book-settings" :href="conflictingLink">检查待确认的账</f7-link>
        </template>
        <button v-else class="book-enable" type="button" :disabled="enabling || !!error" @click="enable">
            {{ enabling ? '正在启用…' : '启用公账 / 私账记账' }}
        </button>
        <p class="book-help">首次启用后，每笔都能选择公账或私账，旧账保持未归类。</p>
        <details class="book-help">
            <summary>分账说明</summary>
            <p>归属会随账目同步到其他设备；不会改变银行卡或微信的实际余额。请在“未归类的旧账”中逐笔补选，在“待确认的账”中纠正同时选了两类的流水。</p>
            <p>分账使用“账本：公账”和“账本：私账”专用标签保存，请保留它们的名称。删除、隐藏或重命名标签前，请先核对对应流水。</p>
        </details>
        <p class="book-error" role="alert" v-if="error">{{ error }} <button type="button" @click="load">重新读取</button></p>
    </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useTransactionTagsStore } from '@/stores/transactionTag.ts';
import { TransactionTag } from '@/models/transaction_tag.ts';
import { TransactionType } from '@/core/transaction.ts';
import { BOOK_TAG_NAMES, bookTagIds, bookHistoryFilter, bookScopeLabel, type BookScope } from '@/lib/book_scope.ts';

const tagsStore = useTransactionTagsStore();
const selected = ref<BookScope | null>(null);
const loading = ref(true);
const enabling = ref(false);
const error = ref('');
const books: { scope: BookScope; title: string; description: string }[] = [
    { scope: 'business', title: '公账', description: '生意的钱' },
    { scope: 'personal', title: '私账', description: '个人的钱' }
];
const ids = computed(() => bookTagIds(tagsStore.allTransactionTagsMap));
const ready = computed(() => !!ids.value.business && !!ids.value.personal);
const historyLink = computed(() => '/transaction/list?tagFilter=' + encodeURIComponent(selected.value ? bookHistoryFilter(selected.value, tagsStore.allTransactionTagsMap) || '' : ''));
const unclassifiedLink = computed(() => '/transaction/list?tagFilter=' + encodeURIComponent(`2:${ids.value.business},${ids.value.personal}`));
const conflictingLink = computed(() => '/transaction/list?tagFilter=' + encodeURIComponent(`1:${ids.value.business},${ids.value.personal}`));
function addLink(type: number): string {
    const id = selected.value ? ids.value[selected.value] : null;
    return `/transaction/add?tagIds=${encodeURIComponent(id || '')}&type=${type}&noTransactionDraft=true`;
}
async function refreshTags(): Promise<void> {
    try {
        await tagsStore.loadAllTags({ force: true });
    } catch (e) {
        // The upstream store rejects unchanged results after successfully loading them.
        if (!e || typeof e !== 'object' || !('isUpToDate' in e) || e.isUpToDate !== true) throw e;
    }
}
async function load(): Promise<void> {
    loading.value = true;
    error.value = '';
    try { await refreshTags(); }
    catch { error.value = '读取失败，请检查网络后重试。'; }
    finally { loading.value = false; }
}
async function enable(): Promise<void> {
    if (enabling.value) return;
    enabling.value = true;
    error.value = '';
    try {
        await refreshTags();
        for (const scope of ['business', 'personal'] as BookScope[]) {
            const matches = Object.values(tagsStore.allTransactionTagsMap).filter(tag => tag.name === BOOK_TAG_NAMES[scope]);
            if (matches.length > 1) throw new Error('存在重名的账本标签，请在标签设置中核对后再启用。');
            if (!matches.length) await tagsStore.saveTag({ tag: TransactionTag.createNewTag(BOOK_TAG_NAMES[scope]) });
        }
    } catch (e) {
        // A second device may have created a tag in the meantime. Reload instead of guessing IDs.
        try { await refreshTags(); } catch { /* Keep the actionable error below. */ }
        if (!ready.value) error.value = e instanceof Error ? e.message : '启用失败，请检查网络后重新读取并再试。';
    } finally { enabling.value = false; }
}
onMounted(load);
</script>

<style scoped>
.simple-bookkeeping { padding: 20px 16px; font-size: 18px; line-height: 1.6; }
h1 { font-size: 25px; margin: 0; } h2 { font-size: 22px; }
.book-choices, .book-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.book-choices button { min-height: 110px; border: 2px solid var(--f7-theme-color); border-radius: 16px; background: var(--f7-card-bg-color); color: var(--f7-text-color); padding: 14px 8px; cursor: pointer; }
.book-choices button.selected { outline: 3px solid var(--f7-theme-color); outline-offset: 3px; }
.book-choices strong { display: block; font-size: 30px; } .book-choices span { display: block; font-size: 18px; }
.book-actions a, .book-history, .book-settings, .book-enable { min-height: 56px; display: flex; justify-content: center; align-items: center; font-size: 20px; border: 1px solid var(--f7-theme-color); border-radius: 10px; padding: 8px; margin: 16px 0; text-align: center; box-sizing: border-box; }
.book-enable { width: 100%; color: var(--f7-text-color); background: var(--f7-card-bg-color); }
.book-help { font-size: 16px; } .book-error { font-weight: 600; }
button:focus-visible, a:focus-visible { outline: 3px solid var(--f7-theme-color); outline-offset: 3px; }
</style>
