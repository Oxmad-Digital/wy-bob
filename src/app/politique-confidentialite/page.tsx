import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import '../page.css';
import styles from './politique-confidentialite.module.css';

export const metadata = {
  title: 'Politique de Confidentialité',
  description: 'Politique de confidentialité et protection des données personnelles de Wybob',
  alternates: { canonical: '/politique-confidentialite' },
};

export default function PolitiqueConfidentialite() {
  return (
    <div className="container">
      <Navbar />

      <div className={`${styles.privacyZone} privacyZone`}>
        <div className={styles.content}>

          <h1 className={styles.title}>Politique de Confidentialité</h1>

          {/* 1. Responsable du traitement */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>1.</span>
              Responsable du traitement
            </h2>
            <p className={styles.text}>
              Le responsable du traitement des données personnelles collectées sur le site est :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Responsable :</span> Penelope WYBO EI (nom commercial : WYBOB), entrepreneur individuel</li>
              <li><span className={styles.label}>Adresse :</span> 10 rue André Lefebvre, 75015 Paris, France</li>
              <li>
                <span className={styles.label}>Contact :</span>{' '}
                <a href="mailto:contact@wybob.fr" className={styles.link}>contact@wybob.fr</a>{' '}
                <strong>[À COMPLÉTER : confirmer l'adresse email de contact unique, identique sur les mentions légales, la politique de confidentialité et les CGV]</strong>
              </li>
            </ul>
          </section>

          {/* 2. Données collectées */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>2.</span>
              Données collectées
            </h2>
            <p className={styles.text}>
              Selon la manière dont vous utilisez le site, nous collectons les données suivantes :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Compte client :</span> Nom, adresse email, mot de passe (enregistré uniquement sous forme hachée), numéro de téléphone (facultatif), adresses de livraison que vous choisissez d'enregistrer, date de dernière connexion et nombre de tentatives de connexion échouées.</li>
              <li><span className={styles.label}>Commande (avec ou sans compte) :</span> Prénom, nom, adresse email, numéro de téléphone (facultatif), entreprise (facultatif), adresse, code postal, ville et pays de livraison, point relais choisi et personne habilitée à retirer le colis, produits commandés, montants, code promotionnel utilisé, option d'assurance du colis, numéro de suivi et historique de livraison, étiquette d'expédition et preuve de livraison établies par le transporteur (cette preuve peut comporter la signature du destinataire).</li>
              <li><span className={styles.label}>Paiement :</span> Moyen de paiement utilisé, montants payés, remboursés ou demandés en complément. Les données de carte bancaire sont saisies directement chez notre prestataire de paiement et ne nous sont jamais transmises.</li>
              <li><span className={styles.label}>Facturation :</span> Identité, adresse et détail des achats figurant sur les factures.</li>
              <li><span className={styles.label}>Formulaire de contact :</span> Nom, adresse email, numéro de téléphone (facultatif), sujet, numéro de commande (facultatif), message et photo jointe (facultatif). Ces informations nous sont transmises par email et ne sont pas enregistrées dans la base de données du site.</li>
              <li><span className={styles.label}>Parrainage :</span> Code de parrainage attribué, utilisation de ce code par un filleul, et adresse email du parrain pour l'envoi de sa récompense.</li>
              <li><span className={styles.label}>Sécurité :</span> Adresse IP, conservée environ 24 heures pour limiter les tentatives répétées (connexion, inscription, formulaire de contact, commande).</li>
              <li><span className={styles.label}>Mesure d'audience interne :</span> Page consultée, site d'origine (nom de domaine uniquement), pays, type d'appareil (ordinateur, mobile, tablette) et durée de consultation, rattachés à un identifiant technique haché renouvelé chaque jour (voir section 9).</li>
              <li><span className={styles.label}>Google Analytics (uniquement avec votre accord) :</span> Pages consultées, durée de visite, informations sur votre appareil et votre navigateur, identifiants de cookies (voir section 9).</li>
            </ul>
          </section>

          {/* 3. Finalités du traitement */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>3.</span>
              Finalités du traitement
            </h2>
            <p className={styles.text}>
              Vos données personnelles sont utilisées pour les finalités suivantes :
            </p>
            <ul className={styles.list}>
              <li>Création et gestion de votre compte client</li>
              <li>Traitement, paiement, expédition et suivi de vos commandes</li>
              <li>Envoi des emails liés à votre compte et à vos commandes (vérification de votre adresse, réinitialisation du mot de passe, confirmation et suivi de commande, remboursement, paiement complémentaire)</li>
              <li>Établissement des factures et respect de nos obligations comptables</li>
              <li>Réponse à vos demandes envoyées via le formulaire de contact et gestion du service après-vente</li>
              <li>Gestion des codes promotionnels et du programme de parrainage</li>
              <li>Gestion des litiges de livraison (preuve de livraison)</li>
              <li>Sécurité du site et prévention des abus (limitation des tentatives, verrouillage temporaire d'un compte après plusieurs mots de passe erronés)</li>
              <li>Mesure de la fréquentation du site</li>
            </ul>
          </section>

          {/* 4. Base légale */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>4.</span>
              Base légale du traitement
            </h2>
            <p className={styles.text}>
              Les traitements mis en œuvre reposent sur les bases légales suivantes, conformément
              au Règlement (UE) 2016/679 (RGPD) :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Exécution d'un contrat :</span> Gestion du compte client, traitement, paiement, livraison et suivi des commandes, emails liés au compte et aux commandes, codes promotionnels et programme de parrainage.</li>
              <li><span className={styles.label}>Obligation légale :</span> Établissement et conservation des factures et pièces comptables.</li>
              <li><span className={styles.label}>Intérêt légitime :</span> Réponse aux demandes de contact et service après-vente, gestion des litiges de livraison, sécurité du site et prévention des abus, mesure d'audience interne.</li>
              <li><span className={styles.label}>Consentement :</span> Mesure d'audience par Google Analytics. Vous pouvez retirer votre consentement à tout moment (voir section 9).</li>
            </ul>
          </section>

          {/* 5. Destinataires des données */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>5.</span>
              Destinataires des données
            </h2>
            <p className={styles.text}>
              Vos données sont destinées à Penelope WYBO (WYBOB) et aux personnes qu'elle habilite à
              accéder à l'espace d'administration du site. Elles sont également transmises aux
              prestataires suivants, uniquement pour ce qui est nécessaire à leur mission :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Vercel Inc. :</span> Hébergement du site et exécution de ses traitements côté serveur. Reçoit l'ensemble des données transmises au site, ainsi que les journaux techniques (adresse IP, pages demandées), qui peuvent contenir votre adresse email.</li>
              <li><span className={styles.label}>Neon :</span> Hébergement de la base de données principale (commandes, factures, codes promotionnels, statistiques internes, adresses IP conservées pour la sécurité).</li>
              <li><span className={styles.label}>MongoDB Atlas :</span> Hébergement d'une seconde base de données, en cours de remplacement par Neon : comptes clients (identifiants, mot de passe haché, adresses enregistrées), fiches clients, codes de parrainage, ainsi que des données historiques en cours de migration.</li>
              <li><span className={styles.label}>Stripe (Stripe Payments Europe, Limited) :</span> Paiement en ligne. Reçoit les données saisies dans le formulaire de paiement (dont les données de carte bancaire, qui ne transitent pas par nos serveurs), le montant et, pour un paiement complémentaire, votre adresse email.</li>
              <li><span className={styles.label}>Amazon Pay :</span> Uniquement si vous choisissez ce moyen de paiement. Reçoit les données nécessaires au paiement, selon ses propres conditions.</li>
              <li><span className={styles.label}>Chronopost :</span> Transporteur. Reçoit le nom du destinataire, l'adresse de livraison ou le point relais choisi, le téléphone, l'adresse email, la personne habilitée à retirer le colis, le poids du colis et, pour les envois hors de France, une description douanière des produits.</li>
              <li><span className={styles.label}>Resend :</span> Envoi des emails du site. Reçoit votre adresse email, votre nom et le contenu des emails (détail de commande, adresse de livraison, montants), ainsi que les messages et photos envoyés via le formulaire de contact.</li>
              <li>
                <span className={styles.label}>Plunk :</span> Service d'envoi d'emails de secours, utilisé uniquement lorsque le quota d'envoi de Resend est atteint. Reçoit les mêmes données que Resend.{' '}
                <strong>[À COMPLÉTER : confirmer que Plunk est activé en production]</strong>
              </li>
              <li><span className={styles.label}>Google (Gmail) :</span> Messagerie qui reçoit les notifications de nouvelles commandes (identité, coordonnées, adresse et détail de la commande) et les messages du formulaire de contact.</li>
              <li><span className={styles.label}>Google Analytics (Google Ireland Limited) :</span> Mesure d'audience, uniquement avec votre accord. Reçoit des données de navigation pseudonymisées (pages consultées, durée, appareil, identifiants de cookies) ainsi que votre adresse IP.</li>
              <li><span className={styles.label}>Google Maps :</span> Affichage de la carte des points relais, uniquement si vous choisissez la livraison en point relais. Reçoit l'adresse de livraison saisie (pour la situer sur la carte) et votre adresse IP.</li>
              <li><span className={styles.label}>Cloudinary :</span> Hébergement des images du site. Certaines images étant chargées directement depuis ses serveurs, Cloudinary reçoit votre adresse IP et des informations techniques sur votre navigateur. Il ne reçoit aucune donnée de compte ou de commande.</li>
            </ul>
            <p className={styles.text}>
              Aucune vente de données à des tiers n'est effectuée.
            </p>
          </section>

          {/* 6. Transferts hors de l'Union européenne */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>6.</span>
              Transferts hors de l'Union européenne
            </h2>
            <p className={styles.text}>
              Plusieurs de nos prestataires sont établis aux États-Unis ou appartiennent à des
              groupes américains, et peuvent traiter vos données hors de l'Union européenne :
              Vercel, Resend, Google (Analytics, Maps, Gmail), Stripe, Cloudinary, Neon et
              MongoDB Atlas.
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Exécution du site (Vercel) :</span> <strong>[À COMPLÉTER : région d'exécution des fonctions serveur Vercel]</strong></li>
              <li><span className={styles.label}>Base de données Neon :</span> <strong>[À COMPLÉTER : région d'hébergement de la base Neon]</strong></li>
              <li><span className={styles.label}>Base de données MongoDB Atlas :</span> <strong>[À COMPLÉTER : région d'hébergement de la base MongoDB Atlas]</strong></li>
              <li><span className={styles.label}>Plunk :</span> <strong>[À COMPLÉTER : pays d'établissement et lieu de traitement de Plunk]</strong></li>
            </ul>
            <p className={styles.text}>
              Ces transferts sont encadrés soit par la décision d'adéquation de la Commission
              européenne du 10 juillet 2023 (cadre de protection des données UE–États-Unis, « Data
              Privacy Framework »), pour les prestataires certifiés, soit par les clauses
              contractuelles types adoptées par la Commission européenne.{' '}
              <strong>[À COMPLÉTER : vérifier, pour chaque prestataire, la garantie applicable (certification Data Privacy Framework ou clauses contractuelles types prévues dans son accord de traitement des données)]</strong>
            </p>
            <p className={styles.text}>
              Vous pouvez obtenir une copie de ces garanties en nous écrivant à l'adresse indiquée en
              section 1.
            </p>
          </section>

          {/* 7. Durée de conservation */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>7.</span>
              Durée de conservation
            </h2>
            <ul className={styles.list}>
              <li><span className={styles.label}>Factures :</span> 10 ans, conformément à l'obligation de conservation des pièces comptables (article L.123-22 du Code de commerce).</li>
              <li><span className={styles.label}>Adresses IP utilisées pour la sécurité :</span> Environ 24 heures.</li>
              <li><span className={styles.label}>Liens envoyés par email :</span> Le lien de vérification de votre adresse email expire après 24 heures, celui de réinitialisation du mot de passe après 1 heure.</li>
              <li><span className={styles.label}>Compte client :</span> <strong>[À COMPLÉTER : durée à confirmer avec la cliente]</strong></li>
              <li><span className={styles.label}>Commandes (hors factures), étiquettes et preuves de livraison :</span> <strong>[À COMPLÉTER : durée à confirmer avec la cliente]</strong></li>
              <li><span className={styles.label}>Commandes non payées :</span> <strong>[À COMPLÉTER : durée à confirmer avec la cliente]</strong></li>
              <li><span className={styles.label}>Fiches clients et codes de parrainage :</span> <strong>[À COMPLÉTER : durée à confirmer avec la cliente]</strong></li>
              <li><span className={styles.label}>Messages du formulaire de contact (boîte de réception) :</span> <strong>[À COMPLÉTER : durée à confirmer avec la cliente]</strong></li>
              <li><span className={styles.label}>Statistiques de la mesure d'audience interne :</span> <strong>[À COMPLÉTER : durée à confirmer avec la cliente]</strong></li>
              <li><span className={styles.label}>Données Google Analytics :</span> <strong>[À COMPLÉTER : durée de conservation réglée dans le compte Google Analytics]</strong></li>
            </ul>
            <p className={styles.text}>
              La durée de conservation des cookies et du stockage local est indiquée en section 9.
            </p>
          </section>

          {/* 8. Droits des utilisateurs */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>8.</span>
              Vos droits
            </h2>
            <p className={styles.text}>
              Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits
              suivants sur vos données personnelles :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Droit d'accès :</span> Obtenir une copie des données vous concernant.</li>
              <li><span className={styles.label}>Droit de rectification :</span> Corriger des données inexactes ou incomplètes.</li>
              <li><span className={styles.label}>Droit à l'effacement :</span> Demander la suppression de vos données dans les conditions prévues par la loi, sous réserve des données que nous devons conserver (factures notamment).</li>
              <li><span className={styles.label}>Droit à la portabilité :</span> Recevoir les données que vous nous avez fournies dans un format structuré et lisible.</li>
              <li><span className={styles.label}>Droit d'opposition :</span> Vous opposer, pour des raisons tenant à votre situation particulière, aux traitements fondés sur notre intérêt légitime.</li>
              <li><span className={styles.label}>Droit à la limitation :</span> Demander la suspension du traitement dans certains cas.</li>
              <li><span className={styles.label}>Retrait du consentement :</span> Retirer à tout moment votre accord à Google Analytics, via le bouton « Gérer les cookies » situé en bas de chaque page.</li>
              <li><span className={styles.label}>Directives après décès :</span> Définir des directives relatives au sort de vos données après votre décès.</li>
            </ul>
            <p className={styles.text}>
              Pour exercer vos droits, écrivez-nous à{' '}
              <a href="mailto:contact@wybob.fr" className={styles.link}>contact@wybob.fr</a>{' '}
              <strong>[À COMPLÉTER : confirmer l'adresse email de contact unique]</strong>.
              Nous vous répondrons dans un délai d'un mois à compter de la réception de votre
              demande. Ce délai peut être prolongé de deux mois en raison de la complexité ou du
              nombre de demandes ; nous vous en informerions alors dans le premier mois. En cas de
              doute raisonnable sur votre identité, nous pourrons vous demander des informations
              complémentaires pour la vérifier.
            </p>
            <p className={styles.text}>
              Depuis votre espace client, vous pouvez également modifier vous-même votre nom, votre
              numéro de téléphone et vos adresses enregistrées.
            </p>
            <p className={styles.text}>
              Vous avez également le droit d'introduire une réclamation auprès de la Commission
              nationale de l'informatique et des libertés (
              <a href="https://www.cnil.fr" className={styles.link} target="_blank" rel="noopener noreferrer">
                CNIL
              </a>).
            </p>
          </section>

          {/* 9. Cookies */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>9.</span>
              Cookies et traceurs
            </h2>
            <p className={styles.text}>
              Un cookie est un petit fichier déposé sur votre appareil lors de votre visite. Le
              stockage local (« localStorage ») est un espace équivalent de votre navigateur. Le site
              utilise les cookies et traceurs suivants :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Session de connexion (nécessaire) :</span> Cookies de connexion (authjs.session-token, authjs.csrf-token, authjs.callback-url), déposés lorsque vous utilisez la connexion à votre compte. Le cookie de session est conservé 30 jours au maximum ; les deux autres sont supprimés à la fermeture du navigateur.</li>
              <li><span className={styles.label}>Paiement Stripe (nécessaire) :</span> Cookies __stripe_mid (1 an) et __stripe_sid (30 minutes), déposés par Stripe sur la page de paiement pour sécuriser le paiement et prévenir la fraude. Ces durées sont fixées par Stripe.</li>
              <li><span className={styles.label}>Panier (nécessaire) :</span> Stockage local (wybob-cart-…) qui conserve le contenu de votre panier, jusqu'à ce que vous le vidiez ou effaciez les données de votre navigateur.</li>
              <li><span className={styles.label}>Langue (nécessaire) :</span> Stockage local (wybob-locale) qui retient la langue choisie, jusqu'à ce que vous effaciez les données de votre navigateur.</li>
              <li><span className={styles.label}>Choix des cookies (nécessaire) :</span> Stockage local (wybob-cookie-consent) qui retient votre choix d'accepter ou de refuser Google Analytics, jusqu'à ce que vous effaciez les données de votre navigateur.</li>
              <li><span className={styles.label}>Google Analytics (soumis à votre accord) :</span> Cookies _ga et _ga_&lt;identifiant&gt;, déposés uniquement si vous l'acceptez, pour mesurer l'audience. Ils sont conservés 2 ans, durée par défaut de Google Analytics.</li>
              <li><span className={styles.label}>Espace d'administration :</span> Stockage local retenant des préférences d'affichage, utilisé uniquement par les administrateurs du site.</li>
              <li><span className={styles.label}>Google Maps :</span> Chargé uniquement si vous choisissez la livraison en point relais. <strong>[À COMPLÉTER : vérifier si Google Maps dépose des cookies ou d'autres traceurs]</strong></li>
            </ul>
            <p className={styles.text}>
              <span className={styles.label}>Mesure d'audience interne :</span> Nous mesurons
              également la fréquentation du site avec un outil interne, sans déposer de cookie ni
              rien enregistrer sur votre appareil. Chaque visite est rattachée à un identifiant
              technique haché, non réversible et renouvelé chaque jour, qui ne permet pas de suivre
              un visiteur d'un jour à l'autre. Votre adresse IP et les informations de votre
              navigateur servent uniquement à calculer cet identifiant et ne sont pas enregistrées
              dans ces statistiques. Les visites des administrateurs ne sont pas comptabilisées.
            </p>
            <ul className={styles.list}>
              <li>
                <span className={styles.label}>Modifier votre choix :</span> À tout moment, via le bouton
                « Gérer les cookies » situé en bas de chaque page. Les cookies Google Analytics déjà
                déposés peuvent être supprimés depuis les réglages de votre navigateur.
              </li>
              <li>
                <span className={styles.label}>Autres moyens :</span> Vous pouvez aussi configurer votre navigateur pour refuser les cookies ou utiliser le module de désactivation de Google Analytics :{' '}
                <a href="https://tools.google.com/dlpage/gaoptout" className={styles.link} target="_blank" rel="noopener noreferrer">
                  https://tools.google.com/dlpage/gaoptout
                </a>.
              </li>
            </ul>
          </section>

          {/* 10. Sécurité */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>10.</span>
              Sécurité des données
            </h2>
            <p className={styles.text}>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour
              protéger vos données contre tout accès non autorisé, perte ou divulgation. Les
              échanges de données sont chiffrés via le protocole HTTPS (SSL/TLS). En cas de
              violation de données susceptible d'engendrer un risque pour vos droits et libertés,
              nous nous engageons à notifier la CNIL dans les 72 heures.
            </p>
          </section>

          {/* 11. Modifications */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>11.</span>
              Modifications de la politique
            </h2>
            <p className={styles.text}>
              La présente politique de confidentialité peut être mise à jour à tout moment afin de
              refléter les évolutions légales, réglementaires ou techniques. La date de dernière
              mise à jour est indiquée en bas de page. Nous vous encourageons à la consulter
              régulièrement.
            </p>
            <p className={styles.text}>
              Dernière mise à jour : novembre 2026.
            </p>
          </section>

        </div>
      </div>

      <Footer />
    </div>
  );
}
