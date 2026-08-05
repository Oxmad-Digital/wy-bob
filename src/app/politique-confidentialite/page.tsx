import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import '../page.css';
import styles from './politique-confidentialite.module.css';

export const metadata = {
  title: 'Politique de Confidentialité',
  description: 'Politique de confidentialité et protection des données personnelles de Wybob',
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
              <li><span className={styles.label}>Société :</span> WYBOB — Penelope WYBO, entrepreneur individuel</li>
              <li><span className={styles.label}>Siège social :</span> 10 rue André Lefebvre, 75015 Paris, France</li>
              <li><span className={styles.label}>Contact :</span> <a href="mailto:contact@wybob.fr" className={styles.link}>contact@wybob.fr</a></li>
            </ul>
          </section>

          {/* 2. Données collectées */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>2.</span>
              Données collectées
            </h2>
            <p className={styles.text}>
              Dans le cadre de l'utilisation de notre site et de nos services, nous sommes amenés
              à collecter les catégories de données suivantes :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Données d'identification :</span> Nom, prénom, adresse email, numéro de téléphone.</li>
              <li><span className={styles.label}>Données de livraison :</span> Adresse postale de livraison et de facturation.</li>
              <li><span className={styles.label}>Données de transaction :</span> Historique des commandes, montants, moyens de paiement utilisés (hors données bancaires complètes).</li>
              <li><span className={styles.label}>Données de navigation :</span> Adresse IP, pages visitées, durée de session, via des cookies (voir section 8).</li>
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
              <li>Traitement et suivi de vos commandes</li>
              <li>Envoi de confirmations et notifications liées à vos achats</li>
              <li>Gestion du service après-vente et des retours</li>
              <li>Amélioration de notre site et de nos services</li>
              <li>Envoi de communications commerciales (avec votre consentement)</li>
              <li>Respect de nos obligations légales et comptables</li>
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
              <li><span className={styles.label}>Exécution d'un contrat :</span> Traitement et livraison des commandes, gestion du compte client.</li>
              <li><span className={styles.label}>Obligation légale :</span> Archivage comptable et fiscal, lutte contre la fraude.</li>
              <li><span className={styles.label}>Intérêt légitime :</span> Amélioration de nos services, sécurité du site.</li>
              <li><span className={styles.label}>Consentement :</span> Envoi de newsletters et communications marketing.</li>
            </ul>
          </section>

          {/* 5. Destinataires des données */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>5.</span>
              Destinataires des données
            </h2>
            <p className={styles.text}>
              Vos données sont strictement confidentielles. Elles peuvent être transmises aux
              sous-traitants suivants, dans le cadre de la réalisation de nos services :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Stripe :</span> Prestataire de paiement en ligne sécurisé.</li>
              <li><span className={styles.label}>Transporteurs :</span> Partenaires logistiques pour la livraison des commandes.</li>
              <li><span className={styles.label}>Hébergeur :</span> Vercel Inc. pour l'hébergement du site et des données.</li>
              <li><span className={styles.label}>Google Analytics :</span> Analyse de la fréquentation du site (données anonymisées).</li>
            </ul>
            <p className={styles.text}>
              Ces sous-traitants sont contractuellement tenus de respecter la confidentialité et
              la sécurité de vos données. Aucune vente de données à des tiers n'est effectuée.
            </p>
          </section>

          {/* 6. Durée de conservation */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>6.</span>
              Durée de conservation
            </h2>
            <ul className={styles.list}>
              <li><span className={styles.label}>Données clients actifs :</span> Conservées pendant toute la durée de la relation commerciale, puis 3 ans à compter du dernier achat.</li>
              <li><span className={styles.label}>Données de commandes :</span> 10 ans pour les pièces comptables, conformément aux obligations légales.</li>
              <li><span className={styles.label}>Données de navigation :</span> 13 mois maximum.</li>
              <li><span className={styles.label}>Données de prospection :</span> 3 ans à compter du dernier contact ou retrait du consentement.</li>
            </ul>
          </section>

          {/* 7. Droits des utilisateurs */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>7.</span>
              Vos droits
            </h2>
            <p className={styles.text}>
              Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits
              suivants sur vos données personnelles :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Droit d'accès :</span> Obtenir une copie des données vous concernant.</li>
              <li><span className={styles.label}>Droit de rectification :</span> Corriger des données inexactes ou incomplètes.</li>
              <li><span className={styles.label}>Droit à l'effacement :</span> Demander la suppression de vos données dans les conditions prévues par la loi.</li>
              <li><span className={styles.label}>Droit à la portabilité :</span> Recevoir vos données dans un format structuré et lisible.</li>
              <li><span className={styles.label}>Droit d'opposition :</span> Vous opposer à tout moment au traitement à des fins de prospection.</li>
              <li><span className={styles.label}>Droit à la limitation :</span> Demander la suspension du traitement dans certains cas.</li>
            </ul>
            <p className={styles.text}>
              Pour exercer vos droits, contactez-nous à{' '}
              <a href="mailto:contact@wybob.fr" className={styles.link}>contact@wybob.fr</a>.
              Vous avez également le droit d'introduire une réclamation auprès de la{' '}
              <a href="https://www.cnil.fr" className={styles.link} target="_blank" rel="noopener noreferrer">
                CNIL
              </a>.
            </p>
          </section>

          {/* 8. Cookies */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>8.</span>
              Cookies
            </h2>
            <p className={styles.text}>
              Notre site utilise des cookies pour améliorer votre expérience de navigation et
              analyser la fréquentation. Un cookie est un petit fichier texte déposé sur votre
              terminal lors de votre visite.
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Cookies essentiels :</span> Nécessaires au fonctionnement du site (panier, session, authentification). Pas de consentement requis.</li>
              <li><span className={styles.label}>Cookies analytiques :</span> Google Analytics — mesure d'audience, avec anonymisation de l'IP. Déposés uniquement avec votre consentement.</li>
              <li><span className={styles.label}>Durée :</span> Les cookies analytiques sont conservés 13 mois maximum.</li>
              <li>
                <span className={styles.label}>Désactivation :</span> Vous pouvez configurer votre navigateur pour refuser les cookies ou utiliser le module Google :{' '}
                <a href="https://tools.google.com/dlpage/gaoptout" className={styles.link} target="_blank" rel="noopener noreferrer">
                  https://tools.google.com/dlpage/gaoptout
                </a>.
              </li>
            </ul>
          </section>

          {/* 9. Sécurité */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>9.</span>
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

          {/* 10. Modifications */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>10.</span>
              Modifications de la politique
            </h2>
            <p className={styles.text}>
              La présente politique de confidentialité peut être mise à jour à tout moment afin de
              refléter les évolutions légales, réglementaires ou techniques. La date de dernière
              mise à jour est indiquée en bas de page. Nous vous encourageons à la consulter
              régulièrement.
            </p>
            <p className={styles.text}>
              Dernière mise à jour : juin 2026.
            </p>
          </section>

        </div>
      </div>

      <Footer />
    </div>
  );
}
