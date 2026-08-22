import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import '../page.css';
import styles from './cgv.module.css';

export const metadata = {
  title: 'Conditions Générales de Vente',
  description: 'Conditions générales de vente du site Wybob',
};

export default function CGV() {
  return (
    <div className="container">
      <Navbar />

      <div className={`${styles.cgvZone} cgvZone`}>
        <div className={styles.content}>

          <h1 className={styles.title}>Conditions Générales de Vente</h1>

          {/* 1. Objet */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>1.</span>
              Objet
            </h2>
            <p className={styles.text}>
              Les présentes Conditions Générales de Vente (CGV) régissent l'ensemble des ventes
              conclues entre la société Wybob et ses clients via le site internet{' '}
              <a href="https://www.wybob.fr" className={styles.link}>https://www.wybob.fr</a>.
              Tout achat implique l'acceptation pleine et entière des présentes CGV.
            </p>
          </section>

          {/* 2. Produits */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>2.</span>
              Produits
            </h2>
            <p className={styles.text}>
              Les produits proposés à la vente sont ceux figurant sur le site au moment de la
              consultation par l'acheteur. Les photographies et descriptions des produits sont
              fournies à titre indicatif et ne sont pas contractuelles. Wybob se réserve le droit
              de modifier l'assortiment de produits à tout moment.
            </p>
          </section>

          {/* 3. Prix */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>3.</span>
              Prix
            </h2>
            <p className={styles.text}>
              Les prix des produits sont indiqués en euros (€) toutes taxes comprises (TTC). Les
              frais de livraison sont indiqués séparément avant la validation de la commande.
              Wybob se réserve le droit de modifier ses prix à tout moment, étant entendu que le
              prix applicable est celui en vigueur au moment de la validation de la commande.
            </p>
          </section>

          {/* 4. Commandes */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>4.</span>
              Commandes
            </h2>
            <p className={styles.text}>
              Pour passer commande, le client doit créer un compte ou se connecter à son espace
              personnel. La commande est définitivement enregistrée après validation du paiement.
              Un email de confirmation est envoyé à l'adresse fournie lors de l'inscription.
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Disponibilité :</span> Les commandes sont traitées sous réserve de disponibilité des produits en stock.</li>
              <li><span className={styles.label}>Modification :</span> Toute modification de commande après validation est soumise à acceptation de Wybob.</li>
              <li><span className={styles.label}>Annulation :</span> L'annulation d'une commande est possible avant son expédition, en contactant notre service client.</li>
            </ul>
          </section>

          {/* 5. Paiement */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>5.</span>
              Paiement
            </h2>
            <p className={styles.text}>
              Le paiement s'effectue en ligne, de manière sécurisée, via la plateforme Stripe.
              Les moyens de paiement acceptés sont : carte bancaire (Visa, Mastercard, American
              Express) et Amazon Pay. Le débit est effectué au moment de la validation de la commande. Les
              données bancaires sont cryptées et ne sont jamais stockées sur nos serveurs.
            </p>
          </section>

          {/* 6. Livraison */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>6.</span>
              Livraison
            </h2>
            <p className={styles.text}>
              Les livraisons sont effectuées, via notre transporteur Chronopost, à l'adresse
              indiquée par le client lors de la commande — que celle-ci soit son propre domicile,
              un point relais ou toute autre adresse de son choix. Les délais et frais de livraison
              varient selon le mode d'expédition choisi et sont précisés lors du processus de
              commande. En cas de retard ou de problème de livraison, le client est invité à
              contacter notre service client.
            </p>
            <p className={styles.text}>
              Conformément à l'article L.216-4 du Code de la consommation, le risque de perte ou
              d'endommagement du bien est transféré au client au moment où celui-ci, ou un tiers
              qu'il a désigné (autre que le transporteur), prend physiquement possession du bien.
              Jusqu'à cette prise de possession effective, ce risque est supporté par Wybob.
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Zone de livraison :</span> France métropolitaine et DOM-TOM. Livraison internationale disponible selon les destinations.</li>
              <li><span className={styles.label}>Délai indicatif :</span> 3 à 5 jours ouvrés pour la France métropolitaine.</li>
              <li><span className={styles.label}>Suivi :</span> Un numéro de suivi est communiqué par email dès l'expédition de la commande.</li>
              <li><span className={styles.label}>Exactitude de l'adresse :</span> Il appartient au client de vérifier l'exactitude et la complétude de l'adresse de livraison renseignée avant validation de la commande. Wybob ne peut être tenue responsable d'une erreur de saisie commise par le client.</li>
            </ul>
          </section>

          {/* 7. Responsabilité en cas d'incident de livraison */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>7.</span>
              Responsabilité en cas d'incident de livraison
            </h2>
            <p className={styles.text}>
              En complément de l'article 6, les situations suivantes peuvent survenir après
              l'expédition d'une commande. Elles sont traitées selon les principes ci-dessous,
              sans préjudice d'un examen au cas par cas par notre service client.
            </p>
            <ul className={styles.list}>
              <li>
                <span className={styles.label}>Adresse erronée et colis retourné à l'expéditeur :</span>{' '}
                si l'adresse fournie par le client est incomplète ou erronée et que le colis, non
                distribuable, est retourné à Wybob par le transporteur, une réexpédition pourra
                être proposée au client à sa demande, moyennant de nouveaux frais de livraison à
                sa charge.
              </li>
              <li>
                <span className={styles.label}>Colis remis au client ou à un tiers qu'il a désigné :</span>{' '}
                lorsque le colis est livré à l'adresse indiquée par le client — y compris une
                adresse autre que la sienne (proche, lieu de travail, etc.) qu'il a lui-même choisi
                de renseigner — et que le transporteur établit une preuve de remise (signature ou
                preuve de livraison équivalente), la livraison est réputée effectuée conformément à
                l'article L.216-4 du Code de la consommation. Aucun remboursement ou réexpédition
                n'est dû de ce seul fait, sauf preuve contraire apportée par le client.
              </li>
              <li>
                <span className={styles.label}>Colis livré à l'adresse correcte sans preuve de remise :</span>{' '}
                si le colis est livré à l'adresse exacte du client mais que le transporteur ne
                peut établir de preuve de remise effective à celui-ci ou à un tiers qu'il a désigné,
                le risque n'est pas réputé transféré et le client peut demander un remboursement ou
                une réexpédition. Wybob se réserve alors le droit d'exercer un recours contre le
                transporteur.
              </li>
              <li>
                <span className={styles.label}>Colis déposé à une adresse erronée fournie par le client, sans preuve de remise :</span>{' '}
                lorsque l'adresse erronée renseignée par le client est à l'origine de la remise du
                colis à un tiers non désigné (dépôt en boîte aux lettres, par exemple), Wybob
                examine la situation au cas par cas et n'est pas tenue de procéder à un
                remboursement ou à une réexpédition gratuite, l'erreur étant à l'origine imputable
                au client.
              </li>
            </ul>
          </section>

          {/* 8. Droit de rétractation */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>8.</span>
              Droit de rétractation
            </h2>
            <p className={styles.text}>
              Conformément à l'article L.221-18 du Code de la consommation, le client dispose
              d'un délai de 14 jours calendaires à compter de la réception de sa commande pour
              exercer son droit de rétractation, sans avoir à justifier de motifs. Les articles
              retournés doivent être dans leur état d'origine, non portés, non lavés et avec leurs
              étiquettes. Les frais de retour sont à la charge du client.
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Remboursement :</span> Le remboursement sera effectué dans un délai de 14 jours suivant la réception du retour, via le moyen de paiement utilisé lors de l'achat.</li>
              <li><span className={styles.label}>Exception :</span> Les articles personnalisés ou sur mesure sont exclus du droit de rétractation.</li>
            </ul>
          </section>

          {/* 9. Garanties légales */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>9.</span>
              Garanties légales
            </h2>
            <p className={styles.text}>
              Tous nos produits bénéficient des garanties légales prévues par le droit français :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Garantie de conformité :</span> 2 ans à compter de la livraison du bien (articles L.217-4 et suivants du Code de la consommation).</li>
              <li><span className={styles.label}>Garantie des vices cachés :</span> Articles 1641 et suivants du Code civil. Le client peut choisir entre la résolution de la vente ou une réduction du prix de vente.</li>
            </ul>
          </section>

          {/* 10. Service client */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>10.</span>
              Service client
            </h2>
            <p className={styles.text}>
              Pour toute question relative à une commande ou à nos produits, notre service client
              est disponible via le formulaire de contact disponible sur le site ou par email à{' '}
              <a href="mailto:contact@wybob.fr" className={styles.link}>contact@wybob.fr</a>.
            </p>
          </section>

          {/* 11. Droit applicable */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>11.</span>
              Droit applicable
            </h2>
            <p className={styles.text}>
              Les présentes CGV sont soumises au droit français. En cas de litige non résolu
              amiablement, les tribunaux français seront seuls compétents. Conformément aux
              articles L.611-1 et suivants du Code de la consommation, le client peut recourir
              gratuitement à un médiateur de la consommation.
            </p>
          </section>

        </div>
      </div>

      <Footer />
    </div>
  );
}
