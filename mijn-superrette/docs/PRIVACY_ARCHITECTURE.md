# Privacy architecture (GDPR)

Mijn Superrette handles consumer behaviour data (what you search, buy and follow). The design goal is to **collect as little as possible and keep it separable and deletable**.

## Data separation

| Kind                                                                                           | Where                  | Personal?                             |
| ---------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------- |
| Retailers, products, prices, promotions, matches                                               | `catalog` schema       | No                                    |
| Import bookkeeping                                                                             | `ingest` schema        | No                                    |
| Accounts, lists, favourites, alerts, notifications, search history, push tokens, subscriptions | `app` schema           | **Yes**                               |
| Popular searches                                                                               | `catalog.search_stats` | No: aggregate counts only, no user id |

The catalogue never references users by foreign key. Admin reviewer ids in `product_matches` and `product_equivalences` are stored without an FK and are not needed for the product to function.

## Minimisation

- The account holds e-mail, first name, language and country. No address, birth date or phone number.
- No location tracking. Store locations are catalogue data.
- Search history is kept per user only to show "recent searches", and can be deleted at any time.
- Push tokens identify a device only for delivering alerts. They are disabled when Expo reports `DeviceNotRegistered`.
- No third-party analytics SDKs are included.

## Data subject rights (implemented)

| Right                             | Endpoint                                                            | App                                          |
| --------------------------------- | ------------------------------------------------------------------- | -------------------------------------------- |
| Access / portability (Art. 15/20) | `GET /v1/me/export` (machine-readable JSON, password hash excluded) | Profiel → Privacy → _Download mijn gegevens_ |
| Erasure of history                | `DELETE /v1/me/search-history`                                      | _Wis zoekgeschiedenis_                       |
| Erasure (Art. 17)                 | `DELETE /v1/me`                                                     | _Account verwijderen_                        |
| Rectification                     | `PATCH /v1/me`                                                      | profile / language / country                 |

**Account deletion** removes the user and everything personal: sessions, preferences, favourites, alerts, triggers, notifications, push tokens, search history, subscriptions, owned lists and memberships.

**Shared data:** a list the user owns that has other members is handed to the longest-standing editor, so other household members don't lose their list. The deleted user's name is removed from the list activity (`actorName`), and item authorship links become NULL. The integration test `privacy (GDPR)` covers export, history deletion and account deletion.

## Retention (policy to configure in production)

- Sessions expire after 30 days. Revoked or expired sessions can be purged daily.
- Notifications: 12 months. Search history: 12 months or on request.
- `ingest.provider_errors.raw` contains only retailer or product data, never personal data.

## Processors & transfers

Expo Push Service (delivery of alert notifications) and the hosting/database provider. List them in the privacy notice. Open Prices and Open Food Facts receive no personal data: requests carry only GTINs and the app's User-Agent.

## Open items before launch

- Privacy notice and terms (NL/FR/EN), a DPA with processors, a record of processing activities.
- Automated retention jobs (the policy above is documented, not yet scheduled).
- Consent screen for push notifications (the OS prompt exists; an in-app explanation is recommended).
