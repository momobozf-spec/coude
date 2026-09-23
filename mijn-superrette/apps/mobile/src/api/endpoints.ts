import type {
  AuthResponse,
  BarcodeLookupDto,
  BasketComparisonDto,
  CountryDto,
  CreateAlertInput,
  CreateListInput,
  CreateListItemInput,
  EntitlementsDto,
  EquivalentDto,
  FavoriteDto,
  HomeDto,
  InviteDto,
  InvitePreviewDto,
  ListActivityDto,
  LoginInput,
  NotificationDto,
  PriceAlertDto,
  PriceHistoryDto,
  ProductDetailDto,
  PromotionDto,
  RegisterInput,
  RetailerDto,
  RetailerPreferenceDto,
  RetailerPreferencesInput,
  SearchResponse,
  SearchSort,
  ShoppingListDetailDto,
  ShoppingListDto,
  ShoppingListItemDto,
  SmartBasketDto,
  SmartBasketInput,
  UpdateListItemInput,
  UpdateProfileInput,
  UserDto,
} from '@superrette/validation';
import type { ApiClient } from './client';

export interface SearchParams {
  q: string;
  sort?: SearchSort;
  promotionOnly?: boolean;
  retailers?: string[];
}

const qs = (params: Record<string, string | number | boolean | undefined | string[]>): string => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

