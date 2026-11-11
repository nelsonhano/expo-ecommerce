import React from "react";

export function StripeProvider({ children }: { children: React.ReactNode; publishableKey?: string }) {
  return React.createElement(React.Fragment, null, children);
}

export function useStripe() {
  return {
    initPaymentSheet: async () => ({
      error: { message: "Stripe Payment Sheet requires an iOS or Android device or emulator." },
    }),
    presentPaymentSheet: async () => ({
      error: { message: "Stripe Payment Sheet requires an iOS or Android device or emulator." },
    }),
  };
}

