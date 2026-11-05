-- =============================================================================
-- Wybob — schéma PostgreSQL (Neon) issu de la base MongoDB "wybob"
-- À relire puis exécuter manuellement. Idempotent pour les CREATE (IF NOT EXISTS).
--
-- Conventions :
--   * id uuid (gen_random_uuid(), natif PG13+) + mongo_id text UNIQUE (lien/idempotence ;
--     NULL pour les lignes créées après la migration — UNIQUE autorise plusieurs NULL).
--   * created_at / updated_at timestamptz ; updated_at maintenu par trigger (≈ timestamps Mongoose).
--   * Montants : numeric sans échelle (aucun arrondi à la migration).
--   * Enums Mongoose : text + CHECK.
--   * unique+sparse Mongo : index unique partiel WHERE col IS NOT NULL.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Trigger générique updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- users  (collection users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id                    text UNIQUE,
  name                        text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 50),
  email                       text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  password                    text NOT NULL,
  role                        text NOT NULL DEFAULT 'customer'
                                CHECK (role IN ('customer', 'admin', 'user')),
  email_verified              boolean NOT NULL DEFAULT false,
  verification_token          text,
  verification_token_expiry   timestamptz,
  reset_token                 text,
  reset_token_expiry          timestamptz,
  last_login_ip               text,
  last_login_at               timestamptz,
  failed_login_attempts       integer NOT NULL DEFAULT 0,
  account_locked_until        timestamptz,
  password_history            text[] NOT NULL DEFAULT '{}',   -- tableau de chaînes (hash) : pas besoin de table enfant
  phone                       text,
  -- objet imbriqué address
  address_street              text,
  address_city                text,
  address_postal_code         text,
  address_country             text,
  newsletter                  boolean NOT NULL DEFAULT false,
  language                    text NOT NULL DEFAULT 'fr',
  avatar                      text,
  avatar_public_id            text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_verification_token_idx ON users (verification_token) WHERE verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_reset_token_idx        ON users (reset_token)        WHERE reset_token IS NOT NULL;
DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- users.addresses[] — l'API les adresse par index (splice) : on garde l'ordre via position.
CREATE TABLE IF NOT EXISTS user_addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id    text UNIQUE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position    integer NOT NULL,
  label       text NOT NULL DEFAULT '',
  full_name   text NOT NULL DEFAULT '',
  street      text NOT NULL DEFAULT '',
  zip         text NOT NULL DEFAULT '',
  city        text NOT NULL DEFAULT '',
  country     text NOT NULL DEFAULT '',
  UNIQUE (user_id, position) DEFERRABLE INITIALLY DEFERRED
);

-- -----------------------------------------------------------------------------
-- customers  (fiche CRM, liée aux users par email — pas de FK, cf. MAPPING.md)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id       text UNIQUE,
  firstname      text NOT NULL,
  lastname       text NOT NULL DEFAULT '',
  email          text NOT NULL UNIQUE CHECK (email = lower(email)),
  phone          text NOT NULL DEFAULT '',
  city           text NOT NULL DEFAULT '',
  address        text NOT NULL DEFAULT '',
  total_orders   integer NOT NULL DEFAULT 0,
  total_spent    numeric NOT NULL DEFAULT 0,
  last_order_at  timestamptz,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_status_last_order_at_idx ON customers (status, last_order_at);
DROP TRIGGER IF EXISTS customers_set_updated_at ON customers;
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- products + product_variants
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id                text UNIQUE,
  name                    text NOT NULL,
  price                   numeric NOT NULL DEFAULT 85,
  price_promo             numeric,
  stock                   integer NOT NULL DEFAULT 0,   -- = somme des stocks des variantes s'il y en a (logique applicative)
  visible                 boolean NOT NULL DEFAULT true,
  weight                  numeric NOT NULL DEFAULT 100, -- grammes
  customs_description_en  text NOT NULL DEFAULT '',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- products.variants[] — _id conservé dans mongo_id (référencé par orders.products.variantId)
CREATE TABLE IF NOT EXISTS product_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id      text UNIQUE,
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position      integer NOT NULL,              -- ordre d'affichage (ordre du tableau Mongo)
  color_name    text NOT NULL,
  color_code    text NOT NULL,
  text_color    text NOT NULL DEFAULT '#ffffff',
  description   text NOT NULL DEFAULT '',
  image         text NOT NULL DEFAULT '',
  stock         integer NOT NULL DEFAULT 0,
  edition_size  integer NOT NULL DEFAULT 50
);
CREATE INDEX IF NOT EXISTS product_variants_product_id_idx ON product_variants (product_id, position);

