import type { AppConfig, SupportedCoin } from "./types";

export const DEFAULT_WALLETS: Record<SupportedCoin, string> = {
  BTC: "bc1qs3wn9rudzj3crl9yvck7ajfh0kavnffqsq037s",
  LTC: "LQVQY35YkdmGE1PtqfaRbEHox3MZbWKrZa",
  RVN: "REYeMLf1GoKn3D4w8haFQjZFW6St4itq8P",
  XMR: "47szZ9FmKjPh8uBf9G5QwvYTjuVaqT8FEZ9NWpSebw7oDZAcL9aNzDNdq3GUk7ky5SP8jEC751jaR7AviABRNrXrGQoD5Ru"
};

export const COIN_LABELS: Record<SupportedCoin, string> = {
  BTC: "Bitcoin",
  LTC: "Litecoin",
  RVN: "Ravencoin",
  XMR: "Monero"
};

export function sanitizeCoin(value: string): SupportedCoin {
  const normalized = value.trim().toUpperCase();
  if (normalized === "BTC") {
    return "BTC";
  }

  if (normalized === "RVN") {
    return "RVN";
  }

  if (normalized === "XMR") {
    return "XMR";
  }

  return "LTC";
}

export function sanitizeWorker(worker: string): string {
  const trimmed = worker.trim();
  return trimmed || "worker";
}

export function buildPayoutUser(coin: SupportedCoin, wallet: string, worker: string): string {
  const trimmedWallet = wallet.trim();
  if (!trimmedWallet) {
    return `${coin.toLowerCase()}:your_wallet.${sanitizeWorker(worker)}`;
  }

  return `${coin.toLowerCase()}:${trimmedWallet}.${sanitizeWorker(worker)}`;
}

export function applyCoinPreset(config: AppConfig, coinValue: string): AppConfig {
  const coin = sanitizeCoin(coinValue);

  return {
    ...config,
    wallet: DEFAULT_WALLETS[coin],
    payoutTicker: coin,
    gpuEnabled: config.gpuEnabled,
    cpuEnabled: coin === "RVN" ? false : config.cpuEnabled,
    gpuPool: {
      host: "kp.unmineable.com",
      port: 3333
    },
    cpuPool: {
      host: "rx.unmineable.com",
      port: 3333,
      user: buildPayoutUser(coin, DEFAULT_WALLETS[coin], config.worker),
      password: "x",
      algo: "rx/0"
    }
  };
}
