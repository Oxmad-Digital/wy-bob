# Mapping MongoDB → PostgreSQL (Neon)

Règles communes à toutes les tables :

| Mongo | SQL |
|---|---|
| `_id` (ObjectId) | `id uuid` (nouveau) + `mongo_id text UNIQUE` (= `_id.toHexString()`) |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` (timestamptz) ; `updated_at` mis à jour par le trigger `set_updated_at` |
| champ camelCase | colonne snake_case |
| ObjectId de référence | FK `uuid`, résolue via `mongo_id` de la table cible |
| `Number` montant | `numeric` (sans échelle, aucun arrondi) |
| `Number` compteur/quantité | `integer` / `bigint` |
| enum | `text` + `CHECK (... IN (...))` |
| `unique` + `sparse` | index unique partiel `WHERE col IS NOT NULL` |

## Ordre d'insertion (dépendances)

`users` → `user_addresses` → `customers` → `products` → `product_variants` → `promo_codes` → `promo_code_uses` → `orders` → `order_items` / `order_extra_payments` / `order_refunds` / `order_documents` → `invoices` → `invoice_line_items` / `invoice_documents` → `referral_configs`, `site_settings`, `gallery_photos`, `rate_limit_attempts` → compteurs (`order_number_seq`, `invoice_counters`).

## counters (2 docs)

| Mongo | SQL |
|---|---|
| `{ _id: "orderNumber", seq }` | séquence `order_number_seq` → `setval('order_number_seq', GREATEST(seq, MAX(orders.order_number)), true)` : le prochain `nextval` renverra `seq + 1`, comme le `$inc` actuel |
| `{ _id: "invoice-<année>", seq }` | `invoice_counters (year = <année>, seq = GREATEST(seq, MAX(invoices.sequence) de l'année), mongo_id = "invoice-<année>")` |

Le script de migration (phase 2) initialise les deux à partir de la collection `counters`. Le `GREATEST` avec le maximum déjà présent dans les données est une sécurité : si un compteur était en retard, le script le signale dans son rapport, et on ne réutilise jamais un numéro existant. Un document `counters` dont l'`_id` ne correspond à aucun des deux formats est listé comme ignoré, avec la raison.

**Pourquoi deux approches.** Une séquence est atomique, ne pose pas de verrou et convient aux numéros de commande : un trou (rollback, erreur après `nextval`) n'a pas d'importance. Les factures, elles, doivent avoir une numérotation **continue sans trou** (obligation légale). Une séquence ne la garantit pas, puisque `nextval` n'est pas annulé en cas de rollback. On utilise donc une ligne par année, incrémentée par `INSERT … ON CONFLICT DO UPDATE … RETURNING seq` **dans la même transaction** que l'`INSERT` de la facture. Le verrou de ligne sérialise les émissions concurrentes. Avec quelques factures par jour, la contention est négligeable.

Écart avec le code actuel : `createInvoiceForOrder` incrémente le compteur Mongo **hors transaction**. Si la génération du PDF ou la création de la facture échoue ensuite, un numéro est perdu. La phase 3 corrige ce point.

## users (5)

| Mongo | SQL `users` |
|---|---|
| name, email, password, role | name, email, password, role (CHECK customer/admin/user) |
| emailVerified | email_verified |
| verificationToken / verificationTokenExpiry | verification_token / verification_token_expiry |
| resetToken / resetTokenExpiry | reset_token / reset_token_expiry |
| lastLoginIP / lastLoginAt | last_login_ip / last_login_at |
| failedLoginAttempts / accountLockedUntil | failed_login_attempts / account_locked_until |
| passwordHistory [String] | password_history `text[]` |
| phone, newsletter, language, avatar, avatarPublicId | idem (snake_case) |
| address.{street,city,postalCode,country} | address_street, address_city, address_postal_code, address_country |
| addresses[] {label,fullName,street,zip,city,country} | table **user_addresses** (user_id FK CASCADE, `position` = index dans le tableau, `mongo_id` = _id du sous-doc) |

Index : `verificationToken`, `resetToken` → index partiels `WHERE … IS NOT NULL`. `email` unique.

## customers (6)

| Mongo | SQL `customers` |
|---|---|
| firstname, lastname, email, phone, city, address | idem |
| totalOrders / totalSpent / lastOrderAt | total_orders (int) / total_spent (numeric) / last_order_at |
| status | status (CHECK active/inactive/blocked) |

Index `{status, lastOrderAt}` → `customers_status_last_order_at_idx`.

## products (1) + variants

| Mongo | SQL `products` |
|---|---|
| name, price, pricePromo, stock, visible, weight, customsDescriptionEn | name, price, price_promo, stock, visible, weight, customs_description_en |
| variants[] | table **product_variants** (product_id FK CASCADE, `position`, `mongo_id` = variant._id) |
| variants.{colorName,colorCode,textColor,description,image,stock,editionSize} | color_name, color_code, text_color, description, image, stock, edition_size |

Le hook `pre('save')` (stock = somme des variantes) reste dans la couche applicative (phase 3).

## orders (2)

| Mongo | SQL `orders` |
|---|---|
| orderNumber | order_number (bigint, unique partiel) |
| userId (String) | user_id uuid FK users SET NULL **+** user_mongo_id text (valeur brute) |
| customer.{firstname,lastname,email,phone,company,city,address,postalCode,country} | customer_firstname … customer_country |
| recipientPickupName | recipient_pickup_name |
| total, shippingFee | total, shipping_fee |
| insurance.{opted,declaredValue,fee} | insurance_opted, insurance_declared_value, insurance_fee |
| promoCode, promoDiscount | promo_code (text, sans FK), promo_discount |
| payment / delivery / status | idem + CHECK |
| paymentIntentId | payment_intent_id (index) |
| idempotencyKey | idempotency_key (unique partiel) |
| shipping.{carrier,productCode,productKey,service,skybillNumber,labelGeneratedAt,weightKg} | shipping_carrier, shipping_product_code, shipping_product_key, shipping_service, shipping_skybill_number, shipping_label_generated_at, shipping_weight_kg |
| shipping.relayPoint | shipping_relay_point **jsonb** |
| shipping.trackingStatus / lastTrackedAt / shippingError / cancelledAt | shipping_tracking_status / shipping_last_tracked_at / shipping_error / shipping_cancelled_at |
| shipping.trackingEvents [Mixed] | shipping_tracking_events **jsonb** (tableau) |
| shipping.labelBase64 | **order_documents** (kind = 'label') |
| shipping.podBase64 | **order_documents** (kind = 'pod') |
| products[] {product, quantity, color, variantId} | **order_items** (order_id CASCADE, position, product_id FK SET NULL + product_mongo_id, quantity, color, variant_id FK SET NULL + variant_mongo_id) |
| products[].variantId | `variant_id` = `product_variants.id` dont `mongo_id = variantId.toHexString()` (variantes insérées avant les commandes). Si la variante n'existe plus : `variant_id = NULL`, la valeur reste dans `variant_mongo_id`, et le cas est signalé comme référence orpheline |
| extraPayments[] {reason,amount,status,stripeSessionId,checkoutUrl,createdAt,paidAt} | **order_extra_payments** (order_id CASCADE, `mongo_id` = _id du sous-doc) |
| refunds[] {amount,reason,stripeRefundId,status,createdAt} | **order_refunds** (order_id CASCADE) |

Index : `{status:1, createdAt:-1}` → `(status, created_at DESC)` ; `{userId:1}` → `(user_id)` ; `paymentIntentId` → index simple. Ajout : `(customer_email)`.

## invoices (2)

| Mongo | SQL `invoices` |
|---|---|
| invoiceNumber, year, sequence | invoice_number (unique), year, sequence (+ UNIQUE(year, sequence)) |
| order (ObjectId ref Order, unique) | order_id uuid UNIQUE FK orders **RESTRICT** |
| orderNumber | order_number |
| customer.{firstname,lastname,email,company,address,city,postalCode,country} | customer_* |
| lineItems[] {name,quantity,unitPriceTtc,totalTtc} | **invoice_line_items** (invoice_id CASCADE, position) |
| subtotalTtc, shippingFeeTtc, promoDiscount, vatApplicable, vatRate, totalHt, vatAmount, totalTtc | subtotal_ttc, shipping_fee_ttc, promo_discount, vat_applicable, vat_rate, total_ht, vat_amount, total_ttc |
| sellerSnapshot.{companyName,legalForm,address,city,postalCode,siret,vatNumber,iban} | seller_* |
| pdfBase64 | **invoice_documents** (invoice_id CASCADE, kind = 'pdf', content_base64 ; `mongo_id` = `<invoiceMongoId>:pdf`) |
| issuedAt | issued_at |

## promocodes (2)

| Mongo | SQL `promo_codes` |
|---|---|
| code (unique, uppercase, trim) | code UNIQUE + CHECK (code = upper(btrim(code))) |
| type, value, minOrderAmount, maxUses, usedCount, active, expiresAt | type (CHECK), value (CHECK ≥ 0), min_order_amount, max_uses, used_count, active, expires_at |
| isReferral, filleulPercent, parrainPercent | is_referral, filleul_percent, parrain_percent |
| referrerId (ref User) | referrer_id uuid FK users SET NULL |
| usedByUserIds [ObjectId] | table **promo_code_uses** (promo_code_id CASCADE, position, user_id FK SET NULL + user_mongo_id) |

## referralconfigs (1) → `referral_configs`
totalPercent → total_percent (CHECK 1–100) ; rewardValidityDays → reward_validity_days ; active. Une seule ligne possible (index unique `((true))`).

## sitesettings (1) → `site_settings`
Une seule ligne possible (index unique `((true))`).
maintenanceMode → maintenance_mode ; billing.* → billing_company_name, billing_legal_form, billing_address, billing_city, billing_postal_code, billing_siret, billing_vat_number, billing_vat_applicable, billing_vat_rate, billing_iban.

## galleryphotos (24) → `gallery_photos`
url, publicId → public_id, **order → sort_order** (`order` est un mot réservé en SQL), alt.

## ratelimitattempts (0) → `rate_limit_attempts`
key, createdAt. L'index TTL (24 h) est remplacé par un index sur `created_at` et une purge applicative (ou pg_cron).

---

## Points ambigus / à valider

1. **`orders.userId` est un String sans `ref`.** Je le convertis en FK `user_id` lorsque la valeur correspond à un `users._id` existant. Sinon (utilisateur supprimé, valeur non ObjectId) : `user_id = NULL`, et la valeur brute est gardée dans `user_mongo_id`. Le dry-run listera ces cas.
2. **IDs dans les sessions JWT (NextAuth). ✅ Décidé : reconnexion forcée.** Les tokens en cours contiennent `user._id` Mongo (`token.id`). Au basculement, on change `AUTH_SECRET`, ce qui invalide tous les JWT : chacun se reconnecte et obtient un `session.user.id` en uuid. Aucune traduction `mongo_id` → `id` côté sessions.
3. **IDs Mongo dans Stripe.** La metadata des PaymentIntents/Checkout Sessions déjà créés contient `orderId` et `extraPaymentId` Mongo. Pour un webhook rejoué après la bascule, la phase 3 cherchera par `id` **ou** `mongo_id`. C'est pour ça que `mongo_id` est conservé sur `order_extra_payments`.
4. **`customers` ↔ `users` : aucun lien explicite.** La jointure se fait par email (GET /api/customers, suppression). Je n'ajoute pas de FK pour garder le comportement actuel. On pourrait plus tard ajouter `customers.user_id`.
5. **`order.products.product` est `required`, mais le code tolère un produit supprimé** (`.filter(line => line.product)` après populate). `product_id` est donc nullable (ON DELETE SET NULL), et `product_mongo_id` garde la trace.
6. **`orders.promoCode` est du texte, pas une référence.** Pas de FK, pour que l'historique reste figé même si le code promo est supprimé.
7. **`shipping.trackingEvents` est `[Mixed]`.** La forme vient de `mapEvents` (chronopost/tracking.ts), elle part telle quelle en jsonb. Les éventuelles dates à l'intérieur restent des chaînes ISO.
8. **`usedByUserIds` alimenté par `$push`** : doublons possibles, et `null` possible si `userId` est absent. Pas de contrainte UNIQUE. La date d'usage n'existe pas en Mongo : `created_at` vaudra la date de migration.
9. **`invoices.pdfBase64` ✅ Décidé : déplacé dans `invoice_documents`** (kind = 'pdf'), sur le modèle d'`order_documents`.
10. **Sous-documents sans `_id` exploité** (addresses, lineItems, refunds, order items) : l'`_id` est quand même conservé dans `mongo_id` quand il existe. L'ordre du tableau est conservé via `position`.
11. **Contraintes ajoutées par rapport à Mongo ✅ Décidé : conservées** : `CHECK` minuscule sur les emails, `CHECK` majuscule/trim sur `code`, longueur de `users.name` (2–50, reprise du validateur Mongoose), `UNIQUE(year, sequence)` sur `invoices`, index sur `orders.customer_email` et `promo_codes.referrer_id`. Le dry-run vérifiera que les données actuelles les respectent.
12. **Singletons ✅ Décidé : une seule ligne imposée** sur `site_settings` et `referral_configs`, avec `CREATE UNIQUE INDEX … ((true))`. Si Mongo contenait plus d'un document, le dry-run le signalerait comme bloquant.
13. **`numeric` est renvoyé en chaîne par `pg`** : en phase 3, il faudra le parser (type parser global ou conversion dans les requêtes) pour que les réponses JSON restent identiques.
14. **Valeurs `undefined` vs défauts.** Les vieux documents peuvent ne pas avoir certains champs ajoutés plus tard (`insurance`, `weight`, `recipientPickupName`…). Le script appliquera le défaut Mongoose (ce que Mongoose renvoyait déjà à la lecture). Il ne mettra jamais NULL dans une colonne NOT NULL.