/** Typed endpoint catalogue. The app never computes prices itself. */
export function endpoints(c: ApiClient) {
  return {
    register: (input: RegisterInput) => c.post<AuthResponse>('/v1/auth/register', input, { auth: false }),
    login: (input: LoginInput) => c.post<AuthResponse>('/v1/auth/login', input, { auth: false }),
    me: () => c.get<UserDto>('/v1/me'),
    updateMe: (input: UpdateProfileInput) => c.patch<UserDto>('/v1/me', input),
    myRetailers: () => c.get<RetailerPreferenceDto[]>('/v1/me/retailers'),
    setMyRetailers: (input: RetailerPreferencesInput) => c.put<RetailerPreferenceDto[]>('/v1/me/retailers', input),
    entitlements: () => c.get<EntitlementsDto>('/v1/me/entitlements'),
    exportData: () => c.get<Record<string, unknown>>('/v1/me/export'),
    deleteSearchHistory: () => c.delete<void>('/v1/me/search-history'),
    deleteAccount: () => c.delete<void>('/v1/me'),
    plans: () =>
      c.get<
        {
          key: string;
          name: string;
          isDefault: boolean;
          entitlements: { key: string; enabled: boolean; limit: number | null }[];
        }[]
      >('/v1/plans', { auth: false }),

    countries: () => c.get<CountryDto[]>('/v1/countries', { auth: false }),
    retailers: (country?: string) => c.get<RetailerDto[]>(`/v1/retailers${qs({ country })}`, { auth: false }),

    home: () => c.get<HomeDto>('/v1/home'),
    search: (p: SearchParams) =>
      c.get<SearchResponse>(
        `/v1/search${qs({ q: p.q, sort: p.sort, promotionOnly: p.promotionOnly, retailers: p.retailers })}`,
      ),
    autocomplete: (q: string) => c.get<string[]>(`/v1/search/autocomplete${qs({ q })}`),
    recentSearches: () => c.get<string[]>('/v1/search/recent'),
    clearRecentSearches: () => c.delete<void>('/v1/search/recent'),
    popularSearches: () => c.get<string[]>('/v1/search/popular', { auth: false }),

    product: (id: string, scope: 'mine' | 'all' = 'mine') =>
      c.get<ProductDetailDto>(`/v1/products/${id}${qs({ scope })}`),
    history: (id: string, days = 90) => c.get<PriceHistoryDto>(`/v1/products/${id}/history${qs({ days })}`),
    equivalents: (id: string) => c.get<EquivalentDto[]>(`/v1/products/${id}/equivalents`),
    barcode: (code: string) => c.get<BarcodeLookupDto>(`/v1/barcodes/${encodeURIComponent(code)}`),

    favorites: () => c.get<FavoriteDto[]>('/v1/favorites'),
    addFavorite: (variantId: string) => c.put<void>(`/v1/favorites/${variantId}`),
    removeFavorite: (variantId: string) => c.delete<void>(`/v1/favorites/${variantId}`),

    lists: () => c.get<ShoppingListDto[]>('/v1/lists'),
    createList: (input: CreateListInput) => c.post<ShoppingListDto>('/v1/lists', input),
    list: (id: string) => c.get<ShoppingListDetailDto>(`/v1/lists/${id}`),
    renameList: (id: string, input: Partial<CreateListInput>) => c.patch<ShoppingListDto>(`/v1/lists/${id}`, input),
    deleteList: (id: string) => c.delete<void>(`/v1/lists/${id}`),
    addItem: (listId: string, input: Partial<CreateListItemInput> & { title: string }) =>
      c.post<ShoppingListItemDto>(`/v1/lists/${listId}/items`, input),
    updateItem: (listId: string, itemId: string, input: UpdateListItemInput) =>
      c.patch<ShoppingListItemDto>(`/v1/lists/${listId}/items/${itemId}`, input),
    deleteItem: (listId: string, itemId: string) => c.delete<void>(`/v1/lists/${listId}/items/${itemId}`),
    selectProduct: (listId: string, itemId: string, retailerId: string, retailerProductId: string | null) =>
      c.put<void>(`/v1/lists/${listId}/items/${itemId}/selection`, { retailerId, retailerProductId }),
    compare: (listId: string, retailerIds?: string[]) =>
      c.post<BasketComparisonDto>(`/v1/lists/${listId}/compare`, retailerIds ? { retailerIds } : {}),
    smartBasket: (listId: string, input: Partial<SmartBasketInput>) =>
      c.post<SmartBasketDto>(`/v1/lists/${listId}/smart-basket`, input),
    activity: (listId: string) => c.get<ListActivityDto[]>(`/v1/lists/${listId}/activity`),
    createInvite: (listId: string, role: 'EDITOR' | 'VIEWER' = 'EDITOR') =>
      c.post<InviteDto>(`/v1/lists/${listId}/invites`, { role }),
    previewInvite: (token: string) => c.get<InvitePreviewDto>(`/v1/invites/${encodeURIComponent(token)}`),
    acceptInvite: (token: string) => c.post<ShoppingListDto>(`/v1/invites/${encodeURIComponent(token)}/accept`),
    removeMember: (listId: string, userId: string) => c.delete<void>(`/v1/lists/${listId}/members/${userId}`),

    promotions: (params: { section?: string; sort?: string; retailerId?: string; category?: string }) =>
      c.get<PromotionDto[]>(`/v1/promotions${qs(params)}`),

    alerts: () => c.get<PriceAlertDto[]>('/v1/alerts'),
    createAlert: (input: CreateAlertInput) => c.post<PriceAlertDto>('/v1/alerts', input),
    updateAlert: (id: string, input: { enabled?: boolean; targetPriceCents?: number | null }) =>
      c.patch<PriceAlertDto>(`/v1/alerts/${id}`, input),
    deleteAlert: (id: string) => c.delete<void>(`/v1/alerts/${id}`),

    notifications: () => c.get<{ items: NotificationDto[]; unread: number }>('/v1/notifications'),
    readNotification: (id: string) => c.post<void>(`/v1/notifications/${id}/read`),
    readAllNotifications: () => c.post<void>('/v1/notifications/read-all'),
    registerPushToken: (token: string, platform: 'ios' | 'android' | 'web') =>
      c.post<void>('/v1/push-tokens', { token, platform }),
  };
}

export type Endpoints = ReturnType<typeof endpoints>;
