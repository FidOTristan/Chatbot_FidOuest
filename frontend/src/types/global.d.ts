export {};

declare global {
  interface Window {
    permissions: {
      get: () => Promise<{
        canUseApp: boolean;
        canImportFiles: boolean;
      }>;
    };
    externalLinks: {
      open: (url: string) => Promise<boolean>;
    };
    backend?: {
      baseUrl: string;
    };
  }
}
