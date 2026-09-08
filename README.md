# Wholesale Powersport Solutions

A one-page site for sourcing motorcycle trade-ins from dealers, tow yards, and
repair shops. Dealers can list multiple motorcycles in one form; the
submission is emailed to your team.

## Structure

```
index.html        the whole site (hero, how it works, why us, intake form)
css/styles.css     all styling
js/main.js         add/remove motorcycle rows + form submission
```

No build tools, no dependencies to install — it's plain HTML/CSS/JS, so it
runs straight from GitHub Pages.

## Before you go live: connect the form to your email

The form needs somewhere to send submissions. This site uses
[Formspree](https://formspree.io) (free for up to 50 submissions/month, no
backend required):

1. Go to formspree.io and create a free account.
2. Create a new form and set the notification email to whichever inbox
   should receive dealer submissions.
3. Formspree will give you an endpoint that looks like
   `https://formspree.io/f/abcd1234`.
4. Open `js/main.js` and replace the placeholder at the top:
   ```js
   const FORM_ENDPOINT = "https://formspree.io/f/REPLACE_WITH_YOUR_FORM_ID";
   ```
   with your real endpoint.
5. Also update the two `mailto:` and `tel:` links in `index.html`'s footer
   to your real email and phone number.

That's it — no other code changes are needed to start receiving submissions.

## Customizing content

Everything editable lives in `index.html`:
- Hero headline/subheading — top of the `<section class="hero">` block.
- The three "how it works" steps — `<ol class="steps">`.
- The three "why us" blurbs — `<div class="why-grid">`.
- Footer email/phone — bottom of the file.

Colors and fonts are defined once at the top of `css/styles.css` under
`:root`, so you can retheme the whole site by changing a handful of values.

## A note on photos

The current form collects text details only (year, make, model, mileage,
condition, VIN, notes) — no photo upload. Formspree's free plan has limited
file-upload support, so for now the form asks dealers to describe condition
in the notes field, and you can request photos by email once you've seen
their list. If photo upload becomes a priority later, that's a good next
iteration (Formspree's paid plans, or a separate upload service, both work
well with this same layout).
