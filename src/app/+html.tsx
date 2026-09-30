import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

const siteUrl = "https://hippo-pro.vercel.app";
const description = "Sistema para agencias hípicas.";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="description" content={description} />
        <link rel="icon" href="/logo.jpeg" type="image/jpeg" />
        <meta property="og:title" content="HIPPO Pro" />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:image" content={`${siteUrl}/logo.jpeg`} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
