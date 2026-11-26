import type { Config } from "./types";

export const DEFAULT_BOOKING_URL = "https://calendar.app.google/5RWsSL6BKcm3Wzxx6";

export function defaultConfig(): Config {
  return {
    prizes: [
      {
        id: "jackpot-1y",
        name: "1 Full Year · Jackpot",
        active: true,
        offerType: "months_free",
        value: 12,
        quantity: 1,
        chancePercent: 0,
        guaranteedTurns: [7],
        isJackpot: true,
      },
      {
        id: "6m",
        name: "6 Months Free",
        active: true,
        offerType: "months_free",
        value: 6,
        quantity: 20,
        chancePercent: 20,
        guaranteedTurns: [],
        isJackpot: false,
      },
      {
        id: "3m",
        name: "3 Months Free",
        active: true,
        offerType: "months_free",
        value: 3,
        quantity: 30,
        chancePercent: 30,
        guaranteedTurns: [],
        isJackpot: false,
      },
      {
        id: "1m",
        name: "1 Month Free",
        active: true,
        offerType: "months_free",
        value: 1,
        quantity: 50,
        chancePercent: 50,
        guaranteedTurns: [],
        isJackpot: false,
      },
    ],
    pickMode: "fixed_chance",
    fallbackPrizeId: "1m",
    offerSubject: "Website + AI Agent",
    offerDescription: "a custom website plus a Morus AI Agent",
    countdownMinutes: 10,
    expectedGuests: 120,
    onePerDevice: true,
    projectorSounds: true,
    hostName: "Brar Mortgages",
    bookingUrl: DEFAULT_BOOKING_URL,
    contactEmail: "info@morusai.com",
  };
}
