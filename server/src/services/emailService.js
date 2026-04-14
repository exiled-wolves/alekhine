// server/src/services/emailService.js
// Alekhine — Email notifications (Nodemailer with SMTP / SendGrid)
// Phase 2 feature — stubbed for MVP, activate by setting EMAIL_* env vars.
//
// To switch to SendGrid: set EMAIL_PROVIDER=sendgrid and SENDGRID_API_KEY.
// To use SMTP (e.g. Gmail, Mailgun): set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS.

import nodemailer from 'nodemailer';

// ── Transport factory ─────────────────────────────────────────────────────────

const createTransport = () => {
  if (process.env.EMAIL_PROVIDER === 'sendgrid') {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }

  if (process.env.EMAIL_HOST) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // Development fallback — logs email to console instead of sending
  return {
    sendMail: async (opts) => {
      console.log('\n📧 [EMAIL STUB — configure EMAIL_* env vars to send real emails]');
      console.log('  To:', opts.to);
      console.log('  Subject:', opts.subject);
      console.log('  Body:', opts.text || '(html only)');
      return { messageId: 'stub-' + Date.now() };
    },
  };
};

const transporter = createTransport();
const FROM = process.env.EMAIL_FROM || 'FreelanceHub <no-reply@freelancehub.io>';

// ── Internal send helper ──────────────────────────────────────────────────────

const send = async ({ to, subject, text, html }) => {
  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, text, html });
    return info;
  } catch (err) {
    // Email failures must never crash the server — log and continue.
    console.error('[emailService] Failed to send email:', err.message);
    return null;
  }
};

// ── Public email methods ──────────────────────────────────────────────────────

