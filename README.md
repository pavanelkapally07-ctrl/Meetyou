# Meetyou MVP — real-time chat and video-call starter

This is a **prototype**, not a production-ready dating/social platform. It includes live room chat, WebRTC video-call signaling, a self-declared 18+ gate, consent checkbox, leave/mute/end controls, and demo report/block controls.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
cp .env.example .env
npm install
npm start
```

Open http://localhost:3000 in two browser windows/devices. Join the same room code with different names. For video calls, allow camera/microphone access. Localhost is allowed by modern browsers; deployed camera access requires HTTPS.

## What's demo-only / not yet safe for public launch

- **Age:** checkbox is only self-declaration, not age verification. Use an appropriate third-party age/identity assurance vendor and a documented appeal path before launch.
- **Identity & accounts:** no login, verified profiles, session management, password reset, or abuse-resistant account controls.
- **Chat storage:** messages are in-memory broadcasts only; they are not persisted. Do not represent this as end-to-end encrypted.
- **Video:** WebRTC media is peer-to-peer where network conditions allow; the server only relays signaling. STUN-only setup may fail on some networks. Add a reputable TURN provider and protect credentials server-side.
- **Payments:** disabled. Do not collect card/UPI details yourself or claim the app is paid yet. For India, open a merchant account with a payment provider (e.g. Razorpay), complete its onboarding/KYC, create orders on your server, verify signed webhooks, maintain a server-side credit ledger, handle refunds/disputes, and never trust client-reported payment success. Payment-provider availability/fees and adult-content restrictions must be checked directly with the provider.
- **Safety:** report events are only written to the server log; there is no moderator dashboard or persistent case queue. Block is local-only. Production needs server-enforced blocks, reporting review, rate limits, spam controls, clear community rules, escalation and emergency procedures.
- **Privacy/legal:** no privacy policy, retention controls, consent logs, deletion/export workflow, or legal review included. Add these before collecting personal data. Minimize collection; don't record calls by default; explain any processing clearly.
- **Deployment:** configure HTTPS, secure headers/CSP, production secrets, database, backups, monitoring, error handling, and a managed hosting environment. Consider adding a database and authenticated Socket.IO sessions.

## Realistic monetization

Start with a free beta and measure repeat usage before charging. Possible later models: (1) optional monthly subscription, (2) clearly priced credit packs for non-sensitive premium features, or (3) per-minute calls with explicit pre-call price, consent, and refund rules. For creator payouts, show the split before a session, verify identities as legally required, keep a ledger, and pay only after fraud/dispute checks. Revenue is not guaranteed.

Illustration only: if customers spend ₹1,000 and the platform fee is 20%, gross platform share is ₹200 before payment fees, creator payouts, hosting, support, refunds, and taxes. Do not treat this as a forecast.

## Suggested launch phases for a ₹1,000–₹5,000 budget

1. **Prototype (this repo):** test usability with a few trusted adults; no real money or sensitive content.
2. **Private beta:** add authentication, database, HTTPS deployment, TURN service, persistent moderation queue, and privacy/legal pages. Compare current hosting and communications costs before purchasing.
3. **Paid beta:** only after payment-provider approval, server-side order/webhook verification, age/identity checks suitable for the service, moderation staffing, and clear payout/refund policies.

The budget may cover a basic domain and a small amount of hosting/testing, but usually will not cover a fully secure, scalable platform with reliable video, identity verification, moderation, and payment operations.