-- -----------------------------------------------------------------------------
-- Compteurs
--   orderNumber      -> séquence (atomique, sans verrou ; trous acceptables)
--   invoice-<année>  -> table, incrémentée dans la même transaction que l'INSERT de la
--                       facture => numérotation continue sans trou (obligation légale).
-- La valeur courante est positionnée par le script de migration (setval / insert).
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS order_number_seq AS bigint START WITH 1 MINVALUE 1;

CREATE TABLE IF NOT EXISTS invoice_counters (
  year      integer PRIMARY KEY,
  mongo_id  text UNIQUE,                       -- ex. 'invoice-2026'
  seq       integer NOT NULL DEFAULT 0 CHECK (seq >= 0)
);
-- Usage prévu (phase 3), dans la transaction de création de facture :
--   INSERT INTO invoice_counters (year, seq) VALUES ($1, 1)
--   ON CONFLICT (year) DO UPDATE SET seq = invoice_counters.seq + 1
--   RETURNING seq;

-- -----------------------------------------------------------------------------
-- orders
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id                  text UNIQUE,
  order_number              bigint,
  user_id                   uuid REFERENCES users(id) ON DELETE SET NULL,
  user_mongo_id             text,             -- valeur brute de userId (String sans ref) : conservée si orpheline
  -- customer.*
  customer_firstname        text,
  customer_lastname         text,
  customer_email            text,
  customer_phone            text,
  customer_company          text,
  customer_city             text,
  customer_address          text,
  customer_postal_code      text,
  customer_country          text,
  recipient_pickup_name     text NOT NULL DEFAULT '',
  total                     numeric,
  shipping_fee              numeric NOT NULL DEFAULT 0,
  -- insurance.*
  insurance_opted           boolean NOT NULL DEFAULT false,
  insurance_declared_value  numeric NOT NULL DEFAULT 0,
  insurance_fee             numeric NOT NULL DEFAULT 0,
  promo_code                text,             -- code texte (pas de FK : historique figé, le code peut être supprimé)
  promo_discount            numeric NOT NULL DEFAULT 0,
  payment                   text NOT NULL DEFAULT 'cash'
                              CHECK (payment IN ('cash', 'mobile_money', 'card', 'bank_transfer')),
  payment_intent_id         text,
  idempotency_key           text,
  delivery                  text NOT NULL DEFAULT 'colissimo'
                              CHECK (delivery IN ('standard', 'express', 'pickup', 'colissimo', 'relais')),
  status                    text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')),
  -- shipping.* (labelBase64 / podBase64 -> order_documents)
  shipping_carrier            text DEFAULT 'chronopost',
  shipping_product_code       text,
  shipping_product_key        text,
  shipping_service            text,
  shipping_skybill_number     text,
  shipping_label_generated_at timestamptz,
  shipping_weight_kg          numeric,
  shipping_relay_point        jsonb,          -- {id,name,address1,address2,zipCode,city,country,latitude,longitude}
  shipping_tracking_status    text,
  shipping_tracking_events    jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(shipping_tracking_events) = 'array'),
  shipping_last_tracked_at    timestamptz,
  shipping_error              text,
  shipping_cancelled_at       timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
-- unique + sparse
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key    ON orders (order_number)    WHERE order_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_key ON orders (idempotency_key) WHERE idempotency_key IS NOT NULL;
-- index simples
CREATE INDEX IF NOT EXISTS orders_payment_intent_id_idx  ON orders (payment_intent_id);
CREATE INDEX IF NOT EXISTS orders_status_created_at_idx  ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_user_id_idx            ON orders (user_id);
-- AJOUT (absent des modèles Mongo) : le code filtre souvent par customer.email
-- (suppression client, dashboard, stats). À retirer si vous voulez un schéma strictement iso.
CREATE INDEX IF NOT EXISTS orders_customer_email_idx     ON orders (customer_email);
DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- orders.products[]
CREATE TABLE IF NOT EXISTS order_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id          text UNIQUE,              -- _id du sous-document
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position          integer NOT NULL,
  product_id        uuid REFERENCES products(id) ON DELETE SET NULL,  -- nullable : produit supprimé => populate renvoyait null
  product_mongo_id  text NOT NULL,            -- ObjectId d'origine, conservé même si le produit n'existe plus
  quantity          integer,
  color             text,                     -- libellé de la variante au moment de la commande
  variant_id        uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  variant_mongo_id  text
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx   ON order_items (order_id, position);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items (product_id);

