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