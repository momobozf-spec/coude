import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { SearchSort } from '@superrette/validation';
import { Chip, Row, SearchField, SectionHeader, Text } from '@superrette/ui';
import { DataNotice } from '../../components/DataNotice';
import { ProductCard } from '../../components/ProductCard';
import { ErrorState, Loading, Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi } from '../../state/session';

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

export default function Search(): ReactNode {
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ q?: string }>();
  const [text, setText] = useState(params.q ?? '');
  const [submitted, setSubmitted] = useState(params.q ?? '');
  const [sort, setSort] = useState<SearchSort>('relevance');
  const [promotionOnly, setPromotionOnly] = useState(false);
  const debounced = useDebounced(text.trim());

  const suggestions = useQuery({ queryKey: ['autocomplete', debounced], queryFn: () => api.autocomplete(debounced), enabled: debounced.length >= 2 && debounced !== submitted });
  const recent = useQuery({ queryKey: ['recent-searches'], queryFn: api.recentSearches });
  const popular = useQuery({ queryKey: ['popular-searches'], queryFn: api.popularSearches });
  const results = useQuery({
    queryKey: ['search', submitted, sort, promotionOnly],
    queryFn: () => api.search({ q: submitted, sort, promotionOnly }),
    enabled: submitted.length > 0,
  });

  const run = (q: string): void => {
    setText(q);
    setSubmitted(q.trim());
    void qc.invalidateQueries({ queryKey: ['recent-searches'] });
  };

  const sorts: [SearchSort, string][] = [
    ['relevance', t('search.sortRelevance')],
    ['lowest_price', t('search.sortLowestPrice')],
    ['lowest_unit_price', t('search.sortLowestUnitPrice')],
    ['highest_discount', t('search.sortHighestDiscount')],
  ];

  return (
    <Screen title={t('search.title')}>
      <SearchField value={text} onChangeText={setText} placeholder={t('search.placeholder')} onSubmit={() => run(text)} onScan={() => router.push('/scan')} autoFocus={!params.q} />

      {suggestions.data?.length && text.trim() !== submitted ? (
        <View style={{ marginTop: 8 }}>
          {suggestions.data.map((s) => (
            <Pressable key={s} onPress={() => run(s)} style={{ paddingVertical: 10 }}>
              <Text>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!submitted ? (
        <>
          {recent.data?.length ? (
            <>
              <SectionHeader
                title={t('search.recent')}
                action={t('search.clearRecent')}
                onAction={async () => {
                  await api.clearRecentSearches();
                  void recent.refetch();
                }}
              />
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {recent.data.map((q) => <Chip key={q} label={q} onPress={() => run(q)} />)}
              </Row>
            </>
          ) : null}
          {popular.data?.length ? (
            <>
              <SectionHeader title={t('search.popular')} />
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {popular.data.map((q) => <Chip key={q} label={q} onPress={() => run(q)} />)}
              </Row>
            </>
          ) : null}
        </>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            <Chip label={t('search.filterPromotion')} selected={promotionOnly} onPress={() => setPromotionOnly((v) => !v)} />
            {sorts.map(([key, label]) => (
              <Chip key={key} label={label} selected={sort === key} onPress={() => setSort(key)} />
            ))}
          </ScrollView>
          {results.isLoading ? <Loading /> : null}
          {results.error ? <ErrorState error={results.error} onRetry={() => void results.refetch()} /> : null}
          {results.data ? (
            <>
              <DataNotice origins={results.data.items.map((i) => i.dataOrigin)} />
              <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>
                {t('search.results', { count: results.data.total })}
              </Text>
              {results.data.total === 0 ? (
                <View style={{ gap: 8 }}>
                  <Text>{t('search.noResults', { query: submitted })}</Text>
                  {results.data.suggestion ? (
                    <Text tone="info" onPress={() => run(results.data!.suggestion!)}>
                      {t('search.didYouMean', { suggestion: results.data.suggestion })}
                    </Text>
                  ) : null}
                </View>
              ) : (
                results.data.items.map((p) => <ProductCard key={p.variantId} product={p} />)
              )}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
