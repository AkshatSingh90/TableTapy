// Enterprise Audio Manager for Tabletapy
// Solves:
// 1. Browser Autoplay & AudioContext 'suspended' state on mobile/desktop
// 2. Hardware AudioContext exhaustion (exceeding browser limit of 6 instances)
// 3. Silent failures when device sleeps or switches tabs

let globalAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

/**
 * Returns a shared, singleton AudioContext instance.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      globalAudioCtx = new AudioCtx();
    }
  }

  return globalAudioCtx;
}

/**
 * Unlocks the Web Audio pipeline on first user interaction (touch, click, keydown).
 * Necessary for iOS Safari, Chrome Android, and desktop Autoplay policies.
 */
export function unlockAudio(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);

    const ctx = getAudioContext();
    if (!ctx) return resolve(false);

    if (ctx.state === 'running') {
      isAudioUnlocked = true;
      return resolve(true);
    }

    ctx.resume().then(() => {
      // Play a short silent buffer to confirm hardware pipeline is open
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch {}

      isAudioUnlocked = true;
      resolve(true);
    }).catch(() => {
      resolve(false);
    });
  });
}

// Auto-register touch/click unlock listener in browser environment
if (typeof window !== 'undefined') {
  const handleInteraction = () => {
    unlockAudio();
    window.removeEventListener('click', handleInteraction);
    window.removeEventListener('touchstart', handleInteraction);
    window.removeEventListener('keydown', handleInteraction);
  };

  window.addEventListener('click', handleInteraction, { once: true, passive: true });
  window.addEventListener('touchstart', handleInteraction, { once: true, passive: true });
  window.addEventListener('keydown', handleInteraction, { once: true, passive: true });
}

/**
 * Helper to ensure the audio context is resumed before generating tone.
 */
async function ensureRunningContext(): Promise<AudioContext | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {}
  }

  return ctx;
}

/**
 * 1. New Order Placement Chime (Crisp upward dining bell)
 */
export async function playNewOrderChime(enabled = true) {
  if (!enabled) return;
  try {
    const ctx = await ensureRunningContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch (err) {
    console.warn("[AudioManager] playNewOrderChime muted:", err);
  }
}

/**
 * 2. Urgent Kitchen Hold & Item Modification Alert
 * Distinct, unmistakable two-tone warning siren (Sawtooth) for stopping prep mid-ticket!
 */
export async function playKitchenHoldUrgentAlert(enabled = true) {
  if (!enabled) return;
  try {
    const ctx = await ensureRunningContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    // 3 rapid alternating warning pulses: 520Hz -> 380Hz -> 520Hz -> 380Hz
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.setValueAtTime(380, now + 0.12);
    osc.frequency.setValueAtTime(520, now + 0.24);
    osc.frequency.setValueAtTime(380, now + 0.36);
    osc.frequency.setValueAtTime(520, now + 0.48);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.68);
  } catch (err) {
    console.warn("[AudioManager] playKitchenHoldUrgentAlert muted:", err);
  }
}

/**
 * 3. Food Ready & Server Expediter Pickup Bell (Crisp restaurant bell)
 */
export async function playFoodReadyBell(enabled = true) {
  if (!enabled) return;
  try {
    const ctx = await ensureRunningContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.18); // C6

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.48);
  } catch (err) {
    console.warn("[AudioManager] playFoodReadyBell muted:", err);
  }
}

/**
 * 4. UPI Payment Verification Chime
 */
export async function playUpiNotificationChime(enabled = true) {
  if (!enabled) return;
  try {
    const ctx = await ensureRunningContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc2.frequency.setValueAtTime(783.99, now + 0.15); // G5

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.18);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn("[AudioManager] playUpiNotificationChime muted:", err);
  }
}

/**
 * 5. Cash Call / Waiter Call Bell
 */
export async function playCashCallAlert(enabled = true) {
  if (!enabled) return;
  try {
    const ctx = await ensureRunningContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(659.25, now + 0.12);
    osc.frequency.setValueAtTime(880, now + 0.25);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.58);
  } catch (err) {
    console.warn("[AudioManager] playCashCallAlert muted:", err);
  }
}
