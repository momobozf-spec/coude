import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { EmptyState } from '@superrette/ui';
import { DataNotice } from '../components/DataNotice';
import { ProductCard } from '../components/ProductCard';
import { ErrorState, Loading, Screen } from '../components/Screen';
import { useI18n } from '../state/i18n';
import { useApi } from '../state/session';

export default function Favorites(): ReactNode {
  const api = useApi();
  const { t } = useI18n();
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: api.favorites });
  return (
    <Screen title={t('home.favorites')} back refreshing={favorites.isRefetching} onRefresh={() => void favorites.refetch()}>
      {favorites.isLoading ? <Loading /> : null}
      {favorites.error ? <ErrorState error={favorites.error} /> : null}
      {favorites.data ? <DataNotice origins={favorites.data.map((f) => f.product.dataOrigin)} /> : null}
      {favorites.data?.length === 0 ? <EmptyState icon="heart" title={t('home.noFavorites')} /> : null}
      {favorites.data?.map((f) => <ProductCard key={f.product.variantId} product={f.product} />)}
    </Screen>
  );
}
