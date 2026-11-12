'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

// Mesure d'audience anonyme : aucun cookie, aucun localStorage. Chaque page vue reçoit un
// identifiant aléatoire (en mémoire seulement) qui sert à lui rattacher sa durée de visite.
// Toute erreur est avalée : le tracker ne doit jamais gêner la navigation.

const ENDPOINT = '/api/track';
const EXCLUDED_PATH_RE = /^\/(admin|api|auth)(\/|$)/i;

function post(payload, { beacon = false } = {}) {
  try {
    const body = JSON.stringify(payload);
    if (beacon && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
    }
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {});
  } catch {
    // Navigateur trop ancien ou payload refusé : on abandonne silencieusement.
  }
}

export default function VisitTracker() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const sessionReady = status !== 'loading';
  // Première page vue de ce chargement de document : c'est elle qui porte le référent.
  const isFirstView = useRef(true);

  useEffect(() => {
    // On attend de savoir si l'utilisateur est admin avant d'envoyer quoi que ce soit.
    if (!sessionReady || isAdmin || !pathname || EXCLUDED_PATH_RE.test(pathname)) return;
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') return;

    const id = crypto.randomUUID();
    const isEntry = isFirstView.current;
    isFirstView.current = false;

    post({
      type: 'view',
      id,
      path: pathname,
      referrer: isEntry ? document.referrer || null : null,
      is_entry: isEntry,
    });

    // Temps passé onglet visible sur cette page.
    let visibleMs = 0;
    let visibleSince = document.visibilityState === 'visible' ? performance.now() : null;
    let leaveSent = false;

    const pause = () => {
      if (visibleSince !== null) {
        visibleMs += performance.now() - visibleSince;
        visibleSince = null;
      }
    };

    // Le serveur n'accepte qu'une durée par page vue : on l'envoie une fois, à la
    // première sortie (onglet masqué, fermeture, ou navigation vers une autre page).
    const sendLeave = () => {
      pause();
      if (leaveSent) return;
      const duration = Math.round(visibleMs / 1000);
      if (duration < 1) return;
      leaveSent = true;
      post({ type: 'leave', id, duration }, { beacon: true });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') sendLeave();
      else if (visibleSince === null) visibleSince = performance.now();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sendLeave(); // navigation interne vers une autre page
    };
  }, [pathname, sessionReady, isAdmin]);

  return null;
}
