declare module 'char' {
  interface chars {
    takeChar: (c: string) => void;
    returnChar: () => string;
  }
  export const chars: chars;
}