export const emailService = {
  /**
   * Sent when a new user registers.
   */
  sendWelcome: async ({ to, name }) => {
    return send({
      to,
      subject: 'Welcome to FreelanceHub 🎉',
      text: `Hi ${name},\n\nWelcome to FreelanceHub! Your account has been created.\n\nGet started by completing your profile.\n\nThe FreelanceHub Team`,
      html: `
        <h2>Welcome to FreelanceHub, ${name}!</h2>
        <p>Your account has been created successfully.</p>
        <p>Get started by <a href="${process.env.CLIENT_URL}/dashboard">completing your profile</a>.</p>
        <br><p>The FreelanceHub Team</p>
      `,
    });
  },

  /**
   * Sent to a freelancer when their bid is accepted.
   */
  sendBidAccepted: async ({ to, freelancerName, jobTitle, agreedPrice }) => {
    return send({
      to,
      subject: `🎉 Your bid was accepted — ${jobTitle}`,
      text: `Hi ${freelancerName},\n\nGreat news! Your bid on "${jobTitle}" has been accepted.\n\nAgreed price: $${agreedPrice.toFixed(2)}\n\nLog in to view your contract and get started.\n\nThe FreelanceHub Team`,
      html: `
        <h2>Your bid was accepted!</h2>
        <p>Hi ${freelancerName},</p>
        <p>Your bid on <strong>${jobTitle}</strong> has been accepted.</p>
        <p>Agreed price: <strong>$${agreedPrice.toFixed(2)}</strong></p>
        <p><a href="${process.env.CLIENT_URL}/contracts">View your contract</a></p>
        <br><p>The FreelanceHub Team</p>
      `,
    });
  },

  /**
   * Sent to a freelancer when their bid is rejected.
   */
  sendBidRejected: async ({ to, freelancerName, jobTitle }) => {
    return send({
      to,
      subject: `Update on your bid — ${jobTitle}`,
      text: `Hi ${freelancerName},\n\nUnfortunately, your bid on "${jobTitle}" was not selected this time.\n\nKeep browsing — there are plenty of other opportunities waiting.\n\nThe FreelanceHub Team`,
      html: `
        <h2>Bid update for ${jobTitle}</h2>
        <p>Hi ${freelancerName},</p>
        <p>Your bid on <strong>${jobTitle}</strong> was not selected this time.</p>
        <p><a href="${process.env.CLIENT_URL}/jobs">Browse more jobs</a></p>
        <br><p>The FreelanceHub Team</p>
      `,
    });
  },

  /**
   * Sent to a client when a new bid is received on their job.
   */
  sendNewBidReceived: async ({ to, clientName, jobTitle, bidCount }) => {
    return send({
      to,
      subject: `New bid received on "${jobTitle}"`,
      text: `Hi ${clientName},\n\nYou have ${bidCount} bid(s) on your job "${jobTitle}".\n\nLog in to review them.\n\nThe FreelanceHub Team`,
      html: `
        <h2>New bid on your job!</h2>
        <p>Hi ${clientName},</p>
        <p>You now have <strong>${bidCount}</strong> bid(s) on <strong>${jobTitle}</strong>.</p>
        <p><a href="${process.env.CLIENT_URL}/jobs">Review bids</a></p>
        <br><p>The FreelanceHub Team</p>
      `,
    });
  },

  /**
   * Sent to a freelancer when a contract is marked complete (payout credited).
   */
  sendContractCompleted: async ({ to, freelancerName, jobTitle, payout }) => {
    return send({
      to,
      subject: `✅ Contract complete — $${payout.toFixed(2)} credited to your wallet`,
      text: `Hi ${freelancerName},\n\nYour contract for "${jobTitle}" has been marked complete.\n\n$${payout.toFixed(2)} has been credited to your FreelanceHub wallet.\n\nThe FreelanceHub Team`,
      html: `
        <h2>Contract complete 🎉</h2>
        <p>Hi ${freelancerName},</p>
        <p>Your contract for <strong>${jobTitle}</strong> has been marked complete.</p>
        <p><strong>$${payout.toFixed(2)}</strong> has been credited to your wallet.</p>
        <p><a href="${process.env.CLIENT_URL}/wallet">View your wallet</a></p>
        <br><p>The FreelanceHub Team</p>
      `,
    });
  },

  /**
   * Sent to both parties when a dispute is raised.
   */
  sendDisputeRaised: async ({ to, name, jobTitle, contractId }) => {
    return send({
      to,
      subject: `⚠️ Dispute raised — ${jobTitle}`,
      text: `Hi ${name},\n\nA dispute has been raised on your contract for "${jobTitle}".\n\nOur admin team will review and resolve it shortly.\n\nContract ID: ${contractId}\n\nThe FreelanceHub Team`,
      html: `
        <h2>Dispute raised on contract</h2>
        <p>Hi ${name},</p>
        <p>A dispute has been raised on the contract for <strong>${jobTitle}</strong>.</p>
        <p>Our admin team will review and resolve it shortly.</p>
        <p>Contract ID: <code>${contractId}</code></p>
        <br><p>The FreelanceHub Team</p>
      `,
    });
  },

  /**
   * Sent to the relevant party when a dispute is resolved by admin.
   */
  sendDisputeResolved: async ({ to, name, jobTitle, resolution }) => {
    const outcomeText = resolution === 'release'
      ? 'Funds have been released to the freelancer.'
      : 'A refund has been issued to the client.';

    return send({
      to,
      subject: `Dispute resolved — ${jobTitle}`,
      text: `Hi ${name},\n\nThe dispute on "${jobTitle}" has been resolved by our admin team.\n\n${outcomeText}\n\nThe FreelanceHub Team`,
      html: `
        <h2>Dispute resolved</h2>
        <p>Hi ${name},</p>
        <p>The dispute on <strong>${jobTitle}</strong> has been resolved by our admin team.</p>
        <p>${outcomeText}</p>
        <br><p>The FreelanceHub Team</p>
      `,
    });
  },

  /**
   * Sent to a freelancer when a review is posted on their profile.
   */
  sendReviewReceived: async ({ to, freelancerName, rating, clientName }) => {
    return send({
      to,
      subject: `⭐ New review from ${clientName}`,
      text: `Hi ${freelancerName},\n\n${clientName} left you a ${rating}-star review on FreelanceHub.\n\nThe FreelanceHub Team`,
      html: `
        <h2>You received a new review!</h2>
        <p>Hi ${freelancerName},</p>
        <p><strong>${clientName}</strong> left you a <strong>${rating}-star</strong> review.</p>
        <p><a href="${process.env.CLIENT_URL}/profile">View your profile</a></p>
        <br><p>The FreelanceHub Team</p>
      `,
    });
  },
};