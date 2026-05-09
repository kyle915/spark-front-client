declare module "libheif-js/wasm-bundle" {
  export interface HeifDecodedImage {
    get_width(): number;
    get_height(): number;
    display(
      imageData: ImageData,
      callback: (displayData: ImageData | null) => void,
    ): void;
    free?(): void;
  }

  export interface HeifDecoder {
    decode(data: Uint8Array | ArrayBuffer): HeifDecodedImage[];
  }

  export interface LibHeifModule {
    HeifDecoder: new () => HeifDecoder;
  }

  const libheif: LibHeifModule;
  export default libheif;
}
