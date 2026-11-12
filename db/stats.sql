-- =============================================================================
-- Wybob — statistiques de visite (sans cookie, sans donnée personnelle)
-- À relire puis exécuter manuellement dans Neon. Idempotent (IF NOT EXISTS).
--
-- Une ligne = une page vue.
--   * id            : identifiant aléatoire de la page vue, tiré par le navigateur
--                     (crypto.randomUUID), jamais stocké côté client. Il sert uniquement
--                     à rattacher l'événement de sortie (durée) à sa page vue.
--   * visitor_hash  : sha256(sel secret + jour + IP + user-agent), en hexadécimal.
--                     Change chaque jour → impossible de suivre quelqu'un d'un jour à l'autre.
--                     Ni l'IP ni le user-agent ne sont stockés.
--   * path          : chemin sans query string ni fragment (ex. "/galerie").
--   * referrer      : nom de domaine référent (ex. "google.com"), NULL = "Direct"
--                     (le propre domaine du site est enregistré NULL).
--   * is_entry      : true pour la première page vue d'un chargement de page
--                     (c'est là que le référent a un sens ; utilisé pour "Provenance").
--   * country       : code ISO 3166-1 alpha-2 issu de x-vercel-ip-country, NULL = inconnu.
--   * device        : desktop | mobile | tablet (déduit du user-agent).
--   * duration_s    : temps visible sur la page, en secondes, plafonné à 30 min,
--                     mis à jour à la sortie de la page (visibilitychange).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS site_visits (
  id            uuid        PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  visitor_hash  text        NOT NULL CHECK (visitor_hash ~ '^[0-9a-f]{64}$'),
  path          text        NOT NULL CHECK (char_length(path) BETWEEN 1 AND 300 AND left(path, 1) = '/'),
  referrer      text        NULL     CHECK (referrer IS NULL OR char_length(referrer) BETWEEN 1 AND 253),
  is_entry      boolean     NOT NULL DEFAULT false,
  country       char(2)     NULL     CHECK (country IS NULL OR country ~ '^[A-Z]{2}$'),
  device        text        NOT NULL CHECK (device IN ('desktop', 'mobile', 'tablet')),
  duration_s    integer     NOT NULL DEFAULT 0 CHECK (duration_s BETWEEN 0 AND 1800)
);

-- Filtre par période (toutes les agrégations) : vues, visiteurs uniques, séries temporelles.
-- visitor_hash inclus pour permettre des index-only scans sur count(DISTINCT visitor_hash).
CREATE INDEX IF NOT EXISTS site_visits_created_at_idx
  ON site_visits (created_at) INCLUDE (visitor_hash);

-- Pages les plus vues / filtre par page.
CREATE INDEX IF NOT EXISTS site_visits_path_created_at_idx
  ON site_visits (path, created_at);

-- Origine géographique / filtre par pays.
CREATE INDEX IF NOT EXISTS site_visits_country_created_at_idx
  ON site_visits (country, created_at);

-- Provenance : seules les pages d'entrée portent un référent significatif.
CREATE INDEX IF NOT EXISTS site_visits_entry_created_at_idx
  ON site_visits (created_at) INCLUDE (referrer)
  WHERE is_entry;

COMMIT;

-- -----------------------------------------------------------------------------
-- Rétention (optionnel, NON exécuté ici) : la CNIL recommande de ne pas conserver
-- les données de mesure d'audience plus de 25 mois. À lancer à la main ou via un cron :
--   DELETE FROM site_visits WHERE created_at < now() - interval '25 months';
-- -----------------------------------------------------------------------------