-- orders.extraPayments[] — mongo_id indispensable : l'_id est dans la metadata Stripe (extraPaymentId)
CREATE TABLE IF NOT EXISTS order_extra_payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id           text UNIQUE,
  order_id           uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason             text,
  amount             numeric,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  stripe_session_id  text,
  checkout_url       text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  paid_at            timestamptz
);
CREATE INDEX IF NOT EXISTS order_extra_payments_order_id_idx ON order_extra_payments (order_id, created_at);

-- orders.refunds[]
CREATE TABLE IF NOT EXISTS order_refunds (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id          text UNIQUE,
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount            numeric,
  reason            text,
  stripe_refund_id  text,
  status            text NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded', 'pending', 'failed')),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_refunds_order_id_idx ON order_refunds (order_id, created_at);

-- shipping.labelBase64 / shipping.podBase64 — séparés pour garder orders légère
CREATE TABLE IF NOT EXISTS order_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id        text UNIQUE,                -- '<orderMongoId>:label' / '<orderMongoId>:pod' (idempotence)
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('label', 'pod')),
  content_base64  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, kind)
);
DROP TRIGGER IF EXISTS order_documents_set_updated_at ON order_documents;
CREATE TRIGGER order_documents_set_updated_at BEFORE UPDATE ON order_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- invoices (instantané figé — jamais modifié ni supprimé)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id           text UNIQUE,
  invoice_number     text NOT NULL UNIQUE,
  year               integer NOT NULL,
  sequence           integer NOT NULL,
  order_id           uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT, -- une facture ne doit pas disparaître
  order_number       bigint,
  -- customer.*
  customer_firstname    text,
  customer_lastname     text,
  customer_email        text,
  customer_company      text,
  customer_address      text,
  customer_city         text,
  customer_postal_code  text,
  customer_country      text,
  subtotal_ttc       numeric,
  shipping_fee_ttc   numeric,
  promo_discount     numeric NOT NULL DEFAULT 0,
  vat_applicable     boolean NOT NULL DEFAULT false,
  vat_rate           numeric NOT NULL DEFAULT 0,
  total_ht           numeric,
  vat_amount         numeric,
  total_ttc          numeric,
  -- sellerSnapshot.*
  seller_company_name  text,
  seller_legal_form    text,
  seller_address       text,
  seller_city          text,
  seller_postal_code   text,
  seller_siret         text,
  seller_vat_number    text,
  seller_iban          text,
  -- pdfBase64 -> invoice_documents (kind = 'pdf')
  issued_at         timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, sequence)                     -- AJOUT : garantit l'unicité de la séquence par année
);
CREATE INDEX IF NOT EXISTS invoices_issued_at_idx ON invoices (issued_at DESC);
DROP TRIGGER IF EXISTS invoices_set_updated_at ON invoices;
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- invoices.lineItems[]
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id        text UNIQUE,
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position        integer NOT NULL,
  name            text,
  quantity        integer,
  unit_price_ttc  numeric,
  total_ttc       numeric
);
CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_id_idx ON invoice_line_items (invoice_id, position);

-- invoices.pdfBase64 — séparé pour garder invoices légère (même principe que order_documents)
CREATE TABLE IF NOT EXISTS invoice_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id        text UNIQUE,                -- '<invoiceMongoId>:pdf' (idempotence)
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'pdf' CHECK (kind IN ('pdf')),
  content_base64  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, kind)
);
DROP TRIGGER IF EXISTS invoice_documents_set_updated_at ON invoice_documents;
CREATE TRIGGER invoice_documents_set_updated_at BEFORE UPDATE ON invoice_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- promo_codes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_codes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id          text UNIQUE,
  code              text NOT NULL UNIQUE CHECK (code = upper(btrim(code))),
  type              text NOT NULL CHECK (type IN ('percent', 'fixed')),
  value             numeric NOT NULL CHECK (value >= 0),
  min_order_amount  numeric NOT NULL DEFAULT 0,
  max_uses          integer,
  used_count        integer NOT NULL DEFAULT 0,
  active            boolean NOT NULL DEFAULT true,
  expires_at        timestamptz,
  is_referral       boolean NOT NULL DEFAULT false,
  referrer_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  filleul_percent   numeric,
  parrain_percent   numeric,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
