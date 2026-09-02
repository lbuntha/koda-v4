/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type: "standard";
          theme: "outline";
          size: "large";
          shape: "rectangular";
          text: "signin_with" | "signup_with";
          width: number;
        },
      ): void;
    };
  };
}

interface Window {
  google?: GoogleIdentityApi;
}
