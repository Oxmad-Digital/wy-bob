function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CONTACT_SUBJECT_LABELS = {
  produit: 'Question produit',
  sav: 'SAV / Retour',
  commande: 'Suivi de commande',
  autre: 'Autre',
};

export function getContactFormEmailTemplate({ name, email, phone, subject, orderNumber, message, hasAttachment }) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = phone ? escapeHtml(phone) : '';
  const safeSubject = subject ? escapeHtml(CONTACT_SUBJECT_LABELS[subject] || subject) : '';
  const safeOrderNumber = orderNumber ? escapeHtml(orderNumber) : '';
  const safeMessage = escapeHtml(message);
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #f9f9f9; border-radius: 16px;">

      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1B1843; font-size: 28px; font-weight: 700;">WYBOB 🎩</h1>
      </div>

      <h2 style="color: #1B1843; font-size: 22px; text-align: center;">
        Nouveau message de contact
      </h2>

      <table style="width: 100%; margin: 24px 0; font-size: 15px; color: #444;">
        <tr><td style="padding: 6px 0; font-weight: 700; width: 100px;">Nom</td><td>${safeName}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 700;">Email</td><td>${safeEmail}</td></tr>
        ${safePhone ? `<tr><td style="padding: 6px 0; font-weight: 700;">Téléphone</td><td>${safePhone}</td></tr>` : ''}
        ${safeSubject ? `<tr><td style="padding: 6px 0; font-weight: 700;">Sujet</td><td>${safeSubject}</td></tr>` : ''}
        ${safeOrderNumber ? `<tr><td style="padding: 6px 0; font-weight: 700;">Commande</td><td>#${safeOrderNumber}</td></tr>` : ''}
      </table>

      <div style="background: white; border-radius: 8px; padding: 20px; color: #444; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</div>

      ${hasAttachment ? '<p style="color: #444; font-size: 13px; margin: 16px 0 0;">📎 Photo jointe à cet email</p>' : ''}

      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

      <p style="color: #888; font-size: 12px; text-align: center;">
        © 2026 WYBOB
      </p>

    </div>
  `;
}

export function getPasswordResetEmailTemplate(name, resetUrl) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #f9f9f9; border-radius: 16px;">

      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1B1843; font-size: 28px; font-weight: 700;">WYBOB 🎩</h1>
      </div>

      <h2 style="color: #1B1843; font-size: 22px; text-align: center;">
        Réinitialisation de votre mot de passe
      </h2>

      <p style="color: #444; font-size: 16px; line-height: 1.6; text-align: center; margin: 20px 0;">
        Bonjour ${name},<br/>
        Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous. Ce lien est valable <strong>1 heure</strong>.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="
          background-color: #F9C464;
          color: #1B1843;
          padding: 14px 40px;
          border-radius: 50px;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
          display: inline-block;
        ">
          Réinitialiser mon mot de passe
        </a>
      </div>

      <p style="color: #888; font-size: 13px; text-align: center;">
        Si vous n'avez pas fait cette demande, ignorez cet email. Votre mot de passe reste inchangé.
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

      <p style="color: #888; font-size: 12px; text-align: center;">
        © 2026 WYBOB
      </p>

    </div>
  `;
}

export function getOrderStatusUpdateEmailTemplate({ firstname, orderNumber, statusInfo, statusMessage, address, city, total }) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #f9f9f9; border-radius: 16px;">

      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1B1843; font-size: 28px; font-weight: 700;">WYBOB 🎩</h1>
      </div>

      <div style="background: ${statusInfo.color}18; border-left: 4px solid ${statusInfo.color}; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1B1843;">
          ${statusInfo.icon} Statut : ${statusInfo.label}
        </p>
      </div>

      <p style="color: #444; font-size: 16px; line-height: 1.6;">
        Bonjour ${firstname},<br/>
        ${statusMessage}
      </p>

      <div style="background: #fff; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px; color: #888; font-size: 13px;">Numéro de commande</p>
        <p style="margin: 0; color: #1B1843; font-size: 18px; font-weight: 700;">#${orderNumber}</p>
        ${address ? `<p style="margin: 12px 0 0; color: #666; font-size: 14px;">📍 ${address}${city ? `, ${city}` : ""}</p>` : ""}
        <p style="margin: 12px 0 0; color: #1B1843; font-size: 16px; font-weight: 600;">Total : ${Number(total).toFixed(2)} €</p>
      </div>

      <p style="color: #888; font-size: 13px; text-align: center;">
        Pour toute question, contactez-nous à support@wybob.fr
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

      <p style="color: #888; font-size: 12px; text-align: center;">
        © 2026 WYBOB
      </p>

    </div>
  `;
}

export function getExtraPaymentEmailTemplate({ firstname, orderNumber, reason, amount, paymentUrl }) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #f9f9f9; border-radius: 16px;">

      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1B1843; font-size: 28px; font-weight: 700;">WYBOB 🎩</h1>
      </div>

      <h2 style="color: #1B1843; font-size: 22px; text-align: center;">
        Paiement complémentaire requis
      </h2>

      <p style="color: #444; font-size: 16px; line-height: 1.6; text-align: center; margin: 20px 0;">
        Bonjour ${firstname},<br/>
        ${reason || "Un complément est nécessaire pour finaliser votre commande"} concernant votre commande <strong>#${orderNumber}</strong>.
      </p>

      <div style="background: #fff; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 8px; color: #888; font-size: 13px;">Montant à régler</p>
        <p style="margin: 0; color: #1B1843; font-size: 24px; font-weight: 700;">${Number(amount).toFixed(2)} €</p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${paymentUrl}" style="
          background-color: #F9C464;
          color: #1B1843;
          padding: 14px 40px;
          border-radius: 50px;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
          display: inline-block;
        ">
          Procéder au paiement
        </a>
      </div>

      <p style="color: #888; font-size: 13px; text-align: center;">
        Pour toute question, contactez-nous à support@wybob.fr
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

      <p style="color: #888; font-size: 12px; text-align: center;">
        © 2026 WYBOB
      </p>

    </div>
  `;
}