-- AJOUT : my-code et la suppression client cherchent par (is_referral, referrer_id)
CREATE INDEX IF NOT EXISTS promo_codes_referrer_id_idx ON promo_codes (referrer_id) WHERE referrer_id IS NOT NULL;
DROP TRIGGER IF EXISTS promo_codes_set_updated_at ON promo_codes;
CREATE TRIGGER promo_codes_set_updated_at BEFORE UPDATE ON promo_codes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- promo_codes.usedByUserIds[] ($push : doublons possibles, donc pas de UNIQUE)
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id        text UNIQUE,                -- '<promoMongoId>:<index>' (idempotence)
  promo_code_id   uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  position        integer NOT NULL,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  user_mongo_id   text,                       -- conservé si l'utilisateur n'existe plus
  created_at      timestamptz NOT NULL DEFAULT now()  -- inconnu en Mongo : = date de migration
);
CREATE INDEX IF NOT EXISTS promo_code_uses_promo_user_idx ON promo_code_uses (promo_code_id, user_id);

-- -----------------------------------------------------------------------------
-- referral_configs (singleton : une seule ligne, imposé par l'index unique sur une constante)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_configs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id              text UNIQUE,
  total_percent         numeric NOT NULL DEFAULT 10 CHECK (total_percent BETWEEN 1 AND 100),
  reward_validity_days  integer NOT NULL DEFAULT 30,
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS referral_configs_singleton ON referral_configs ((true));
DROP TRIGGER IF EXISTS referral_configs_set_updated_at ON referral_configs;
CREATE TRIGGER referral_configs_set_updated_at BEFORE UPDATE ON referral_configs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- site_settings (singleton : une seule ligne, imposé par l'index unique sur une constante)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id                text UNIQUE,
  maintenance_mode        boolean NOT NULL DEFAULT false,
  billing_company_name    text NOT NULL DEFAULT '',
  billing_legal_form      text NOT NULL DEFAULT '',
  billing_address         text NOT NULL DEFAULT '',
  billing_city            text NOT NULL DEFAULT '',
  billing_postal_code     text NOT NULL DEFAULT '',
  billing_siret           text NOT NULL DEFAULT '',
  billing_vat_number      text NOT NULL DEFAULT '',
  billing_vat_applicable  boolean NOT NULL DEFAULT false,
  billing_vat_rate        numeric NOT NULL DEFAULT 20,
  billing_iban            text NOT NULL DEFAULT '',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_settings_singleton ON site_settings ((true));
DROP TRIGGER IF EXISTS site_settings_set_updated_at ON site_settings;
CREATE TRIGGER site_settings_set_updated_at BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- gallery_photos  ("order" est un mot réservé SQL -> sort_order)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gallery_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id    text UNIQUE,
  url         text NOT NULL,
  public_id   text,
  sort_order  integer NOT NULL DEFAULT 0,
  alt         text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gallery_photos_sort_idx ON gallery_photos (sort_order, created_at);
DROP TRIGGER IF EXISTS gallery_photos_set_updated_at ON gallery_photos;
CREATE TRIGGER gallery_photos_set_updated_at BEFORE UPDATE ON gallery_photos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- rate_limit_attempts
-- Pas de TTL natif en PostgreSQL : purge à faire en phase 3, par ex. dans checkRateLimit :
--   DELETE FROM rate_limit_attempts WHERE created_at < now() - interval '1 day';
-- (ou via pg_cron si activé sur Neon)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id    text UNIQUE,
  key         text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- index { key: 1 } Mongo, élargi en (key, created_at) pour la requête countDocuments par fenêtre
CREATE INDEX IF NOT EXISTS rate_limit_attempts_key_created_at_idx ON rate_limit_attempts (key, created_at);
-- remplace l'index TTL { createdAt: 1 } (sert à la purge)
CREATE INDEX IF NOT EXISTS rate_limit_attempts_created_at_idx     ON rate_limit_attempts (created_at);

COMMIT;
