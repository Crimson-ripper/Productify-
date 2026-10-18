import { Helmet } from "react-helmet-async";

export default function SEO({
  title = "Productify — Digital products and GPU rentals",
  description = "Productify is a marketplace for digital products and hourly GPU rentals. Buy software and templates from independent sellers, or rent a GPU by the hour.",
  path = "/",
  image,
  type = "website",
  jsonLd,
}) {
  const site = "https://www.productifynow.com";
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
