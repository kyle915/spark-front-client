declare module "heic2any" {
  export interface Heic2AnyOptions {
    blob: Blob;
    toType?: string;
  }

  export default function heic2any(
    options: Heic2AnyOptions,
  ): Promise<Blob | Blob[]>;
}
