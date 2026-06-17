/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  dataLayer: unknown[];
  AppleID?: {
    auth: {
      init: (config: {
        clientId: string;
        scope: string;
        redirectURI: string;
        state?: string;
        nonce?: string;
        usePopup?: boolean;
      }) => void;
      signIn: () => Promise<{
        authorization: { id_token: string; code: string; state?: string };
        user?: { name?: { firstName?: string; lastName?: string }; email?: string };
      }>;
    };
  };
}
