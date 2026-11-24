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
              <a href="https://wybob.shop/" className={styles.link}>
                https://wybob.shop/
              </a>
              , est édité par :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Dénomination :</span> Penelope WYBO EI (nom commercial : WYBOB)</li>
              <li><span className={styles.label}>Forme juridique :</span> Entrepreneur individuel (EI)</li>
              <li><span className={styles.label}>Adresse :</span> 10 rue André Lefebvre, 75015 Paris, France</li>
              <li><span className={styles.label}>Téléphone :</span> <strong>[À COMPLÉTER : numéro de téléphone de l'éditrice]</strong></li>
              <li>
                <span className={styles.label}>Email :</span>{' '}
                <a href="mailto:wybopenelopemarie@gmail.com" className={styles.link}>wybopenelopemarie@gmail.com</a>{' '}
                <strong>[À COMPLÉTER : confirmer l'adresse email de contact unique, identique sur les mentions légales, la politique de confidentialité et les CGV]</strong>
              </li>
              <li><span className={styles.label}>SIRET :</span> 106 049 539 00013</li>
              <li><span className={styles.label}>Immatriculation :</span> Registre National des Entreprises (RNE)</li>
              <li><span className={styles.label}>TVA :</span> TVA non applicable, article 293 B du Code général des impôts</li>
              <li><span className={styles.label}>Directrice de la publication :</span> Penelope WYBO</li>
            </ul>
          </section>

          {/* 2. Hébergement */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>2.</span>
              Hébergement
            </h2>
            <p className={styles.text}>
              Le site est hébergé par :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Hébergeur :</span> Vercel Inc.</li>
              <li><span className={styles.label}>Adresse :</span> <strong>[À COMPLÉTER : adresse postale actuelle de Vercel Inc., à vérifier sur vercel.com/legal]</strong></li>
              <li><span className={styles.label}>Téléphone :</span> <strong>[À COMPLÉTER : numéro de téléphone de Vercel Inc.]</strong></li>
              <li>
                <span className={styles.label}>Site web :</span>{' '}
                <a href="https://vercel.com" className={styles.link} target="_blank" rel="noopener noreferrer">
                  https://vercel.com
                </a>
              </li>
            </ul>
            <p className={styles.text}>
              Les données du site (comptes clients, commandes) sont stockées chez des prestataires
              distincts, présentés dans notre{' '}
              <a href="/politique-confidentialite" className={styles.link}>Politique de confidentialité</a>.
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
              Le traitement de vos données personnelles (responsable du traitement, finalités, bases
              légales, destinataires, durées de conservation et procédure pour exercer vos droits) est
              décrit en détail dans notre{' '}
              <a href="/politique-confidentialite" className={styles.link}>Politique de confidentialité</a>.
            </p>
            <ul className={styles.list}>
              <li>
                <span className={styles.label}>Exercer vos droits :</span> Vous disposez notamment d'un droit
                d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité. Pour
                les exercer, écrivez-nous à :{' '}
                <a href="mailto:wybopenelopemarie@gmail.com" className={styles.link}>wybopenelopemarie@gmail.com</a>{' '}
                <strong>[À COMPLÉTER : confirmer l'adresse email de contact unique]</strong>.
              </li>
              <li>
                <span className={styles.label}>Réclamation :</span> Vous pouvez introduire une réclamation auprès de
                la Commission nationale de l'informatique et des libertés (CNIL) :{' '}
                <a href="https://www.cnil.fr" className={styles.link} target="_blank" rel="noopener noreferrer">
                  https://www.cnil.fr
                </a>.
              </li>
            </ul>
          </section>

          {/* 5. Politique de Cookies et Mesure d'Audience */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>5.</span>
              Politique de Cookies et Mesure d'Audience
            </h2>
            <ul className={styles.list}>
              <li>
                <span className={styles.label}>Google Analytics :</span> Ce service de mesure d'audience, fourni
                par Google Ireland Limited (avec des transferts possibles vers Google LLC aux États-Unis), n'est
                chargé qu'après votre accord donné via le bandeau de cookies. Sans votre accord, aucun cookie
                Google Analytics n'est déposé.
              </li>
              <li>
                <span className={styles.label}>Statistiques internes :</span> Nous mesurons également la
                fréquentation du site avec un outil interne, sans déposer de cookie ni rien enregistrer sur
                votre appareil. Chaque visite est rattachée à un identifiant technique haché, non réversible et
                renouvelé chaque jour, qui ne permet pas de suivre un visiteur d'un jour à l'autre.
              </li>
              <li>
                <span className={styles.label}>Modifier votre choix :</span> À tout moment, via le bouton
                « Gérer les cookies » situé en bas de chaque page.
              </li>
              <li>
                <span className={styles.label}>En savoir plus :</span> La liste complète des cookies et
                traceurs utilisés, ainsi que leurs durées de conservation, figure dans notre{' '}
                <a href="/politique-confidentialite" className={styles.link}>Politique de confidentialité</a>.
              </li>
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
              <li><span className={styles.label}>Organisme de médiation :</span> CM2C (Centre de la Médiation de la Consommation de Conciliateurs de Justice)</li>
              <li><span className={styles.label}>Adresse :</span> <strong>[À COMPLÉTER : adresse postale du CM2C, à vérifier sur cm2c.net]</strong></li>
              <li>
                <span className={styles.label}>Site web :</span>{' '}
                <a href="https://www.cm2c.net" className={styles.link} target="_blank" rel="noopener noreferrer">
                  https://www.cm2c.net
                </a>
              </li>
              <li><strong>[À COMPLÉTER : confirmer l'adhésion effective de WYBOB au CM2C]</strong></li>
            </ul>
            <p className={styles.text}>
              Avant de saisir le médiateur, vous devez avoir tenté de résoudre le litige directement
              auprès de nous par une réclamation écrite.
            </p>
          </section>

          {/* 7. Droit applicable */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>7.</span>
              Droit applicable
            </h2>
            <p className={styles.text}>
              Les présentes mentions légales sont soumises au droit français. En cas de litige, et à
              défaut d'accord amiable, les tribunaux français sont compétents. Si vous êtes
              consommateur, vous conservez la possibilité de saisir la juridiction de votre lieu de
              domicile et de bénéficier des dispositions protectrices du droit de votre pays de
              résidence.
            </p>
          </section>

          <p className={styles.text}>
            Dernière mise à jour : novembre 2026.
          </p>

        </div>
      </div>

      <Footer />
    </div>
  );
}