export function getAccountVerificationEmailTemplate(name, verifyUrl) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #f9f9f9; border-radius: 16px;">

      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1B1843; font-size: 28px; font-weight: 700;">WYBOB 🎩</h1>
      </div>

      <h2 style="color: #1B1843; font-size: 22px; text-align: center;">
        Bienvenue ${name} ! Confirmez votre email
      </h2>

      <p style="color: #444; font-size: 16px; line-height: 1.6; text-align: center; margin: 20px 0;">
        Plus qu'une étape pour activer votre compte WYBOB. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email. Ce lien est valable <strong>24 heures</strong>.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}" style="
          background-color: #F9C464;
          color: #1B1843;
          padding: 14px 40px;
          border-radius: 50px;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
          display: inline-block;
        ">
          Confirmer mon email
        </a>
      </div>

      <p style="color: #888; font-size: 13px; text-align: center;">
        Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

      <p style="color: #888; font-size: 12px; text-align: center;">
        © 2026 WYBOB
      </p>

    </div>
  `;
}

export function getRefundEmailTemplate({ firstname, orderNumber, amount, reason }) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #f9f9f9; border-radius: 16px;">

      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1B1843; font-size: 28px; font-weight: 700;">WYBOB 🎩</h1>
      </div>

      <h2 style="color: #1B1843; font-size: 22px; text-align: center;">
        Remboursement effectué
      </h2>

      <p style="color: #444; font-size: 16px; line-height: 1.6; text-align: center; margin: 20px 0;">
        Bonjour ${firstname},<br/>
        Un remboursement a été effectué concernant votre commande <strong>#${orderNumber}</strong>.
        ${reason ? `Motif : ${reason}.` : ""}
      </p>

      <div style="background: #fff; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 8px; color: #888; font-size: 13px;">Montant remboursé</p>
        <p style="margin: 0; color: #1B1843; font-size: 24px; font-weight: 700;">${Number(amount).toFixed(2)} €</p>
      </div>

      <p style="color: #888; font-size: 13px; text-align: center;">
        Ce montant sera recrédité sur votre moyen de paiement sous quelques jours ouvrés.
        Pour toute question, contactez-nous à support@wybob.fr
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

      <p style="color: #888; font-size: 12px; text-align: center;">
        © 2026 WYBOB
      </p>

    </div>
  `;
}

export function getVerificationEmailTemplate(name, dashboardUrl) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #f9f9f9; border-radius: 16px;">
      
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1B1843; font-size: 28px; font-weight: 700;">WYBOB 🎩</h1>
      </div>

      <h2 style="color: #1B1843; font-size: 22px; text-align: center;">
        Bienvenue ${name} ! 🎉
      </h2>

      <p style="color: #444; font-size: 16px; line-height: 1.6; text-align: center; margin: 20px 0;">
        Votre compte WYBOB a été créé avec succès. Vous pouvez maintenant accéder à votre espace personnel.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${dashboardUrl}" style="
          background-color: #F9C464;
          color: #1B1843;
          padding: 14px 40px;
          border-radius: 50px;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
          display: inline-block;
        ">
          Accéder à mon compte
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

      <p style="color: #888; font-size: 12px; text-align: center;">
        © 2026 WYBOB
      </p>

    </div>
  `;
}