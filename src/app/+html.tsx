import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

import { palette } from "@/constants/palette";

const siteUrl = "https://hippopro.com.ar";
const description = "Sistema para agencias hípicas.";
const imageUrl = `${siteUrl}/og.png`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="description" content={description} />
        <meta name="theme-color" content={palette.navy} />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta property="og:title" content="HippoPro" />
        <meta property="og:site_name" content="HippoPro" />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_AR" />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={imageUrl} />
        <ScrollViewStyleReset />
        <style>{`html, body, #root { height: 100dvh; overflow: hidden; }`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
