

export const format = (lovelaces:Number): String => new Intl.NumberFormat().format((lovelaces.valueOf() / 1_000_000)).concat(" ₳");

