import { Helmet } from "react-helmet-async";

export default function SEO({
  title = "Productify — Digital Marketplace & GPU Rental",
  description = "Buy digital products, sell your software and templates, and rent verified GPU nodes by the hour. Productify is the marketplace for people building tomorrow.",
  path = "/",
  image,
  type = "website",
  jsonLd,
}) {
  const site = "https://productifynow.com";
  const url = site + path;
  const img = image || `${site}/og-cover.png`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Productify" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
