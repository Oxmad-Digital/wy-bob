import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import '../page.css';
import styles from './mentions-legales.module.css';

export const metadata = {
  title: 'Mentions Légales',
  description: 'Mentions légales du site',
  alternates: { canonical: '/mentions-legales' },
};

export default function MentionsLegales() {
  return (
    <div className="container">
      <Navbar />

      <div className={`${styles.mentionsZone} mentionsZone`}>
        <div className={styles.content}>

          <h1 className={styles.title}>Mentions Légales</h1>

          {/* 1. Édition du site */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>1.</span>
              Édition du site
            </h2>
            <p className={styles.text}>
              Le présent site, accessible à l'URL{' '}
              <a href="https://www.wybob.fr" className={styles.link}>
                https://www.wybob.fr
              </a>
              , est édité par :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Dénomination :</span> Penelope WYBO (nom commercial : WYBOB)</li>
              <li><span className={styles.label}>Forme juridique :</span> Entrepreneur individuel</li>
              <li><span className={styles.label}>Siège social :</span> 10 rue André Lefebvre, 75015 Paris, France</li>
              <li><span className={styles.label}>SIRET :</span> 106 049 539 00013</li>
              <li><span className={styles.label}>Immatriculation :</span> Registre National des Entreprises (RNE)</li>
              <li><span className={styles.label}>TVA :</span> TVA non applicable, article 293 B du Code général des impôts</li>
              <li><span className={styles.label}>Directrice de la publication :</span> Penelope WYBO</li>
              <li><span className={styles.label}>Contact :</span> <a href="mailto:contact@wybob.fr" className={styles.link}>contact@wybob.fr</a></li>
            </ul>
          </section>

          {/* 2. Hébergement */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>2.</span>
              Hébergement
            </h2>
            <p className={styles.text}>
              Le Site est hébergé par la société Vercel Inc., dont le siège social est situé au
              340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.
            </p>
          </section>

          {/* 3. Propriété intellectuelle */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>3.</span>
              Propriété intellectuelle
            </h2>
            <p className={styles.text}>
              L'ensemble du contenu de ce site (textes, logos, graphismes, icônes, structures
              techniques) est la propriété exclusive de Penelope WYBO (WYBOB). Toute reproduction,
              représentation, modification ou adaptation de tout ou partie des éléments du site est
              strictement interdite sans autorisation écrite préalable.
            </p>
          </section>

          {/* 4. Protection des données personnelles (RGPD) */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>4.</span>
              Protection des données personnelles (RGPD)
            </h2>
            <p className={styles.text}>
              Conformément au Règlement (UE) 2016/679, l'Éditeur s'engage à protéger la vie privée
              de ses utilisateurs.
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Responsable du traitement :</span> Penelope WYBO</li>
              <li><span className={styles.label}>Finalités :</span> Gestion des commandes, envois de newsletters (si applicable), amélioration de la navigation via cookies.</li>
              <li><span className={styles.label}>Droits des utilisateurs :</span> Vous disposez d'un droit d'accès, de rectification, de suppression et d'opposition. Pour exercer ce droit, contactez-nous à : <a href="mailto:contact@wybob.fr" className={styles.link}>contact@wybob.fr</a>.</li>
            </ul>
          </section>

          {/* 5. Politique de Cookies et Mesure d'Audience */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>5.</span>
              Politique de Cookies et Mesure d'Audience
            </h2>
            <p className={styles.text}>
              Le site utilise des cookies pour améliorer l'expérience utilisateur et réaliser des
              statistiques de visites.
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Google Analytics :</span> Ce site utilise Google Analytics, un service d'analyse de site internet fourni par Google Inc. Cet outil utilise des cookies pour analyser votre navigation (pages vues, temps de session, etc.).</li>
              <li><span className={styles.label}>Anonymisation :</span> Nous avons activé l'anonymisation de l'adresse IP. Cela signifie que votre adresse IP est abrégée par Google au sein des États membres de l'Union européenne avant d'être transmise aux États-Unis.</li>
              <li><span className={styles.label}>Consentement :</span> Aucun cookie de mesure d'audience n'est déposé avant votre consentement explicite via le bandeau de cookies.</li>
              <li>
                <span className={styles.label}>Désactivation :</span> Vous pouvez vous opposer à l'enregistrement de ces cookies en
                configurant votre navigateur ou en utilisant le module de désactivation de Google :{' '}
                <a href="https://tools.google.com/dlpage/gaoptout" className={styles.link} target="_blank" rel="noopener noreferrer">
                  https://tools.google.com/dlpage/gaoptout
                </a>.
              </li>
              <li><span className={styles.label}>Durée de conservation :</span> Les données collectées via ces cookies sont conservées pour une durée maximale de 13 mois.</li>
            </ul>
          </section>

          {/* 6. Médiation de la consommation */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>6.</span>
              Médiation de la consommation
            </h2>
            <p className={styles.text}>
              Conformément aux articles L.611-1 et suivants du Code de la consommation, en cas de
              litige non résolu par notre service client, vous pouvez recourir gratuitement au
              médiateur de la consommation suivant :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Organisme de médiation :</span> [Nom du médiateur, ex: FEVAD, CM2C, etc.]</li>
              <li>
                <span className={styles.label}>Adresse / Site web :</span>{' '}
                <a href="#" className={styles.link} target="_blank" rel="noopener noreferrer">
                  [Lien vers le site du médiateur]
                </a>
              </li>
            </ul>
          </section>

          {/* 7. Droit applicable */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>7.</span>
              Droit applicable
            </h2>
            <p className={styles.text}>
              Les présentes mentions légales sont soumises au droit français. En cas de litige, et à
              défaut d'accord amiable, les tribunaux français seront seuls compétents.
            </p>
          </section>

        </div>
      </div>

      <Footer />
    </div>
  );
}
