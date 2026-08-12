const VAULT_ASSETS = Object.freeze({
  empty: './assets/vault/vault-0.webp',
  almostEmpty: './assets/vault/vault-almost-empty.webp',
  ten: './assets/vault/vault-10.webp',
  twentyFive: './assets/vault/vault-25.webp',
  fifty: './assets/vault/vault-50.webp',
  seventyFive: './assets/vault/vault-75.webp',
  full: './assets/vault/vault-100.webp'
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function getBufferVisualState(balanceCents, minimumBufferCents) {
  const balance = finite(balanceCents);
  const buffer = Math.max(0, finite(minimumBufferCents));
  const deltaCents = balance - buffer;

  if (!(buffer > 0)) {
    return {
      stage: 'unset',
      asset: VAULT_ASSETS.almostEmpty,
      status: 'Pufferziel noch nicht festgelegt',
      ratioPercent: null,
      progressPercent: 0,
      deltaCents,
      alt: 'Tresor als Hinweis: Es ist noch kein Mindestpuffer festgelegt.'
    };
  }

  const ratioPercent = (balance / buffer) * 100;
  const progressPercent = Math.max(0, Math.min(100, ratioPercent));
  let stage = 'full';
  let asset = VAULT_ASSETS.full;
  let status = 'Pufferziel erreicht';

  if (balance <= 0) {
    stage = 'empty'; asset = VAULT_ASSETS.empty; status = 'Puffer aufgebraucht';
  } else if (ratioPercent < 10) {
    stage = 'almost-empty'; asset = VAULT_ASSETS.almostEmpty; status = 'Nur noch eine kleine Reserve';
  } else if (ratioPercent < 25) {
    stage = '10'; asset = VAULT_ASSETS.ten; status = 'Der Puffer ist noch sehr dünn';
  } else if (ratioPercent < 50) {
    stage = '25'; asset = VAULT_ASSETS.twentyFive; status = 'Die Reserve wächst';
  } else if (ratioPercent < 75) {
    stage = '50'; asset = VAULT_ASSETS.fifty; status = 'Solider Puffer';
  } else if (ratioPercent < 100) {
    stage = '75'; asset = VAULT_ASSETS.seventyFive; status = 'Gut abgesichert';
  }

  return {
    stage,
    asset,
    status,
    ratioPercent,
    progressPercent,
    deltaCents,
    alt: `Tresorstatus: ${status}. Der prognostizierte Monatsendstand entspricht rund ${Math.max(0, Math.round(ratioPercent))} Prozent des Mindestpuffers.`
  };
}
