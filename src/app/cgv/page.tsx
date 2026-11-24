import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import '../page.css';
import styles from './cgv.module.css';

export const metadata = {
  title: 'Conditions Générales de Vente',
  description: 'Conditions générales de vente du site Wybob',
  alternates: { canonical: '/cgv' },
};

export default function CGV() {
  return (
    <div className="container">
      <Navbar />

      <div className={`${styles.cgvZone} cgvZone`}>
        <div className={styles.content}>

          <h1 className={styles.title}>Conditions Générales de Vente</h1>

          {/* 1. Objet et identité du vendeur */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>1.</span>
              Objet et identité du vendeur
            </h2>
            <p className={styles.text}>
              Les présentes Conditions Générales de Vente (CGV) régissent l'ensemble des ventes
              conclues via le site internet{' '}
              <a href="https://wybob.shop/" className={styles.link}>https://wybob.shop/</a>{' '}
              entre le vendeur désigné ci-dessous et ses clients. Tout achat implique
              l'acceptation pleine et entière des présentes CGV.
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Vendeur :</span> Penelope WYBO EI (nom commercial : WYBOB), entrepreneur individuel</li>
              <li><span className={styles.label}>Adresse :</span> 10 rue André Lefebvre, 75015 Paris, France</li>
              <li><span className={styles.label}>SIRET :</span> 106 049 539 00013</li>
              <li><span className={styles.label}>TVA :</span> TVA non applicable, article 293 B du Code général des impôts</li>
              <li>
                <span className={styles.label}>Email :</span>{' '}
                <a href="mailto:wybopenelopemarie@gmail.com" className={styles.link}>wybopenelopemarie@gmail.com</a>{' '}
                <strong>[À COMPLÉTER : confirmer l'adresse email de contact unique, identique sur les mentions légales, la politique de confidentialité et les CGV]</strong>
              </li>
            </ul>
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
              Les prix des produits sont indiqués en euros (€). TVA non applicable, article 293 B du
              Code général des impôts : le prix affiché est le prix final du produit. Les frais de
              livraison, calculés selon le poids de la commande, la destination et le mode de
              livraison choisi, ainsi que le prix de l'assurance colis optionnelle, sont indiqués
              avant le paiement. Wybob se réserve le droit de modifier ses prix à tout moment, étant
              entendu que le prix applicable est celui en vigueur au moment de la validation de la
              commande.
            </p>
          </section>

          {/* 4. Commandes */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>4.</span>
              Commandes
            </h2>
            <p className={styles.text}>
              La commande peut être passée avec ou sans compte client. Elle se déroule selon les
              étapes suivantes :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Panier :</span> Le client ajoute les produits souhaités à son panier et peut y saisir un code promotionnel.</li>
              <li><span className={styles.label}>Informations de livraison :</span> Le client renseigne ses coordonnées et son adresse, choisit le mode de livraison (à domicile ou en point relais lorsque ce mode est disponible pour le pays de destination) et, s'il le souhaite, l'assurance colis. Les frais et le délai de livraison estimés sont affichés.</li>
              <li><span className={styles.label}>Paiement :</span> Le client choisit son moyen de paiement puis valide. La commande est alors enregistrée en attente de paiement et un email récapitulatif lui est envoyé à l'adresse indiquée lors de la commande.</li>
              <li><span className={styles.label}>Validation :</span> La commande est validée uniquement une fois le paiement accepté. Le client en est informé par email. Si le paiement est refusé ou annulé, la commande n'est pas validée.</li>
              <li><span className={styles.label}>Facture :</span> Une facture est émise lors de la validation du paiement. Les clients disposant d'un compte peuvent la télécharger depuis leur espace client ; les autres clients peuvent l'obtenir sur simple demande auprès du service client.</li>
            </ul>
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
              Express) et Amazon Pay. Le débit est effectué au moment où le client valide son
              paiement. Les données bancaires sont saisies directement auprès de Stripe, sont
              chiffrées et ne sont jamais stockées sur nos serveurs.
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
              <li><span className={styles.label}>France métropolitaine :</span> Livraison à domicile (Chrono 13) ou en point relais (Chrono Relais 13).</li>
              <li><span className={styles.label}>DOM-TOM :</span> <strong>[À COMPLÉTER : confirmer les destinations d'outre-mer desservies et leurs conditions de livraison]</strong></li>
              <li><span className={styles.label}>International :</span> Livraison à domicile vers les pays proposés lors de la commande, et en point relais pour les pays européens où ce service est disponible. <strong>[À COMPLÉTER : préciser qui supporte les droits de douane et taxes d'importation pour les destinations hors Union européenne]</strong></li>
              <li><span className={styles.label}>Délais :</span> Le délai de livraison indiqué lors de la commande court à compter de l'expédition (en France métropolitaine : livraison le lendemain de l'expédition avant 13h, à domicile comme en point relais). Délai de préparation avant expédition : <strong>[À COMPLÉTER : délai de préparation de la commande]</strong>. À défaut d'autre indication, la livraison intervient au plus tard 30 jours après la conclusion du contrat (article L.216-1 du Code de la consommation).</li>
              <li><span className={styles.label}>Suivi :</span> Le client est informé par email de l'expédition puis de la livraison de sa commande. Le numéro de suivi Chronopost peut lui être communiqué sur simple demande auprès du service client.</li>
              <li><span className={styles.label}>Assurance colis :</span> Chaque colis est couvert gratuitement par Chronopost jusqu'à 250 € en cas de perte ou d'avarie. Le client peut, en option, étendre cette couverture à la valeur de sa commande, dans la limite de 5 000 €, moyennant un supplément de 0,9 % de la valeur assurée (minimum 5 €), indiqué avant le paiement.</li>
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
              Conformément aux articles L.221-18 et suivants du Code de la consommation, le client
              consommateur dispose d'un délai de 14 jours pour exercer son droit de rétractation,
              sans avoir à justifier de motifs ni à payer de pénalités. Ce délai court à compter
              du jour où le client, ou un tiers qu'il a désigné (autre que le transporteur), prend
              physiquement possession du bien. Pour une commande de plusieurs produits livrés
              séparément, il court à compter de la réception du dernier produit.
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Comment se rétracter :</span> Le client informe Wybob de sa décision avant l'expiration du délai, par une déclaration dénuée d'ambiguïté envoyée par email à l'adresse indiquée à l'article 1 ou par courrier, ou en utilisant le formulaire type de rétractation figurant en annexe des présentes CGV.</li>
              <li><span className={styles.label}>Retour du produit :</span> Le client renvoie le produit sans retard excessif et au plus tard dans les 14 jours suivant la communication de sa décision, à l'adresse suivante : <strong>[À COMPLÉTER : adresse de retour des produits]</strong>. Les frais de retour sont à la charge du client.</li>
              <li><span className={styles.label}>État du produit :</span> Le client peut manipuler le produit dans la mesure nécessaire pour établir sa nature, ses caractéristiques et son bon fonctionnement. Sa responsabilité ne peut être engagée qu'en cas de dépréciation du produit résultant d'autres manipulations (article L.221-23 du Code de la consommation).</li>
              <li><span className={styles.label}>Remboursement :</span> Wybob rembourse la totalité des sommes versées, y compris les frais de livraison initiaux (dans la limite du coût du mode de livraison standard le moins coûteux proposé), au plus tard dans les 14 jours à compter du jour où elle est informée de la décision de rétractation. Ce remboursement peut être différé jusqu'à la récupération du produit ou jusqu'à ce que le client ait fourni une preuve de son expédition, la date retenue étant celle du premier de ces événements. Il est effectué avec le même moyen de paiement que celui utilisé lors de la commande, sauf accord exprès du client pour un autre moyen.</li>
              <li><span className={styles.label}>Exceptions :</span> Conformément à l'article L.221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux biens confectionnés selon les spécifications du consommateur ou nettement personnalisés. <strong>[À COMPLÉTER : préciser si des produits personnalisés sont proposés à la vente ; à défaut, supprimer cette exception]</strong></li>
            </ul>
          </section>

          {/* 9. Garanties légales */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>9.</span>
              Garanties légales
            </h2>
            <p className={styles.text}>
              Tous nos produits bénéficient des garanties légales prévues par le droit français,
              indépendamment de toute garantie commerciale :
            </p>
            <ul className={styles.list}>
              <li><span className={styles.label}>Garantie légale de conformité :</span> Le consommateur dispose d'un délai de deux ans à compter de la délivrance du bien pour obtenir la mise en œuvre de la garantie légale de conformité en cas d'apparition d'un défaut de conformité. Durant ce délai, le consommateur n'est tenu d'établir que l'existence du défaut de conformité et non la date d'apparition de celui-ci. La garantie donne droit à la réparation ou au remplacement du bien dans un délai de trente jours suivant la demande, sans frais et sans inconvénient majeur pour le consommateur. Le consommateur peut obtenir une réduction du prix en conservant le bien, ou mettre fin au contrat en se faisant rembourser intégralement contre restitution du bien, notamment si la réparation ou le remplacement est refusé, intervient après trente jours, occasionne un inconvénient majeur ou ne permet pas de remédier au défaut. Il n'a pas droit à la résolution de la vente si le défaut de conformité est mineur. Ces droits résultent des articles L.217-1 à L.217-32 du Code de la consommation. Le vendeur qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité encourt une amende civile (article L.241-5 du Code de la consommation). <strong>[À COMPLÉTER : vérifier et reprendre mot pour mot l'encadré d'information prévu par le décret n° 2022-424 du 25 mars 2022]</strong></li>
              <li><span className={styles.label}>Garantie des vices cachés :</span> Le consommateur bénéficie également de la garantie légale des vices cachés en application des articles 1641 à 1649 du Code civil, pendant deux ans à compter de la découverte du défaut. Cette garantie donne droit à une réduction du prix si le bien est conservé, ou à un remboursement intégral contre restitution du bien.</li>
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
              <a href="mailto:wybopenelopemarie@gmail.com" className={styles.link}>wybopenelopemarie@gmail.com</a>{' '}
              <strong>[À COMPLÉTER : confirmer l'adresse email de contact unique]</strong>.
            </p>
          </section>

          {/* 11. Médiation de la consommation */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>11.</span>
              Médiation de la consommation
            </h2>
            <p className={styles.text}>
              Conformément aux articles L.611-1 et suivants du Code de la consommation, en cas de
              litige non résolu par notre service client, le client consommateur peut recourir
              gratuitement au médiateur de la consommation suivant :
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
              Avant de saisir le médiateur, le client doit avoir tenté de résoudre le litige
              directement auprès de nous par une réclamation écrite.
            </p>
          </section>

          {/* 12. Droit applicable */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>12.</span>
              Droit applicable
            </h2>
            <p className={styles.text}>
              Les présentes CGV sont soumises au droit français. En cas de litige, et à défaut
              d'accord amiable ou de médiation, les tribunaux français sont compétents. Le client
              consommateur conserve la possibilité de saisir la juridiction de son lieu de
              domicile et de bénéficier des dispositions protectrices du droit de son pays de
              résidence.
            </p>
          </section>

          {/* Annexe. Formulaire type de rétractation */}
          <section className={styles.section}>
            <h2 className={styles.heading}>
              <span className={styles.numAccent}>Annexe.</span>
              Formulaire type de rétractation
            </h2>
            <p className={styles.text}>
              (Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez
              vous rétracter du contrat.)
            </p>
            <ul className={styles.list}>
              <li>
                À l'attention de Penelope WYBO EI (WYBOB), 10 rue André Lefebvre, 75015 Paris,
                France — email :{' '}
                <a href="mailto:wybopenelopemarie@gmail.com" className={styles.link}>wybopenelopemarie@gmail.com</a>{' '}
                <strong>[À COMPLÉTER : confirmer l'adresse email de contact unique]</strong>
              </li>
              <li>Je/Nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente du bien ci-dessous :</li>
              <li>Commandé le (*) / reçu le (*) :</li>
              <li>Numéro de commande :</li>
              <li>Nom du (des) consommateur(s) :</li>
              <li>Adresse du (des) consommateur(s) :</li>
              <li>Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :</li>
              <li>Date :</li>
            </ul>
            <p className={styles.text}>
              (*) Rayez la mention inutile.
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
