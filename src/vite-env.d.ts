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
          // Google's own set. `continue_with` is what this form uses: one label
          // for both tabs, so switching them never rebuilds the button.
          text: "signin_with" | "signup_with" | "continue_with" | "signin";
          width: number;
        },
      ): void;
    };
  };
}

interface Window {
  google?: GoogleIdentityApi;
}
