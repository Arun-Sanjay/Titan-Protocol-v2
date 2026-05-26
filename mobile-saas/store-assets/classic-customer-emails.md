# Classic Customer Outreach Emails

> Two emails: T-2 weeks (heads-up) and T-0 (launch day). Sent to the cohort that purchased Titan Protocol Classic on the Play Store.

The first email is the highest-leverage marketing action of the entire launch — warmer-than-warm audience, already paid, already engaged. Don't undersell.

---

## Email 1: Heads-up (T-2 weeks)

### Subject line — pick one:

- `A new Titan Protocol is coming. You're getting it free.`
- `Heads up — your Titan Protocol is going multi-device.`
- `A bigger Titan Protocol is on the way (and you get it free).`

### From

`Arun · Titan Protocol <titanprotocol.os@gmail.com>`

### Body

```
Hey {{first_name}},

Quick note before things get noisy in your app store.

In the next couple of weeks, a new edition of Titan Protocol lands on the App Store and Play Store. Same four engines, same daily score, same gamified protocol — but synced across web, desktop, and mobile in real time. Same account. Same data. Three devices.

Because you bought the original, three things are true:

1. Your Classic edition keeps working. We're just renaming it to "Titan Protocol Classic" in the store so people can tell the editions apart. Nothing on your phone changes.

2. You get the new SaaS edition free for 6 to 12 months when we turn on Pro pricing later this year. Grandfathered. Permanent on your account.

3. You're the first to try it. When the new app shows up in stores, you're invited to TestFlight (iOS) or Play Internal Testing (Android) before the public launch. Reply to this email if you want in — I'll add you.

What you don't have to do: anything. Just keep using the Classic app like normal. I'll send another email the day the new edition is live with the download links and your account migration link.

If you have questions — or just want to tell me what should make it in before launch — hit reply. This inbox lands on my phone.

— Arun
Titan Protocol

P.S. Want the technical detail? The new edition is a fresh native build (Expo + React Native) on the same backend the desktop app already uses. Cross-device updates are real-time (sub-2-second). All your data lives on a Supabase database with row-level security; sign in on a new device and it pulls everything down in seconds.
```

### Send timing

- **2 weeks ahead** of the actual SaaS app appearing in stores
- **Tuesday-Thursday, 9am IST** (avoid Mondays / weekends)
- Use a real email client (no marketing template — feels personal)

---

## Email 2: Launch day (T-0)

### Subject line — pick one:

- `Titan Protocol SaaS is live. Here's how to install it.`
- `It's here: install Titan Protocol on iPhone or Android.`
- `Multi-device Titan Protocol is live. Install link inside.`

### From

`Arun · Titan Protocol <titanprotocol.os@gmail.com>`

### Body

```
Hey {{first_name}},

It's live.

iPhone: {{APP_STORE_URL}}
Android: {{PLAY_STORE_URL}}

What to do (90 seconds, max):

1. Install on whichever device you grab first.
2. Sign in with the same email you use for the desktop app — or create a new account if you haven't yet. (If you're not on the desktop app yet either, the SaaS web version is at titanprotocol.com.)
3. The app pulls your data down from cloud automatically. First sync takes about 5 seconds.
4. Open Settings (Profile tab) → flip "Push from server" on if you want streak warnings. That's the only setup.

Your free Pro period

You're grandfathered. When Pro pricing lands later this year, your account stays on full features for 6 to 12 months at no cost. Nothing to claim — it's tied to your purchased Classic edition. I'll send another email when that switch happens.

The Classic app stays

If you'd rather stick with the standalone Classic edition, nothing changes. It's now called "Titan Protocol Classic" in the store but it's the same app, same data on your phone, same forever.

What's different in the SaaS edition

— Real-time sync across iPhone, Android, web, and Mac/Windows desktop
— Server-pushed streak warnings (won't let you break your run on a phone-charging day)
— A cleaner re-skinned UI built specifically for narrow screens
— Faster cold start (under a second to the dashboard)

If anything's broken or weird, reply to this email — I'll fix it.

— Arun
Titan Protocol

P.S. If you want to try the desktop app too, it's at titanprotocol.com/download. Same account, same data, signed and notarized for Mac + Windows.
```

### Send timing

- **Within 24 hours** of the App Store + Play Store listings going live
- **Tuesday or Wednesday morning** (Apple often approves Monday afternoon US time → email Tuesday IST)

---

## TODO before sending either email

- `{{first_name}}` — personalize per recipient (you have purchase records from Play Console with email addresses; first names may need a lookup).
- `{{APP_STORE_URL}}` — fill once App Store approval lands.
- `{{PLAY_STORE_URL}}` — fill once Play Store approval lands.
- `titanprotocol.com` domain — must resolve to *something* before the launch email lands. Even a one-page Vercel placeholder.
- `titanprotocol.com/download` — desktop download page (P3 deliverable).

---

## Mechanics

- **Send from Gmail manually** in batches of 30-40, or use a transactional email service (Resend, Postmark) with a domain warm-up.
- **No mail-merge templates** — looks impersonal to warm leads. Worth the manual effort for the first cohort.
- **Track replies.** This cohort is your strongest signal for what to build next.
