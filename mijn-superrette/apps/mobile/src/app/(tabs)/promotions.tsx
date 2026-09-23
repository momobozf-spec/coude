import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { Chip } from '@superrette/ui';
import { DataNotice } from '../../components/DataNotice';
import { PromotionCard } from '../../components/PromotionCard';
import { ErrorState, Loading, Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi } from '../../state/session';

type Section = 'for_you' | 'favorites' | 'retailer' | 'category' | 'ending_soon';
type Sort = 'largest_discount' | 'lowest_price' | 'ending_soon' | 'recent';

const CATEGORY_SLUGS = ['zuivel', 'frisdrank', 'brood', 'eieren', 'vlees', 'fruit', 'verzorging', 'baby', 'voorraad', 'diepvries'] as const;

export default function Promotions(): ReactNode {
  const api = useApi();
  const { t } = useI18n();
  const [section, setSection] = useState<Section>('for_you');
  const [sort, setSort] = useState<Sort>('largest_discount');
  const [retailerId, setRetailerId] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const retailers = useQuery({ queryKey: ['my-retailers-full'], queryFn: async () => {
    const [mine, all] = await Promise.all([api.myRetailers(), api.retailers()]);
    return all.filter((r) => mine.some((m) => m.retailerId === r.id));
  } });
  const promos = useQuery({
    queryKey: ['promotions', section, sort, retailerId, category],
    queryFn: () => api.promotions({ section, sort, ...(section === 'retailer' && retailerId ? { retailerId } : {}), ...(section === 'category' && category ? { category } : {}) }),
  });

  const sections: [Section, string][] = [
    ['for_you', t('promotions.forYou')],
    ['favorites', t('promotions.favorites')],
    ['retailer', t('promotions.retailers')],
    ['category', t('promotions.categories')],
    ['ending_soon', t('promotions.endingSoon')],
  ];
  const sorts: [Sort, string][] = [
    ['largest_discount', t('promotions.sortLargestDiscount')],
    ['lowest_price', t('promotions.sortLowestPrice')],
    ['ending_soon', t('promotions.sortEndingSoon')],
    ['recent', t('promotions.sortRecent')],
  ];
  const chipRow = { marginHorizontal: -16, marginBottom: 10 } as const;
  const chipContent = { paddingHorizontal: 16, gap: 8 } as const;

  return (
    <Screen title={t('promotions.title')} refreshing={promos.isRefetching} onRefresh={() => void promos.refetch()}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={chipRow} contentContainerStyle={chipContent}>
        {sections.map(([key, label]) => (
          <Chip key={key} label={label} selected={section === key} onPress={() => setSection(key)} />
        ))}
      </ScrollView>
      {section === 'retailer' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={chipRow} contentContainerStyle={chipContent}>
          {retailers.data?.map((r) => (
            <Chip key={r.id} label={r.name} color={r.brandColor} selected={retailerId === r.id} onPress={() => setRetailerId(r.id)} />
          ))}
        </ScrollView>
      ) : null}
      {section === 'category' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={chipRow} contentContainerStyle={chipContent}>
          {CATEGORY_SLUGS.map((c) => (
            <Chip key={c} label={t(`categories.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={chipRow} contentContainerStyle={chipContent}>
        {sorts.map(([key, label]) => (
          <Chip key={key} label={label} selected={sort === key} onPress={() => setSort(key)} />
        ))}
      </ScrollView>
      {promos.isLoading ? <Loading /> : null}
      {promos.error ? <ErrorState error={promos.error} onRetry={() => void promos.refetch()} /> : null}
      {promos.data ? <DataNotice origins={promos.data.map((p) => p.dataOrigin)} /> : null}
      {promos.data?.length === 0 ? <ErrorState error={new Error(t('promotions.none'))} /> : null}
      {promos.data?.map((p) => <PromotionCard key={`${p.id}-${p.variantId}`} promo={p} />)}
    </Screen>
  );
}
